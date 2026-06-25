import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { Browserbase } from "@browserbasehq/sdk";
import { chromium } from "playwright";

export const maxDuration = 60;

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });

    // Create a persistent session — stays alive after Playwright disconnects
    const session = await bb.sessions.create({
      projectId: process.env.BROWSERBASE_PROJECT_ID!,
      keepAlive: true,
    });

    // Open Facebook login in the cloud browser
    const browser = await chromium.connectOverCDP(session.connectUrl);
    try {
      const ctx = browser.contexts()[0] ?? await browser.newContext();
      const page = ctx.pages()[0] ?? await ctx.newPage();
      await page.goto("https://www.facebook.com/login", {
        waitUntil: "domcontentloaded",
        timeout: 20_000,
      });
    } catch {
      // If navigation fails the live view still works — user can navigate manually
    }
    // Do NOT close browser — keepAlive keeps the Browserbase session running

    // Get the live view URL (call after navigation so page ID is stable)
    const debug = await bb.sessions.debug(session.id);

    return NextResponse.json({
      sessionId: session.id,
      liveViewUrl: debug.debuggerFullscreenUrl,
    });
  } catch (err) {
    console.error("[bb-login]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create browser session" },
      { status: 500 }
    );
  }
}
