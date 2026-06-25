import { chromium } from "playwright";
import type { BrowserContext, Page } from "playwright";
import { Browserbase } from "@browserbasehq/sdk";
import { prisma } from "@/lib/prisma";
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
  photos: string[];
}

interface Group {
  id: string;
  name: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function humanDelay(min = 600, max = 1400) {
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
async function openBrowserbaseSession(clerkId: string): Promise<{
  context: BrowserContext;
  close: () => Promise<void>;
}> {
  const account = await prisma.fbAccount.findUnique({ where: { clerkId } });
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
      try { await browser.close(); } catch {}
    },
  };
}

// ── Find & interact with form fields via page.evaluate ────────────────────────
// Uses the live DOM — works regardless of React component wrappers or aria-label names.

async function evalFill(page: Page, patterns: RegExp[], value: string): Promise<boolean> {
  return page.evaluate(
    ({ srcs, value }) => {
      const patterns = srcs.map((s: string) => new RegExp(s, "i"));
      const els = Array.from(
        document.querySelectorAll<HTMLElement>(
          'input, textarea, [role="textbox"], [role="spinbutton"]'
        )
      );
      for (const el of els) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        const hay = [
          el.getAttribute("aria-label") ?? "",
          (el as HTMLInputElement).placeholder ?? "",
        ]
          .join(" ")
          .toLowerCase();
        if (!patterns.some((p) => p.test(hay))) continue;

        if (el.tagName === "INPUT" || el.tagName === "TEXTAREA") {
          const inp = el as HTMLInputElement;
          Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(inp, value);
          inp.dispatchEvent(new Event("input", { bubbles: true }));
          inp.dispatchEvent(new Event("change", { bubbles: true }));
          return true;
        }
        if (el.getAttribute("role") === "textbox") {
          el.focus();
          document.execCommand("selectAll", false);
          document.execCommand("insertText", false, value);
          return true;
        }
      }
      return false;
    },
    { srcs: patterns.map((p) => p.source), value }
  );
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
  await humanDelay(400, 800);
  const picked = await evalClickOption(page, optionPattern);
  if (!picked) await page.keyboard.press("Escape");
  await humanDelay(300, 500);
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
  await humanDelay(300, 500);
}

