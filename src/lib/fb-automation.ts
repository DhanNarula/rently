import { chromium } from "playwright";
import type { BrowserContext, Page } from "playwright";
import { Browserbase } from "@browserbasehq/sdk";
import { convex, api } from "@/lib/convex";
import path from "path";
import os from "os";
import fs from "fs";

interface RentalUnit {
  id: string;
  title: string;
  description: string;
  address: string;
  city: string;
  province: string;
  postalCode: string;
  rent: number;
  bedrooms: number;
  bathrooms: number;
  propertyType: string;
  photos: string[];
}

interface Group {
  id: string;
  name: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function humanDelay(min = 900, max = 2000) {
  await new Promise((r) => setTimeout(r, Math.floor(Math.random() * (max - min) + min)));
}

async function screenshot(page: Page, label: string): Promise<string> {
  try {
    const p = path.join(os.tmpdir(), `fb-debug-${label}-${Date.now()}.png`);
    await page.screenshot({ path: p });
    console.log(`[fb] screenshot → ${p}`);
    return p;
  } catch {
    return "";
  }
}

// Creates a Browserbase session, injects saved FB cookies, returns context + closer.
// close() automatically saves all updated Facebook cookies back to the DB so the
// session stays fresh without the user needing to re-paste cookies.
async function openBrowserbaseSession(clerkId: string): Promise<{
  context: BrowserContext;
  close: () => Promise<void>;
}> {
  const account = await convex.query(api.fbAccounts.getByClerkId, { clerkId });
  if (!account?.sessionState) throw new Error("SESSION_EXPIRED");

  let cookies: object[];
  try {
    cookies = JSON.parse(account.sessionState);
    if (!Array.isArray(cookies) || !cookies.length) throw new Error();
  } catch {
    throw new Error("SESSION_EXPIRED");
  }

  const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });
  const session = await bb.sessions.create({
    projectId: process.env.BROWSERBASE_PROJECT_ID!,
  });

  const browser = await chromium.connectOverCDP(session.connectUrl);
  const ctx = browser.contexts()[0] ?? await browser.newContext();

  // Inject the saved Facebook cookies into this fresh cloud browser
  await ctx.addCookies(cookies as Parameters<typeof ctx.addCookies>[0]);

  return {
    context: ctx,
    close: async () => {
      try {
        // Save all updated Facebook cookies back to DB before closing.
        // Facebook refreshes cookie values on every visit — persisting them keeps
        // the session alive without requiring the user to re-paste credentials.
        const updatedCookies = await ctx.cookies([
          "https://www.facebook.com",
          "https://web.facebook.com",
        ]);
        if (updatedCookies.length > 0) {
          await convex.mutation(api.fbAccounts.updateSession, {
            clerkId,
            sessionState: JSON.stringify(updatedCookies),
          });
        }
      } catch (e) {
        console.warn("[fb] could not save updated cookies:", e);
      }
      try { await browser.close(); } catch {}
    },
  };
}

// ── Find & interact with form fields ─────────────────────────────────────────
// Facebook's inputs often don't have aria-label/placeholder matching the visible label.
// Strategy: try Playwright getByLabel/getByPlaceholder first, then positional nth().

async function fillField(page: Page, patterns: RegExp[], value: string): Promise<boolean> {
  // Strategy 1: Playwright's getByLabel / getByPlaceholder — skip any match inside nav/header
  for (const pat of patterns) {
    for (const getter of [
      () => page.getByLabel(pat),
      () => page.getByPlaceholder(pat),
    ]) {
      try {
        const loc = getter();
        const count = await loc.count();
        for (let i = 0; i < count; i++) {
          const el = loc.nth(i);
          const inNav = await el.evaluate((node) => {
            const nav = document.querySelector("nav, header, [role='banner']");
            return nav ? nav.contains(node) : false;
          }).catch(() => false);
          if (inNav) continue;
          if (!await el.isVisible().catch(() => false)) continue;
          await el.click({ timeout: 2000 });
          await el.fill(value);
          return true;
        }
      } catch {}
    }
  }

  // Strategy 2: DOM traversal — find label text, walk up to nearby input, skip nav
  for (const pat of patterns) {
    try {
      const found = await page.evaluate(
        ({ src, val }) => {
          const re = new RegExp(src, "i");
          const nav = document.querySelector("nav, header, [role='banner']");
          for (const label of Array.from(document.querySelectorAll<HTMLElement>("label, span, div"))) {
            if (nav && nav.contains(label)) continue; // never fill from nav labels
            if (!re.test(label.textContent ?? "")) continue;
            const lr = label.getBoundingClientRect();
            if (lr.width === 0) continue;
            let node: HTMLElement | null = label;
            for (let i = 0; i < 6; i++) {
              node = node?.parentElement ?? null;
              if (!node) break;
              if (nav && nav.contains(node)) break; // walked into nav — bail
              const inp = node.querySelector<HTMLInputElement>(
                "input:not([type='hidden']):not([type='file']):not([type='checkbox']):not([type='radio']), textarea"
              );
              if (!inp) continue;
              const ir = inp.getBoundingClientRect();
              if (ir.width === 0) continue;
              inp.focus();
              const setter = Object.getOwnPropertyDescriptor(
                inp.tagName === "TEXTAREA" ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype,
                "value"
              )?.set;
              setter?.call(inp, val);
              inp.dispatchEvent(new InputEvent("input", { bubbles: true, data: val }));
              inp.dispatchEvent(new Event("change", { bubbles: true }));
              return true;
            }
          }
          return false;
        },
        { src: pat.source, val: value }
      );
      if (found) return true;
    } catch {}
  }

  return false;
}

