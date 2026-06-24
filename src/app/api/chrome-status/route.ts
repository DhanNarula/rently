import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { chromium } from "playwright";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const browser = await chromium.connectOverCDP("http://localhost:9222", { timeout: 3000 });
    const contexts = browser.contexts();

    if (!contexts.length) {
      return NextResponse.json({ chromeRunning: true, fbLoggedIn: false });
    }

    const context = contexts[0];
    const cookies = await context.cookies(["https://www.facebook.com"]);
    const fbLoggedIn =
      cookies.some((c) => c.name === "c_user") && cookies.some((c) => c.name === "xs");

    if (fbLoggedIn) {
      const existing = await prisma.fbAccount.findUnique({ where: { clerkId: userId } });
      await prisma.fbAccount.upsert({
        where: { clerkId: userId },
        update: { sessionState: "cdp", email: "connected" },
        create: {
          clerkId: userId,
          email: "connected",
          sessionState: "cdp",
          groups: existing?.groups ?? "[]",
        },
      });
    }

    return NextResponse.json({ chromeRunning: true, fbLoggedIn });
  } catch {
    return NextResponse.json({ chromeRunning: false, fbLoggedIn: false });
  }
}
