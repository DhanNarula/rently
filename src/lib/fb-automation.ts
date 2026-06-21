import { chromium, Browser, Page } from "playwright";

interface FbCredentials {
  email: string;
  password: string;
}

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

async function humanDelay(min = 800, max = 2200) {
  const ms = Math.floor(Math.random() * (max - min) + min);
  await new Promise((r) => setTimeout(r, ms));
}

async function loginToFacebook(page: Page, credentials: FbCredentials): Promise<boolean> {
  try {
    await page.goto("https://www.facebook.com/login", { waitUntil: "domcontentloaded", timeout: 30000 });
    await humanDelay();

    await page.fill("#email", credentials.email);
    await humanDelay(400, 900);
    await page.fill("#pass", credentials.password);
    await humanDelay(500, 1200);
    await page.click('[name="login"]');

    await page.waitForURL(/facebook\.com\/(home|feed|\?|$)/, { timeout: 15000 }).catch(() => {});
    await humanDelay(2000, 3500);

    // Check if login succeeded
    const url = page.url();
    if (url.includes("login") || url.includes("checkpoint")) {
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

export async function postToMarketplace(
  credentials: FbCredentials,
  unit: RentalUnit
): Promise<{ success: boolean; postId?: string; error?: string }> {
  let browser: Browser | null = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
    });

    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });

    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    const loggedIn = await loginToFacebook(page, credentials);
    if (!loggedIn) {
      return { success: false, error: "Login failed — check your Facebook credentials in Settings." };
    }

    await page.goto("https://www.facebook.com/marketplace/create/rental", { waitUntil: "domcontentloaded", timeout: 30000 });
    await humanDelay(2000, 3500);

    // Upload photos
    for (const photoUrl of unit.photos.slice(0, 10)) {
      try {
        const fileInput = page.locator('input[type="file"]').first();
        if (await fileInput.isVisible()) {
          const response = await fetch(photoUrl);
          const buffer = Buffer.from(await response.arrayBuffer());
          const filename = `photo_${Date.now()}.jpg`;
          await fileInput.setInputFiles({ name: filename, mimeType: "image/jpeg", buffer });
          await humanDelay(1500, 2500);
        }
      } catch {}
    }

    // Fill property type — Apartment/Condo
    try {
      const propertyTypeBtn = page.locator('div[aria-label="Property type"]').first();
      if (await propertyTypeBtn.isVisible()) {
        await propertyTypeBtn.click();
        await humanDelay();
        await page.locator('div[role="option"]').filter({ hasText: /apartment|condo/i }).first().click();
        await humanDelay();
      }
    } catch {}

    // Fill rent
    const rentInput = page.locator('input[placeholder*="price" i], input[aria-label*="price" i], input[aria-label*="rent" i]').first();
    if (await rentInput.isVisible()) {
      await rentInput.fill(String(unit.rent));
      await humanDelay();
    }

    // Fill address
    const addressInput = page.locator('input[placeholder*="address" i], input[aria-label*="address" i]').first();
    if (await addressInput.isVisible()) {
      await addressInput.fill(`${unit.address}, ${unit.city}, ${unit.province} ${unit.postalCode}`);
      await humanDelay(1000, 2000);
      const suggestion = page.locator('ul[role="listbox"] li, div[role="option"]').first();
      if (await suggestion.isVisible({ timeout: 3000 })) {
        await suggestion.click();
        await humanDelay();
      }
    }

    // Fill bedrooms
    const bedroomSelect = page.locator('select[aria-label*="bedroom" i], div[aria-label*="bedroom" i]').first();
    if (await bedroomSelect.isVisible()) {
      try {
        await bedroomSelect.selectOption(String(unit.bedrooms));
      } catch {
        await bedroomSelect.click();
        await humanDelay();
        await page.locator('div[role="option"]').filter({ hasText: new RegExp(`^${unit.bedrooms}`) }).first().click();
      }
      await humanDelay();
    }

    // Fill bathrooms
    const bathroomSelect = page.locator('select[aria-label*="bathroom" i], div[aria-label*="bathroom" i]').first();
    if (await bathroomSelect.isVisible()) {
      try {
        await bathroomSelect.selectOption(String(unit.bathrooms));
      } catch {
        await bathroomSelect.click();
        await humanDelay();
        await page.locator('div[role="option"]').filter({ hasText: new RegExp(`^${unit.bathrooms}`) }).first().click();
      }
      await humanDelay();
    }

    // Fill description
    const descInput = page.locator('textarea[aria-label*="description" i], div[aria-label*="description" i][role="textbox"]').first();
    if (await descInput.isVisible()) {
      await descInput.click();
      await humanDelay();
      await descInput.fill(`${unit.title}\n\n${unit.description}`);
      await humanDelay();
    }

    // Submit
    const nextBtn = page.locator('div[aria-label="Next"], button:has-text("Next")').first();
    if (await nextBtn.isVisible()) {
      await nextBtn.click();
      await humanDelay(2000, 3000);
    }

    const publishBtn = page.locator('div[aria-label="Publish"], button:has-text("Publish")').first();
    if (await publishBtn.isVisible()) {
      await publishBtn.click();
      await humanDelay(3000, 5000);
    }

    const currentUrl = page.url();
    const postIdMatch = currentUrl.match(/\/item\/(\d+)/);
    const postId = postIdMatch ? postIdMatch[1] : undefined;

    await browser.close();
    return { success: true, postId };
  } catch (err) {
    await browser?.close();
    return { success: false, error: err instanceof Error ? err.message : "Unknown error" };
  }
}