// Keep a simple evaluate-based fill for backward compat (used in evalFill callers)
async function evalFill(page: Page, patterns: RegExp[], value: string): Promise<boolean> {
  return fillField(page, patterns, value);
}

async function evalClickDropdown(page: Page, patterns: RegExp[]): Promise<boolean> {
  return page.evaluate(
    ({ srcs }) => {
      const patterns = srcs.map((s: string) => new RegExp(s, "i"));
      const els = Array.from(
        document.querySelectorAll<HTMLElement>(
          'select, [role="combobox"], [role="button"], [role="listbox"]'
        )
      );
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const hay = [
          el.getAttribute("aria-label") ?? "",
          el.textContent?.trim() ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!patterns.some((p) => p.test(hay))) continue;

        // Native <select>: set value directly
        if (el.tagName === "SELECT") return false; // handled separately
        el.click();
        return true;
      }
      return false;
    },
    { srcs: patterns.map((p) => p.source) }
  );
}

async function evalSelectNative(page: Page, patterns: RegExp[], value: string): Promise<boolean> {
  return page.evaluate(
    ({ srcs, value }) => {
      const patterns = srcs.map((s: string) => new RegExp(s, "i"));
      const selects = Array.from(document.querySelectorAll<HTMLSelectElement>("select"));
      for (const sel of selects) {
        const r = sel.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const hay = (sel.getAttribute("aria-label") ?? "").toLowerCase();
        if (!patterns.some((p) => p.test(hay))) continue;
        const opt = Array.from(sel.options).find(
          (o) => o.value === value || o.text.startsWith(value) || o.text === value
        );
        if (!opt) continue;
        Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(sel, opt.value);
        sel.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }
      return false;
    },
    { srcs: patterns.map((p) => p.source), value }
  );
}

async function evalClickOption(page: Page, pattern: RegExp): Promise<boolean> {
  return page.evaluate(
    ({ src }) => {
      const re = new RegExp(src, "i");
      const opts = Array.from(
        document.querySelectorAll<HTMLElement>('[role="option"], [role="menuitem"]')
      );
      for (const opt of opts) {
        const r = opt.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (re.test(opt.textContent?.trim() ?? "")) {
          opt.click();
          return true;
        }
      }
      return false;
    },
    { src: pattern.source }
  );
}

async function pickDropdown(page: Page, fieldPatterns: RegExp[], optionPattern: RegExp) {
  // Try native select first (faster, no UI interaction needed)
  const nativeDone = await evalSelectNative(page, fieldPatterns, String(optionPattern));
  if (nativeDone) return;

  // Fall back to custom Facebook dropdown
  const opened = await evalClickDropdown(page, fieldPatterns);
  if (!opened) return;
  await humanDelay(700, 1200);
  const picked = await evalClickOption(page, optionPattern);
  if (!picked) await page.keyboard.press("Escape");
  await humanDelay(500, 800);
}

