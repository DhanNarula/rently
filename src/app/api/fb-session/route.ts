import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chromium } from "playwright";

// Allow up to 5 minutes for the user to complete Facebook login
export const maxDuration = 300;

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let browser: Awaited<ReturnType<typeof chromium.launch>> | null = null;

  try {
    browser = await chromium.launch({
      headless: false,
      args: ["--no-sandbox", "--disable-blink-features=AutomationControlled"],
    });

    const context = await browser.newContext({
      userAgent:
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      viewport: { width: 1280, height: 900 },
    });

    const page = await context.newPage();
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "webdriver", { get: () => undefined });
    });

    await page.goto("https://www.facebook.com/login", {
      waitUntil: "domcontentloaded",
      timeout: 30_000,
    });

    // Detect browser/tab closure instantly via event
    let browserClosed = false;
    browser.on("disconnected", () => { browserClosed = true; });
    page.on("close", () => { browserClosed = true; });

    // Poll every 500 ms until: login succeeds, browser closes, or 4-min timeout
    const deadline = Date.now() + 240_000;
    let loggedIn = false;

    while (Date.now() < deadline && !browserClosed) {
      await new Promise((r) => setTimeout(r, 500));
      if (browserClosed) break;
      try {
        const url = page.url();
        if (
          url.includes("facebook.com") &&
          !url.includes("/login") &&
          !url.includes("login.php")
        ) {
          // Give the page a moment to fully settle (2FA redirect, etc.)
          await new Promise((r) => setTimeout(r, 3_000));
          if (!browserClosed) loggedIn = true;
          break;
        }
      } catch {
        // Page threw — treat as closed
        browserClosed = true;
        break;
      }
    }

    if (!loggedIn) {
      await browser.close().catch(() => {});
      browser = null;
      const msg = browserClosed
        ? "Browser was closed — click the button to try again."
        : "Login timed out — please try again.";
      return NextResponse.json({ error: msg }, { status: 408 });
    }

    const state = await context.storageState();
    await browser.close();
    browser = null;

    const existing = await prisma.fbAccount.findUnique({ where: { clerkId: userId } });

    await prisma.fbAccount.upsert({
      where: { clerkId: userId },
      update: { sessionState: JSON.stringify(state) },
      create: {
        clerkId: userId,
        email: "connected",
        sessionState: JSON.stringify(state),
        groups: existing?.groups ?? "[]",
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    await browser?.close();
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("fb-session error:", err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