export async function postToGroups(
  credentials: FbCredentials,
  unit: RentalUnit,
  groups: Group[]
): Promise<{ groupId: string; success: boolean; error?: string }[]> {
  let browser: Browser | null = null;
  const results: { groupId: string; success: boolean; error?: string }[] = [];

  try {
    browser = await chromium.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-blink-features=AutomationControlled"],
    });

    const context = await browser.newContext({
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 800 },
    });

    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    const loggedIn = await loginToFacebook(page, credentials);
    if (!loggedIn) {
      return groups.map((g) => ({ groupId: g.id, success: false, error: "Login failed" }));
    }

    const postText = `🏠 ${unit.title}\n\n💰 $${unit.rent}/month\n🛏 ${unit.bedrooms} bed | 🛁 ${unit.bathrooms} bath\n📍 ${unit.address}, ${unit.city}, ${unit.province}\n\n${unit.description}`;

    for (const group of groups) {
      try {
        await page.goto(`https://www.facebook.com/groups/${group.id}`, { waitUntil: "domcontentloaded", timeout: 20000 });
        await humanDelay(2000, 3500);

        const writeBox = page.locator('div[data-pagelet="GroupComposer"] div[role="button"], span:has-text("Write something"), div[aria-label*="Write something"]').first();
        if (await writeBox.isVisible({ timeout: 5000 })) {
          await writeBox.click();
          await humanDelay(1000, 2000);
        }

        const textArea = page.locator('div[role="textbox"][contenteditable="true"]').first();
        if (await textArea.isVisible({ timeout: 5000 })) {
          await textArea.click();
          await humanDelay();
          await textArea.fill(postText);
          await humanDelay(1000, 2000);

          // Try to attach first photo
          if (unit.photos.length > 0) {
            const photoBtn = page.locator('div[aria-label*="Photo/Video"], span:has-text("Photo/Video")').first();
            if (await photoBtn.isVisible({ timeout: 3000 })) {
              await photoBtn.click();
              await humanDelay(1000, 1500);
              const fileInput = page.locator('input[type="file"]').first();
              if (await fileInput.isVisible({ timeout: 3000 })) {
                const response = await fetch(unit.photos[0]);
                const buffer = Buffer.from(await response.arrayBuffer());
                await fileInput.setInputFiles({ name: "photo.jpg", mimeType: "image/jpeg", buffer });
                await humanDelay(2000, 3000);
              }
            }
          }

          const postBtn = page.locator('div[aria-label="Post"], button:has-text("Post")').first();
          if (await postBtn.isVisible({ timeout: 5000 })) {
            await postBtn.click();
            await humanDelay(3000, 5000);
            results.push({ groupId: group.id, success: true });
          } else {
            results.push({ groupId: group.id, success: false, error: "Post button not found" });
          }
        } else {
          results.push({ groupId: group.id, success: false, error: "Composer not found — may need group membership" });
        }
      } catch (err) {
        results.push({ groupId: group.id, success: false, error: err instanceof Error ? err.message : "Unknown" });
      }

      await humanDelay(3000, 6000);
    }

    await browser.close();
    return results;
  } catch (err) {
    await browser?.close();
    return groups.map((g) => ({ groupId: g.id, success: false, error: err instanceof Error ? err.message : "Unknown" }));
  }
}