// Dedicated function to select "For Rent" on the Marketplace rental form.
// Tries every strategy we know — this must never silently fail.
async function selectForRent(page: Page): Promise<void> {
  await screenshot(page, "00-before-rent");

  // Strategy 1: Playwright selectOption on every visible select element.
  // This works on native <select> regardless of CSS styling/hiding.
  const selects = page.locator("select");
  const selCount = await selects.count();
  for (let i = 0; i < selCount; i++) {
    try {
      await selects.nth(i).selectOption({ label: "For Rent" });
      console.log("[fb] For Rent: selectOption by label succeeded");
      await humanDelay(700, 1000);
      return;
    } catch {}
    try {
      // Try common option values Facebook uses
      for (const val of ["FOR_RENT", "for_rent", "rent", "RENT", "2"]) {
        try { await selects.nth(i).selectOption(val); return; } catch {}
      }
    } catch {}
  }

  // Strategy 2: JS native setter — set value on any select whose options contain "rent" (not "sale")
  const nativeSet = await page.evaluate(() => {
    for (const sel of Array.from(document.querySelectorAll<HTMLSelectElement>("select"))) {
      const rentOpt = Array.from(sel.options).find(
        (o) => /rent/i.test(o.text) && !/sale/i.test(o.text)
      );
      if (!rentOpt) continue;
      const setter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set;
      setter?.call(sel, rentOpt.value);
      sel.dispatchEvent(new Event("change", { bubbles: true }));
      sel.dispatchEvent(new InputEvent("input", { bubbles: true }));
      return true;
    }
    return false;
  });
  if (nativeSet) { await humanDelay(700, 1000); return; }

  // Strategy 3: Click the dropdown trigger with Playwright text matching, then click option.
  // Use getByText which is more reliable than evaluate-based text search.
  const triggers = [
    page.getByRole("combobox").filter({ hasText: /home for sale or rent/i }),
    page.getByRole("button").filter({ hasText: /home for sale or rent/i }),
    page.locator('[aria-haspopup]').filter({ hasText: /home for sale or rent/i }),
  ];
  for (const trigger of triggers) {
    if (await trigger.count() > 0 && await trigger.first().isVisible({ timeout: 1500 }).catch(() => false)) {
      await trigger.first().click();
      await humanDelay(700, 1200);
      break;
    }
  }

  // Wait for options to appear and click "For Rent"
  const rentOption = page.getByRole("option", { name: /for rent/i }).first();
  if (await rentOption.isVisible({ timeout: 3000 }).catch(() => false)) {
    await rentOption.click();
    console.log("[fb] For Rent: clicked via getByRole option");
    await humanDelay(700, 1000);
    return;
  }

  // Strategy 4: JS click on any visible option/menuitem containing "for rent" text
  const jsClicked = await page.evaluate(() => {
    const candidates = Array.from(document.querySelectorAll<HTMLElement>(
      '[role="option"], [role="menuitem"], [role="listitem"], li, option'
    ));
    for (const el of candidates) {
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const text = (el.textContent ?? "").toLowerCase().trim();
      if (text.includes("for rent") || (text.includes("rent") && !text.includes("sale"))) {
        el.click();
        return true;
      }
    }
    return false;
  });
  if (jsClicked) { await humanDelay(700, 1000); return; }

  // Strategy 5: mouse.click at the pixel coordinates of any element containing "for rent"
  const pos = await page.evaluate(() => {
    const all = Array.from(document.querySelectorAll<HTMLElement>("*"));
    for (const el of all) {
      const r = el.getBoundingClientRect();
      if (r.width < 30 || r.height < 10 || r.top < 50) continue;
      const text = (el.textContent ?? "").toLowerCase().trim();
      if (text === "for rent" || text === "rent") {
        return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      }
    }
    return null;
  });
  if (pos) {
    await page.mouse.click(pos.x, pos.y);
    console.log("[fb] For Rent: clicked via mouse coordinates");
    await humanDelay(700, 1000);
    return;
  }

  console.warn("[fb] WARNING: could not select For Rent — all strategies failed");
  await screenshot(page, "00-rent-select-failed");
}

// Dismiss Facebook's custom "Leave page?" React modal (NOT a browser dialog)
async function closeFbLeavePageModal(page: Page): Promise<void> {
  try {
    const stayBtn = page
      .locator('[role="dialog"] button, [role="dialog"] [role="button"]')
      .filter({ hasText: /stay on page/i })
      .first();
    if (await stayBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await stayBtn.click();
      await humanDelay(700, 1000);
    }
  } catch {}
}

// Scroll the panel that contains the Next button (the scrollable form container)
async function scrollPanel(page: Page, by: number) {
  await page.evaluate((delta) => {
    const btns = Array.from(document.querySelectorAll<HTMLElement>('[role="button"], button'));
    const next = btns.find((b) => b.textContent?.trim() === "Next");
    let el: HTMLElement | null = next?.parentElement ?? null;
    while (el && el !== document.body) {
      if (el.scrollHeight > el.clientHeight + 20) { el.scrollTop += delta; return; }
      el = el.parentElement;
    }
    window.scrollBy(0, delta);
  }, by);
  await humanDelay(500, 900);
}