// Write photo to temp file and set on the first image-compatible file input
async function uploadPhoto(page: Page, url: string): Promise<boolean> {
  let tmp: string | null = null;
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000) return false;
    tmp = path.join(os.tmpdir(), `rently-photo-${Date.now()}.${ext}`);
    fs.writeFileSync(tmp, buf);

    const inputs = page.locator('input[type="file"]');
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      const fi = inputs.nth(i);
      const accept = (await fi.getAttribute("accept")) ?? "";
      if (accept && !accept.includes("image") && accept.includes("video")) continue;
      await fi.setInputFiles(tmp);
      return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    if (tmp) try { fs.unlinkSync(tmp); } catch {}
  }
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
    await humanDelay(2000, 3000);
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
    await humanDelay(1500, 2500);

    await screenshot(page, "01-loaded");

    // ── Property type ──────────────────────────────────────────────────────────
    await pickDropdown(page, [/property type/i], /apartment|condo/i);

    // ── Bedrooms ───────────────────────────────────────────────────────────────
    const bedFilled = await evalFill(page, [/bedroom/i], String(unit.bedrooms));
    if (!bedFilled) await pickDropdown(page, [/bedroom/i], new RegExp(`^${unit.bedrooms}\\b`));

    await scrollPanel(page, 300);
    await screenshot(page, "02-scroll1");

    // ── Bathrooms ──────────────────────────────────────────────────────────────
    const bathFilled = await evalFill(page, [/bathroom/i], String(unit.bathrooms));
    if (!bathFilled) await pickDropdown(page, [/bathroom/i], new RegExp(`^${unit.bathrooms}\\b`));

    // ── Rent ───────────────────────────────────────────────────────────────────
    await evalFill(page, [/price/i, /month/i, /rent/i], String(unit.rent));

    await scrollPanel(page, 300);
    await screenshot(page, "03-scroll2");

    // ── Address ────────────────────────────────────────────────────────────────
    const addrFilled = await evalFill(
      page,
      [/address/i, /location/i, /city/i],
      `${unit.address}, ${unit.city}, ${unit.province}`
    );
    if (addrFilled) {
      await humanDelay(1500, 2500);
      const suggestion = page.locator('[role="option"]').first();
      if (await suggestion.isVisible({ timeout: 4000 }).catch(() => false)) {
        await suggestion.click();
      } else {
        await page.keyboard.press("ArrowDown");
        await page.keyboard.press("Enter");
      }
      await humanDelay(500, 800);
    }

    await scrollPanel(page, 300);
    await screenshot(page, "04-scroll3");

    // ── Description ────────────────────────────────────────────────────────────
    await evalFill(page, [/description/i], `${unit.title}\n\n${unit.description}`);

    // ── Photos ─────────────────────────────────────────────────────────────────
    if (unit.photos.length > 0) {
      await uploadPhoto(page, unit.photos[0]);
      await humanDelay(2000, 3000);
    }

    await screenshot(page, "05-before-next");

    // ── Next ───────────────────────────────────────────────────────────────────
    const nextBtn = page
      .locator('[role="button"]:has-text("Next"), button:has-text("Next")')
      .first();
    if (!(await nextBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      const sp = await screenshot(page, "no-next");
      await close();
      return { success: false, error: `Next button not found. Screenshot: ${sp}` };
    }
    await nextBtn.click();
    await humanDelay(2500, 3500);
    await screenshot(page, "06-after-next");

    // ── Publish (click through any intermediate Next steps) ────────────────────
    let publishClicked = false;
    for (let i = 0; i < 5 && !publishClicked; i++) {
      const pub = page
        .locator('[role="button"]:has-text("Publish"), button:has-text("Publish")')
        .first();
      if (await pub.isVisible({ timeout: 3000 }).catch(() => false)) {
        await pub.click();
        publishClicked = true;
        await humanDelay(4000, 6000);
        break;
      }
      const again = page
        .locator('[role="button"]:has-text("Next"), button:has-text("Next")')
        .first();
      if (await again.isVisible({ timeout: 2000 }).catch(() => false)) {
        await again.click();
        await humanDelay(2000, 3000);
        await screenshot(page, `07-next-${i}`);
      } else {
        break;
      }
    }

    if (!publishClicked) {
      const sp = await screenshot(page, "no-publish");
      await close();
      return { success: false, error: `Publish button not found. Screenshot: ${sp}` };
    }

    await humanDelay(3000, 5000);
    const finalUrl = page.url();
    const postId = finalUrl.match(/\/item\/(\d+)/)?.[1];

    if (!postId) {
      const sp = await screenshot(page, "no-postid");
      await close();
      return {
        success: false,
        error: `Submitted but no confirmation URL. Ended at: ${finalUrl}. Screenshot: ${sp}`,
      };
    }

    await close();
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
        await humanDelay(2000, 3500);

        const writeBox = page
          .locator([
            'div[data-pagelet="GroupComposer"] div[role="button"]',
            'div[aria-placeholder*="Write something"]',
            'div[aria-label*="Write something"]',
          ].join(", "))
          .first();
        if (await writeBox.isVisible({ timeout: 5000 }).catch(() => false)) {
          await writeBox.click();
          await humanDelay(1000, 2000);
        }

        const textArea = page.locator('div[role="textbox"][contenteditable="true"]').first();
        if (!(await textArea.isVisible({ timeout: 5000 }).catch(() => false))) {
          results.push({ groupId: group.id, success: false, error: "Composer not found — are you a member?" });
          continue;
        }

        await textArea.click();
        await humanDelay();
        await textArea.fill(postText);
        await humanDelay(1000, 2000);

        if (unit.photos.length > 0) {
          try {
            const photoBtn = page
              .locator('[aria-label*="Photo/Video"], span:has-text("Photo/Video")')
              .first();
            if (await photoBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
              await photoBtn.click();
              await humanDelay(1000, 1500);
              await uploadPhoto(page, unit.photos[0]);
              await humanDelay(2000, 3000);
            }
          } catch {}
        }

        const postBtn = page
          .locator('[aria-label="Post"], button:has-text("Post"), div[role="button"]:has-text("Post")')
          .first();
        if (await postBtn.isVisible({ timeout: 5000 }).catch(() => false)) {
          await postBtn.click();
          await humanDelay(3000, 5000);
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
      await humanDelay(3000, 6000);
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
