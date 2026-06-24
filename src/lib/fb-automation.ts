import { chromium } from "playwright";
import type { BrowserContext, Page } from "playwright";
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

async function humanDelay(min = 600, max = 1400) {
  await new Promise((r) => setTimeout(r, Math.floor(Math.random() * (max - min) + min)));
}

async function screenshot(page: Page, label: string): Promise<string> {
  try {
    const p = path.join(os.tmpdir(), `fb-debug-${label}-${Date.now()}.png`);
    await page.screenshot({ path: p, fullPage: false });
    console.log(`[fb] screenshot → ${p}`);
    return p;
  } catch {
    return "";
  }
}

async function connectChrome(): Promise<BrowserContext> {
  try {
    const browser = await chromium.connectOverCDP("http://localhost:9222", { timeout: 10_000 });
    const contexts = browser.contexts();
    if (!contexts.length) throw new Error();
    return contexts[0];
  } catch {
    throw new Error("CHROME_NOT_RUNNING");
  }
}

async function isFbLoggedIn(context: BrowserContext): Promise<boolean> {
  try {
    const cookies = await context.cookies(["https://www.facebook.com"]);
    return cookies.some((c) => c.name === "c_user") && cookies.some((c) => c.name === "xs");
  } catch {
    return false;
  }
}

// ── Dump every visible interactive element to a JSON file ─────────────────────
// Read ~/.rently/form-dump-*.json to see what the actual DOM contains.
async function dumpForm(page: Page) {
  try {
    const rows = await page.evaluate(() =>
      Array.from(
        document.querySelectorAll<HTMLElement>(
          'input, textarea, select, [role="combobox"], [role="textbox"], [role="spinbutton"], [role="button"]'
        )
      )
        .filter((el) => {
          const r = el.getBoundingClientRect();
          return r.width > 0 && r.height > 0;
        })
        .map((el) => ({
          tag: el.tagName.toLowerCase(),
          role: el.getAttribute("role"),
          type: (el as HTMLInputElement).type || null,
          label: el.getAttribute("aria-label"),
          placeholder: (el as HTMLInputElement).placeholder || null,
          text: el.textContent?.replace(/\s+/g, " ").trim().slice(0, 80) || null,
        }))
    );
    const outDir = path.join(os.homedir(), ".rently");
    fs.mkdirSync(outDir, { recursive: true });
    const p = path.join(outDir, `form-dump-${Date.now()}.json`);
    fs.writeFileSync(p, JSON.stringify(rows, null, 2));
    console.log(`[fb] form dump → ${p}`);
  } catch {}
}

// ── Scroll the scrollable panel that contains the "Next" button ───────────────
async function scrollPanel(page: Page, by: number) {
  await page.evaluate((delta) => {
    const btns = Array.from(document.querySelectorAll<HTMLElement>('[role="button"], button'));
    const next = btns.find((b) => b.textContent?.trim() === "Next");
    if (!next) return;
    let el: HTMLElement | null = next.parentElement;
    while (el && el !== document.body) {
      if (el.scrollHeight > el.clientHeight + 20) {
        el.scrollTop += delta;
        return;
      }
      el = el.parentElement;
    }
    window.scrollBy(0, delta);
  }, by);
  await humanDelay(300, 500);
}

// ── Find a visible element whose aria-label/placeholder/text matches any pattern
// and fill it (native input/textarea) or click it (combobox/button).
// Returns "filled" | "clicked" | "not-found".
async function findAndAct(
  page: Page,
  patterns: RegExp[],
  action: "fill",
  value: string
): Promise<"filled" | "clicked" | "not-found">;
async function findAndAct(
  page: Page,
  patterns: RegExp[],
  action: "click"
): Promise<"filled" | "clicked" | "not-found">;
async function findAndAct(
  page: Page,
  patterns: RegExp[],
  action: "fill" | "click",
  value?: string
): Promise<"filled" | "clicked" | "not-found"> {
  const result = await page.evaluate(
    ({ patternSources, action, value }) => {
      const patterns = patternSources.map((s) => new RegExp(s, "i"));
      const candidates = Array.from(
        document.querySelectorAll<HTMLElement>(
          'input, textarea, select, [role="combobox"], [role="textbox"], [role="spinbutton"], [role="button"]'
        )
      );

      for (const el of candidates) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;

        const haystack = [
          el.getAttribute("aria-label") ?? "",
          (el as HTMLInputElement).placeholder ?? "",
          el.textContent?.trim() ?? "",
        ]
          .join(" ")
          .toLowerCase();

        if (!patterns.some((re) => re.test(haystack))) continue;

        const tag = el.tagName.toLowerCase();
        const role = el.getAttribute("role") ?? "";

        if (action === "fill" && value !== undefined) {
          if (tag === "select") {
            const sel = el as HTMLSelectElement;
            const opt = Array.from(sel.options).find(
              (o) => o.value === value || o.text.startsWith(value)
            );
            if (opt) {
              Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value")?.set?.call(
                sel,
                opt.value
              );
              sel.dispatchEvent(new Event("change", { bubbles: true }));
              return "filled";
            }
          } else if (tag === "input" || tag === "textarea") {
            const inp = el as HTMLInputElement;
            Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set?.call(
              inp,
              value
            );
            inp.dispatchEvent(new Event("input", { bubbles: true }));
            inp.dispatchEvent(new Event("change", { bubbles: true }));
            return "filled";
          } else if (role === "textbox") {
            el.focus();
            document.execCommand("selectAll", false);
            document.execCommand("insertText", false, value);
            return "filled";
          }
        }

        el.click();
        return "clicked";
      }
      return "not-found";
    },
    {
      patternSources: patterns.map((p) => p.source),
      action,
      value: value ?? "",
    }
  );
  return result as "filled" | "clicked" | "not-found";
}