// Download all photo URLs to temp files and upload them all at once
async function uploadPhotos(page: Page, urls: string[]): Promise<number> {
  const tmpFiles: string[] = [];
  try {
    for (const url of urls) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const ct = res.headers.get("content-type") ?? "image/jpeg";
        const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
        const buf = Buffer.from(await res.arrayBuffer());
        if (buf.length < 1000) continue;
        const tmp = path.join(os.tmpdir(), `rently-photo-${Date.now()}-${tmpFiles.length}.${ext}`);
        fs.writeFileSync(tmp, buf);
        tmpFiles.push(tmp);
      } catch {}
    }

    if (tmpFiles.length === 0) return 0;

    // Find the image-compatible file input (skip video-only inputs)
    const inputs = page.locator('input[type="file"]');
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      const fi = inputs.nth(i);
      const accept = (await fi.getAttribute("accept")) ?? "";
      if (accept && !accept.includes("image") && accept.includes("video")) continue;
      await fi.setInputFiles(tmpFiles); // upload all at once
      return tmpFiles.length;
    }
    return 0;
  } catch {
    return 0;
  } finally {
    for (const f of tmpFiles) try { fs.unlinkSync(f); } catch {}
  }
}

// ── Repair pass: re-fill any blank or invalid fields before retrying Next ─────
async function repairForm(page: Page, unit: RentalUnit): Promise<void> {
  await screenshot(page, "repair-01-before");
  console.log("[fb] repair: scanning for empty/error fields");

  // Collect visible non-nav inputs that are empty or marked invalid
  const issues = await page.evaluate(() => {
    const nav = document.querySelector("nav, header, [role='banner']");
    const results: Array<{ label: string; value: string; hasError: boolean }> = [];
    const inputs = Array.from(document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input:not([type='hidden']):not([type='file']):not([type='checkbox']):not([type='radio']):not([type='email']):not([type='password']), textarea, select"
    ));
    for (const inp of inputs) {
      const r = inp.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      if (nav && nav.contains(inp)) continue;
      const value = inp.value ?? "";
      const hasError = inp.getAttribute("aria-invalid") === "true";
      if (value.trim() !== "" && !hasError) continue;

      // Determine label from aria-label, placeholder, or nearest ancestor text
      let label = inp.getAttribute("aria-label") || inp.getAttribute("placeholder") || "";
      if (!label && inp.id) {
        label = document.querySelector(`label[for="${inp.id}"]`)?.textContent?.trim() ?? "";
      }
      if (!label) {
        let node: HTMLElement | null = inp.parentElement;
        for (let i = 0; i < 5 && node; i++) {
          const t = (node.textContent ?? "").trim();
          if (t && t.length < 80) { label = t.split("\n")[0].trim(); break; }
          node = node.parentElement;
        }
      }
      results.push({ label, value, hasError });
    }
    return results;
  });

  console.log("[fb] repair: issues found:", JSON.stringify(issues));

  // Re-select For Rent if the dropdown is still showing the placeholder
  const rentMissing = await page.evaluate(() => {
    const nav = document.querySelector("nav, header, [role='banner']");
    const els = Array.from(document.querySelectorAll<HTMLElement>(
      '[role="combobox"], [role="button"], select'
    ));
    return els.some((el) => {
      if (nav && nav.contains(el)) return false;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return false;
      return /home for sale or rent/i.test(el.textContent ?? "");
    });
  });
  if (rentMissing) {
    console.log("[fb] repair: re-selecting For Rent");
    await selectForRent(page);
    await humanDelay(700, 1100);
  }

  // Re-fill whichever required fields are empty/errored
  for (const issue of issues) {
    const lbl = issue.label.toLowerCase();
    if (/bedroom/i.test(lbl) && !issue.value) {
      const ok = await evalFill(page, [/bedroom/i], String(unit.bedrooms));
      if (!ok) await pickDropdown(page, [/bedroom/i], new RegExp(`^${unit.bedrooms}\\b`));
      await humanDelay(500, 800);
    } else if (/bathroom/i.test(lbl) && !issue.value) {
      const ok = await evalFill(page, [/bathroom/i], String(unit.bathrooms));
      if (!ok) await pickDropdown(page, [/bathroom/i], new RegExp(`^${unit.bathrooms}\\b`));
      await humanDelay(500, 800);
    } else if (/price|month/i.test(lbl) && !issue.value) {
      await evalFill(page, [/price/i, /month/i], String(unit.rent));
      await humanDelay(500, 800);
    } else if (/description/i.test(lbl) && !issue.value) {
      await evalFill(page, [/description/i], `${unit.title}\n\n${unit.description}`);
      await humanDelay(500, 800);
    }
  }

  await humanDelay(2000, 3000);
  await screenshot(page, "repair-02-after");
}

