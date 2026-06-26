import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { Browserbase } from "@browserbasehq/sdk";

export const maxDuration = 30;

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const bb = new Browserbase({ apiKey: process.env.BROWSERBASE_API_KEY! });

    // Try with advancedStealth first (helps bypass Facebook bot detection),
    // fall back to basic session if not on a plan that supports it
    let session;
    try {
      session = await bb.sessions.create({
        projectId: process.env.BROWSERBASE_PROJECT_ID!,
        keepAlive: true,
        timeout: 300,
        browserSettings: {
          advancedStealth: true,
        },
      });
    } catch {
      session = await bb.sessions.create({
        projectId: process.env.BROWSERBASE_PROJECT_ID!,
        keepAlive: true,
        timeout: 300,
      });
    }

    // bb-status will be the ONLY Playwright connection — no conflict
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