// Click an option inside an open dropdown that matches the pattern.
async function clickOption(page: Page, pattern: RegExp): Promise<boolean> {
  return page.evaluate((src) => {
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
  }, pattern.source);
}

// Open a custom dropdown and select an option.
async function pickDropdown(
  page: Page,
  fieldPatterns: RegExp[],
  optionPattern: RegExp
): Promise<boolean> {
  const res = await findAndAct(page, fieldPatterns, "click");
  if (res === "not-found") return false;
  await humanDelay(500, 900);
  const picked = await clickOption(page, optionPattern);
  if (!picked) await page.keyboard.press("Escape");
  await humanDelay(300, 600);
  return picked;
}

// Upload the first photo via temp file — avoids buffer/mime guessing issues.
async function uploadPhoto(page: Page, url: string): Promise<boolean> {
  let tmpPath: string | null = null;
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    const ct = res.headers.get("content-type") ?? "image/jpeg";
    const ext = ct.includes("png") ? "png" : ct.includes("webp") ? "webp" : "jpg";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length < 1000) return false; // sanity check — empty buffer = bad URL
    tmpPath = path.join(os.tmpdir(), `rently-photo-${Date.now()}.${ext}`);
    fs.writeFileSync(tmpPath, buf);

    // Prefer image-only file input; avoid video-only inputs
    const inputs = page.locator('input[type="file"]');
    const count = await inputs.count();
    for (let i = 0; i < count; i++) {
      const fi = inputs.nth(i);
      const accept = (await fi.getAttribute("accept")) ?? "";
      // Skip inputs that only accept video
      if (accept && !accept.includes("image") && accept.includes("video")) continue;
      await fi.setInputFiles(tmpPath);
      return true;
    }
    return false;
  } catch {
    return false;
  } finally {
    if (tmpPath) try { fs.unlinkSync(tmpPath); } catch {}
  }
}

