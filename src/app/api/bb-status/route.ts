import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { Browserbase } from "@browserbasehq/sdk";
import { chromium } from "playwright";
import { prisma } from "@/lib/prisma";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionId = req.nextUrl.searchParams.get("sessionId");
  if (!sessionId) return NextResponse.json({ error: "sessionId required" }, { status: 400 });

  try {
    const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });

    const session = await bb.sessions.retrieve(sessionId);
    if (session.status !== "RUNNING") {
      return NextResponse.json({ loggedIn: false, sessionEnded: true });
    }
    if (!session.connectUrl) {
      return NextResponse.json({ loggedIn: false, sessionEnded: true });
    }

    const browser = await chromium.connectOverCDP(session.connectUrl);

    // Use CDP directly — reads from the browser's actual cookie store,
    // bypasses browser.contexts() which can return empty on keepAlive reconnect
    const cdp = await browser.newBrowserCDPSession();
    const { cookies } = await cdp.send("Network.getCookies", {
      urls: ["https://www.facebook.com", "https://facebook.com"],
    }) as { cookies: Array<{ name: string; value: string; domain: string; path: string; expires: number; httpOnly: boolean; secure: boolean; sameSite: string }> };

    const loggedIn =
      cookies.some((c) => c.name === "c_user") &&
      cookies.some((c) => c.name === "xs");

    if (loggedIn) {
      await prisma.fbAccount.upsert({
        where: { clerkId: userId },
        update: { sessionState: JSON.stringify(cookies), email: "connected" },
        create: {
          clerkId: userId,
          email: "connected",
          sessionState: JSON.stringify(cookies),
          groups: "[]",
        },
      });
      // End the Browserbase session — cookies are saved, no longer needed
      await browser.close();
    }
    // If not logged in: let browser go out of scope (WebSocket closes),
    // keepAlive keeps the Browserbase session alive for the next poll

    return NextResponse.json({ loggedIn });
  } catch (err) {
    console.error("[bb-status]", err);
    return NextResponse.json({ loggedIn: false, error: String(err) });
  }
}