// ── Marketplace posting ───────────────────────────────────────────────────────

export async function postToMarketplace(
  clerkId: string,
  unit: RentalUnit
): Promise<{ success: boolean; postId?: string; error?: string }> {
  let page: Page | null = null;
  let close: (() => Promise<void>) | null = null;

  try {
    const session = await openBrowserbaseSession(clerkId);
    close = session.close;

    page = await session.context.newPage();

    await page.goto("https://www.facebook.com/marketplace/create/rental", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    // Confirm we're logged in (not redirected to login page)
    await humanDelay(3000, 4500);
    if (page.url().includes("/login") || page.url().includes("login.php")) {
      await close();
      return { success: false, error: "SESSION_EXPIRED" };
    }

    // Wait for the form's Next button — confirms form rendered
    await page
      .locator('[role="button"]:has-text("Next"), button:has-text("Next")')
      .first()
      .waitFor({ timeout: 20_000 })
      .catch(() => {});
    await humanDelay(2500, 3500);

    await screenshot(page, "01-loaded");

    // ── 1. Property type (House / Apartment / etc.) ────────────────────────────
    await pickDropdown(page, [/property type/i], new RegExp(unit.propertyType, "i"));
    await humanDelay(700, 1100);

    // ── 2. For Rent (not For Sale) ────────────────────────────────────────────
    await selectForRent(page);
    await humanDelay(700, 1100);

    // ── 3. Rental type (Entire place / Private room / etc.) ───────────────────
    // This dropdown appears after "For Rent" is selected. Default: Entire place.
    await pickDropdown(page, [/rental type/i, /listing type/i], /entire/i);
    await humanDelay(700, 1100);

    await screenshot(page, "02-after-dropdowns");

    // ── 4. Bedrooms ────────────────────────────────────────────────────────────
    // Use exact FB aria-labels first, never fall back to generic "/bedroom/i" text
    // search which can accidentally match the nav search bar or rental type dropdown.
    const bedFilled = await evalFill(
      page,
      [/^number of bedrooms$/i, /^bedrooms$/i],
      String(unit.bedrooms)
    );
    if (!bedFilled) {
      // Positional fallback: fill the first visible non-nav number/text input
      // that looks like a small-number field (value currently 0-10)
      await page.evaluate((val) => {
        const nav = document.querySelector("nav, header, [role='banner']");
        const inputs = Array.from(document.querySelectorAll<HTMLInputElement>(
          "input:not([type='hidden']):not([type='file']):not([type='checkbox']):not([type='radio']):not([type='email']):not([type='password'])"
        )).filter((inp) => {
          const r = inp.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return false;
          if (nav && nav.contains(inp)) return false;
          // Must look like a bedroom count field: aria-label contains "bedroom"
          const lbl = (inp.getAttribute("aria-label") ?? "").toLowerCase();
          return lbl.includes("bedroom");
        });
        if (!inputs[0]) return false;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(inputs[0], val);
        inputs[0].dispatchEvent(new InputEvent("input", { bubbles: true }));
        inputs[0].dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }, String(unit.bedrooms));
    }
    console.log("[fb] bedrooms filled:", bedFilled);

    await scrollPanel(page, 300);
    await screenshot(page, "03-scroll1");

    // ── 5. Bathrooms ───────────────────────────────────────────────────────────
    const bathFilled = await evalFill(
      page,
      [/^number of bathrooms$/i, /^bathrooms$/i],
      String(unit.bathrooms)
    );
    if (!bathFilled) {
      await page.evaluate((val) => {
        const nav = document.querySelector("nav, header, [role='banner']");
        const inputs = Array.from(document.querySelectorAll<HTMLInputElement>(
          "input:not([type='hidden']):not([type='file']):not([type='checkbox']):not([type='radio']):not([type='email']):not([type='password'])"
        )).filter((inp) => {
          const r = inp.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) return false;
          if (nav && nav.contains(inp)) return false;
          const lbl = (inp.getAttribute("aria-label") ?? "").toLowerCase();
          return lbl.includes("bathroom");
        });
        if (!inputs[0]) return false;
        const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
        setter?.call(inputs[0], val);
        inputs[0].dispatchEvent(new InputEvent("input", { bubbles: true }));
        inputs[0].dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }, String(unit.bathrooms));
    }
    console.log("[fb] bathrooms filled:", bathFilled);

    // ── 6. Price ───────────────────────────────────────────────────────────────
    await evalFill(page, [/price/i, /month/i, /rent/i], String(unit.rent));

    await scrollPanel(page, 300);
    await screenshot(page, "04-scroll2");

    // ── Address ────────────────────────────────────────────────────────────────
    // We find the location input by position: it comes right after the price input.
    // We CANNOT use aria-label/placeholder patterns here — they match Facebook's
    // top search bar instead of the form's location field.
    const locFocused = await page.evaluate((rentVal) => {
      const nav = document.querySelector("nav, header, [role='banner']");
      const inputs = Array.from(
        document.querySelectorAll<HTMLInputElement>(
          "input:not([type='hidden']):not([type='file']):not([type='checkbox']):not([type='radio']):not([type='email']):not([type='password'])"
        )
      ).filter((inp) => {
        const r = inp.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return false;
        if (nav && nav.contains(inp)) return false; // exclude nav search bar
        return true;
      });

      // Find the price input by its current value
      const priceStr = String(rentVal).replace(/[^0-9]/g, "");
      let priceIdx = inputs.findIndex((inp) =>
        inp.value.replace(/[^0-9]/g, "") === priceStr
      );
      if (priceIdx < 0) return false;

      // Location input is right after price
      const locInput = inputs[priceIdx + 1];
      if (!locInput) return false;
      locInput.focus();
      locInput.click();
      return true;
    }, unit.rent);

    if (locFocused) {
      await humanDelay(700, 1000);
      await page.keyboard.type(`${unit.address}, ${unit.city}`, { delay: 120 });
      await humanDelay(2500, 3500); // give autocomplete API time to respond

      await screenshot(page, "05-address-typed");

      const streetName = unit.address.split(",")[0].trim().toLowerCase();
      let suggestionClicked = false;

      // Multiple attempts — the dropdown may not be visible on first check
      for (let attempt = 0; attempt < 4 && !suggestionClicked; attempt++) {
        if (attempt > 0) await humanDelay(1200, 1800);

        // Strategy A: JS-based element click — tries all known suggestion selectors,
        // filtered to elements whose text contains the street name
        const jsClicked = await page.evaluate((street) => {
          const candidates = [
            '[role="option"]',
            '[role="listbox"] > *',
            '[role="listbox"] li',
            '[role="listbox"] div',
            'li[aria-selected]',
            'ul li',
          ].flatMap((sel) => Array.from(document.querySelectorAll<HTMLElement>(sel)));

          for (const el of candidates) {
            const r = el.getBoundingClientRect();
            if (r.width === 0 || r.height === 0 || r.top < 50) continue;
            const text = (el.textContent ?? "").toLowerCase();
            if (text.includes(street) && text.length < 300) {
              el.click();
              return true;
            }
          }
          return false;
        }, streetName);

        if (jsClicked) {
          suggestionClicked = true;
          break;
        }

        // Strategy B: mouse.click at the pixel position of a matching visible element
        // (more reliable than Playwright's .click() which checks enabled/visible state)
        const pos = await page.evaluate((street) => {
          const all = Array.from(document.querySelectorAll<HTMLElement>("*"));
          for (const el of all) {
            const r = el.getBoundingClientRect();
            // Must look like a dropdown row: reasonable width/height, below the nav
            if (r.width < 100 || r.height < 10 || r.height > 80 || r.top < 100) continue;
            const text = (el.textContent ?? "").toLowerCase();
            if (text.includes(street) && text.length < 200) {
              return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
            }
          }
          return null;
        }, streetName);

        if (pos) {
          await page.mouse.click(pos.x, pos.y);
          suggestionClicked = true;
          break;
        }
      }

      if (!suggestionClicked) {
        // Last resort keyboard: ArrowDown highlights first suggestion, Enter confirms it
        // (Enter is safe here because a suggestion is highlighted — it selects, not navigates)
        await page.keyboard.press("ArrowDown");
        await humanDelay(800, 1100);
        await page.keyboard.press("Enter");
        await humanDelay(1000, 1500);
        await closeFbLeavePageModal(page);
        console.log("[fb] address: used ArrowDown+Enter fallback");
      }

      await humanDelay(1200, 1800);
      console.log("[fb] suggestion clicked:", suggestionClicked);
    }
    console.log("[fb] location focused:", locFocused);

    // Dismiss Facebook's "Leave page?" modal if it appeared
    await closeFbLeavePageModal(page);

    await scrollPanel(page, 300);
    await screenshot(page, "06-scroll3");

    // ── Description ────────────────────────────────────────────────────────────
    const descFilled = await evalFill(page, [/description/i], `${unit.title}\n\n${unit.description}`);
    await screenshot(page, "07-after-desc");
    console.log("[fb] description filled:", descFilled);

    // ── Photos ─────────────────────────────────────────────────────────────────
    if (unit.photos.length > 0) {
      const uploaded = await uploadPhotos(page, unit.photos);
      console.log(`[fb] uploaded ${uploaded} photos`);
      await humanDelay(8000, 11000); // wait for all photos to process
    }

    await screenshot(page, "08-before-next");

    // ── Next ───────────────────────────────────────────────────────────────────
    const nextBtn = page
      .locator('[role="button"]:has-text("Next"), button:has-text("Next")')
      .first();
    if (!(await nextBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      const sp = await screenshot(page, "no-next");
      await close();
      return { success: false, error: `Next button not found. Screenshot: ${sp}` };
    }

    const isNextEnabled = () => page!.evaluate(() => {
      const btns = Array.from(document.querySelectorAll<HTMLElement>('[role="button"], button'));
      const next = btns.find((b) => b.textContent?.trim() === "Next" || b.getAttribute("aria-label") === "Next");
      return next ? next.getAttribute("aria-disabled") !== "true" : false;
    });

    // Wait up to 15s for button to become enabled naturally (photo processing)
    await page.waitForFunction(
      () => {
        const btns = Array.from(document.querySelectorAll<HTMLElement>('[role="button"], button'));
        const next = btns.find((b) => b.textContent?.trim() === "Next" || b.getAttribute("aria-label") === "Next");
        return next && next.getAttribute("aria-disabled") !== "true";
      },
      { timeout: 15_000 }
    ).catch(() => {});

    // If still disabled, repair blank/invalid fields and wait again
    if (!await isNextEnabled()) {
      console.log("[fb] Next still disabled — running repair pass");
      await repairForm(page, unit);
      await page.waitForFunction(
        () => {
          const btns = Array.from(document.querySelectorAll<HTMLElement>('[role="button"], button'));
          const next = btns.find((b) => b.textContent?.trim() === "Next" || b.getAttribute("aria-label") === "Next");
          return next && next.getAttribute("aria-disabled") !== "true";
        },
        { timeout: 10_000 }
      ).catch(() => {});
    }

    if (await isNextEnabled()) {
      await nextBtn.click();
    } else {
      // JS dispatch bypasses aria-disabled — React still receives the click
      console.log("[fb] Next still disabled after repair — forcing JS click");
      await page.evaluate(() => {
        const btns = Array.from(document.querySelectorAll<HTMLElement>('[role="button"], button'));
        const next = btns.find((b) => b.textContent?.trim() === "Next" || b.getAttribute("aria-label") === "Next");
        next?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));
      });
    }
    await humanDelay(4000, 5500);
    await screenshot(page, "09-after-next");

    // ── Publish (click through any intermediate Next steps) ────────────────────
    let publishClicked = false;
    for (let i = 0; i < 5 && !publishClicked; i++) {
      const pub = page
        .locator('[role="button"]:has-text("Publish"), button:has-text("Publish")')
        .first();
      if (await pub.isVisible({ timeout: 3000 }).catch(() => false)) {
        await pub.click();
        publishClicked = true;
        await humanDelay(6000, 9000);
        break;
      }
      const again = page
        .locator('[role="button"]:has-text("Next"), button:has-text("Next")')
        .first();
      if (await again.isVisible({ timeout: 2000 }).catch(() => false)) {
        await again.click();
        await humanDelay(3000, 4500);
        await screenshot(page, `10-next-${i}`);
      } else {
        break;
      }
    }

    if (!publishClicked) {
      const sp = await screenshot(page, "no-publish");
      await close();
      return { success: false, error: `Publish button not found. Screenshot: ${sp}` };
    }

    await humanDelay(5000, 7000);

    // Facebook often shows a "Boost your listing" modal after publishing — close it
    const closeBoostBtn = page
      .locator('button:has-text("Close"), [role="button"]:has-text("Close")')
      .first();
    if (await closeBoostBtn.isVisible({ timeout: 4000 }).catch(() => false)) {
      await closeBoostBtn.click();
      await humanDelay(3000, 4500);
    }

    await screenshot(page, "08-after-publish");

    // Try to get post ID from the current URL
    let postId = page.url().match(/\/item\/(\d+)/)?.[1];

    // If URL is /selling or similar, find the listing link on the page
    if (!postId) {
      postId = await page.evaluate(() => {
        const links = Array.from(document.querySelectorAll<HTMLAnchorElement>('a[href*="/marketplace/item/"]'));
        for (const a of links) {
          const m = a.href.match(/\/item\/(\d+)/);
          if (m) return m[1];
        }
        return null;
      }) ?? undefined;
    }

    await close();
    // Even without a post ID, if we reached the selling/confirmation page it succeeded
    const onSellingPage = page.url().includes("/marketplace/") || page.url().includes("/selling");
    if (!postId && !onSellingPage) {
      const sp = await screenshot(page, "no-postid");
      return { success: false, error: `No confirmation. Ended at: ${page.url()}. Screenshot: ${sp}` };
    }

    return { success: true, postId };
  } catch (err) {
    await close?.();
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "SESSION_EXPIRED") return { success: false, error: "SESSION_EXPIRED" };
    return { success: false, error: msg };
  }
}

