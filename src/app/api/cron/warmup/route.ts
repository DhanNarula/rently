import { NextRequest, NextResponse } from "next/server";
import { convex, api } from "@/lib/convex";
import { chromium } from "playwright";
import { Browserbase } from "@browserbasehq/sdk";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accounts = await convex.query(api.fbAccounts.listAllWithSession, {});

  const results: { clerkId: string; ok: boolean; error?: string }[] = [];

  for (const account of accounts) {
    let cookies: object[];
    try {
      cookies = JSON.parse(account.sessionState!);
      if (!Array.isArray(cookies) || !cookies.length) throw new Error("empty");
    } catch {
      results.push({ clerkId: account.clerkId, ok: false, error: "no cookies stored" });
      continue;
    }

    let browser;
    try {
      const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });
      const session = await bb.sessions.create({
        projectId: process.env.BROWSERBASE_PROJECT_ID!,
      });

      browser = await chromium.connectOverCDP(session.connectUrl);
      const ctx = browser.contexts()[0] ?? await browser.newContext();

      await ctx.addCookies(cookies as Parameters<typeof ctx.addCookies>[0]);

      const page = await ctx.newPage();
      await page.goto("https://www.facebook.com", {
        waitUntil: "domcontentloaded",
        timeout: 30_000,
      });

      await new Promise((r) => setTimeout(r, 5000));

      const loggedIn = !page.url().includes("/login") && !page.url().includes("login.php");

      const updatedCookies = await ctx.cookies([
        "https://www.facebook.com",
        "https://web.facebook.com",
      ]);
      if (updatedCookies.length > 0) {
        await convex.mutation(api.fbAccounts.updateSession, {
          clerkId: account.clerkId,
          sessionState: JSON.stringify(updatedCookies),
        });
      }

      results.push({ clerkId: account.clerkId, ok: loggedIn, error: loggedIn ? undefined : "session expired — user must reconnect" });
    } catch (err) {
      results.push({
        clerkId: account.clerkId,
        ok: false,
        error: err instanceof Error ? err.message : "Unknown",
      });
    } finally {
      try { await browser?.close(); } catch {}
    }
  }

  return NextResponse.json({ warmed: results.length, results });
}