export async function postToMarketplace(
  _clerkId: string,
  unit: RentalUnit
): Promise<{ success: boolean; postId?: string; error?: string }> {
  let page: Page | null = null;

  try {
    const context = await connectChrome();
    if (!(await isFbLoggedIn(context))) return { success: false, error: "SESSION_EXPIRED" };

    page = await context.newPage();

    await page.goto("https://www.facebook.com/marketplace/create/rental", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    // Wait until the Next button appears — confirms the form rendered
    await page
      .locator('[role="button"]:has-text("Next"), button:has-text("Next")')
      .first()
      .waitFor({ timeout: 20_000 })
      .catch(() => {});
    await humanDelay(2000, 3000);

    // Dump the form structure so we can see exactly what elements exist
    await dumpForm(page);
    await screenshot(page, "01-loaded");

    // ── Property type ──────────────────────────────────────────────────────────
    await pickDropdown(
      page,
      [/property type/i],
      /apartment|condo/i
    );
    await screenshot(page, "02-prop-type");

    // ── Bedrooms ───────────────────────────────────────────────────────────────
    // Try fill first (text input), then dropdown
    const bedFilled = await findAndAct(page, [/bedroom/i], "fill", String(unit.bedrooms));
    if (bedFilled === "not-found" || bedFilled === "clicked") {
      await pickDropdown(page, [/bedroom/i], new RegExp(`^${unit.bedrooms}\\b`));
    }
    await screenshot(page, "03-bedrooms");

    // ── Scroll to reveal bathrooms, price, address, description ───────────────
    await scrollPanel(page, 300);
    await humanDelay(600, 1000);
    await screenshot(page, "04-scroll1");

    // ── Bathrooms ──────────────────────────────────────────────────────────────
    const bathFilled = await findAndAct(page, [/bathroom/i], "fill", String(unit.bathrooms));
    if (bathFilled === "not-found" || bathFilled === "clicked") {
      await pickDropdown(page, [/bathroom/i], new RegExp(`^${unit.bathrooms}\\b`));
    }

    // ── Rent / Price ───────────────────────────────────────────────────────────
    await findAndAct(page, [/price/i, /rent/i, /month/i], "fill", String(unit.rent));

    await scrollPanel(page, 300);
    await humanDelay(600, 1000);
    await screenshot(page, "05-scroll2");

    // ── Address / Location ─────────────────────────────────────────────────────
    const addrFilled = await findAndAct(
      page,
      [/address/i, /location/i, /city/i],
      "fill",
      `${unit.address}, ${unit.city}, ${unit.province}`
    );
    if (addrFilled === "filled") {
      await humanDelay(1500, 2500);
      // Accept the first autocomplete suggestion
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
    await humanDelay(600, 1000);
    await screenshot(page, "06-scroll3");

    // ── Description ────────────────────────────────────────────────────────────
    await findAndAct(
      page,
      [/description/i],
      "fill",
      `${unit.title}\n\n${unit.description}`
    );

    // ── Photos ─────────────────────────────────────────────────────────────────
    if (unit.photos.length > 0) {
      await uploadPhoto(page, unit.photos[0]);
      await humanDelay(2000, 3000);
    }

    await screenshot(page, "07-before-next");

    // ── Next ───────────────────────────────────────────────────────────────────
    const nextBtn = page
      .locator('[role="button"]:has-text("Next"), button:has-text("Next")')
      .first();
    if (!(await nextBtn.isVisible({ timeout: 5000 }).catch(() => false))) {
      const sp = await screenshot(page, "no-next");
      await page.close();
      return { success: false, error: `Next button not found. Screenshot: ${sp}` };
    }
    await nextBtn.click();
    await humanDelay(2500, 3500);
    await screenshot(page, "08-after-next");

    // ── Publish (may take multiple Next clicks) ────────────────────────────────
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
      const nextAgain = page
        .locator('[role="button"]:has-text("Next"), button:has-text("Next")')
        .first();
      if (await nextAgain.isVisible({ timeout: 2000 }).catch(() => false)) {
        await nextAgain.click();
        await humanDelay(2000, 3000);
        await screenshot(page, `09-next-${i}`);
      } else {
        break;
      }
    }

    if (!publishClicked) {
      const sp = await screenshot(page, "no-publish");
      await page.close();
      return {
        success: false,
        error: `Publish button not found. Screenshot: ${sp}`,
      };
    }

    await humanDelay(3000, 5000);
    const finalUrl = page.url();
    const postId = finalUrl.match(/\/item\/(\d+)/)?.[1];

    if (!postId) {
      const sp = await screenshot(page, "no-postid");
      await page.close();
      return {
        success: false,
        error: `Submitted but confirmation URL missing. Ended at: ${finalUrl}. Screenshot: ${sp}`,
      };
    }

    await page.close();
    return { success: true, postId };
  } catch (err) {
    await page?.close().catch(() => {});
    const msg = err instanceof Error ? err.message : "Unknown error";
    if (msg === "CHROME_NOT_RUNNING") return { success: false, error: "SESSION_EXPIRED" };
    return { success: false, error: msg };
  }
}

export async function postToGroups(
  _clerkId: string,
  unit: RentalUnit,
  groups: Group[]
): Promise<{ groupId: string; success: boolean; error?: string }[]> {
  let page: Page | null = null;
  const results: { groupId: string; success: boolean; error?: string }[] = [];

  try {
    const context = await connectChrome();
    if (!(await isFbLoggedIn(context))) {
      return groups.map((g) => ({ groupId: g.id, success: false, error: "SESSION_EXPIRED" }));
    }

    page = await context.newPage();
    const postText = `🏠 ${unit.title}\n\n💰 $${unit.rent}/month\n🛏 ${unit.bedrooms} bed | 🛁 ${unit.bathrooms} bath\n📍 ${unit.address}, ${unit.city}, ${unit.province}\n\n${unit.description}`;

    for (const group of groups) {
      try {
        await page.goto(`https://www.facebook.com/groups/${group.id}`, {
          waitUntil: "domcontentloaded",
          timeout: 20_000,
        });
        await humanDelay(2000, 3500);

        const writeBox = page
          .locator(
            [
              'div[data-pagelet="GroupComposer"] div[role="button"]',
              'div[aria-placeholder*="Write something"]',
              'div[aria-label*="Write something"]',
            ].join(", ")
          )
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
            const photoBtn = page.locator('[aria-label*="Photo/Video"], span:has-text("Photo/Video")').first();
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

    await page.close();
    return results;
  } catch (err) {
    await page?.close().catch(() => {});
    const msg = err instanceof Error ? err.message : "Unknown";
    const error = msg === "CHROME_NOT_RUNNING" ? "SESSION_EXPIRED" : msg;
    return groups.map((g) => ({ groupId: g.id, success: false, error }));
  }
}