// ── Group posting ─────────────────────────────────────────────────────────────

export async function postToGroups(
  clerkId: string,
  unit: RentalUnit,
  groups: Group[]
): Promise<{ groupId: string; success: boolean; error?: string }[]> {
  let page: Page | null = null;
  let close: (() => Promise<void>) | null = null;
  const results: { groupId: string; success: boolean; error?: string }[] = [];

  try {
    const session = await openBrowserbaseSession(clerkId);
    close = session.close;

    page = await session.context.newPage();
    const postText = `🏠 ${unit.title}\n\n💰 $${unit.rent}/month\n🛏 ${unit.bedrooms} bed | 🛁 ${unit.bathrooms} bath\n📍 ${unit.address}, ${unit.city}, ${unit.province}\n\n${unit.description}`;

    for (const group of groups) {
      try {
        await page.goto(`https://www.facebook.com/groups/${group.id}`, {
          waitUntil: "domcontentloaded",
          timeout: 20_000,
        });
        await humanDelay(3000, 5000);

        const writeBox = page
          .locator([
            'div[data-pagelet="GroupComposer"] div[role="button"]',
            'div[aria-placeholder*="Write something"]',
            'div[aria-label*="Write something"]',
          ].join(", "))
          .first();
        if (await writeBox.isVisible({ timeout: 5000 }).catch(() => false)) {
          await writeBox.click();
          await humanDelay(1500, 2800);
        }

        const textArea = page.locator('div[role="textbox"][contenteditable="true"]').first();
        if (!(await textArea.isVisible({ timeout: 5000 }).catch(() => false))) {
          results.push({ groupId: group.id, success: false, error: "Composer not found — are you a member?" });
          continue;
        }

        await textArea.click();
        await humanDelay();
        await textArea.fill(postText);
        await humanDelay(1500, 2800);

        if (unit.photos.length > 0) {
          try {
            const photoBtn = page
              .locator('[aria-label*="Photo/Video"], span:has-text("Photo/Video")')
              .first();
            if (await photoBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
              await photoBtn.click();
              await humanDelay(1500, 2200);
              await uploadPhotos(page, unit.photos.slice(0, 1));
              await humanDelay(3000, 4500);
            }
          } catch {}
        }

        const postBtn = page
          .locator('[aria-label="Post"], button:has-text("Post"), div[role="button"]:has-text("Post")')
          .first();
        if (await postBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await postBtn.click();
          await humanDelay(5000, 7000);
          results.push({ groupId: group.id, success: true });
        } else {
          const sp = await screenshot(page, `group-${group.id}`);
          results.push({ groupId: group.id, success: false, error: `Post button not found. Screenshot: ${sp}` });
        }
      } catch (err) {
        results.push({
          groupId: group.id,
          success: false,
          error: err instanceof Error ? err.message : "Unknown",
        });
      }
      await humanDelay(5000, 8000);
    }

    await close();
    return results;
  } catch (err) {
    await close?.();
    const msg = err instanceof Error ? err.message : "Unknown";
    const error = msg === "SESSION_EXPIRED" ? "SESSION_EXPIRED" : msg;
    return groups.map((g) => ({ groupId: g.id, success: false, error }));
  }
}
