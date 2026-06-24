import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { spawn } from "child_process";
import path from "path";
import os from "os";
import fs from "fs";

const CHROME_CANDIDATES = [
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
];

export async function POST() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const chromePath = CHROME_CANDIDATES.find((p) => fs.existsSync(p));
  if (!chromePath) {
    return NextResponse.json(
      { error: "Google Chrome not found. Please install Chrome from google.com/chrome." },
      { status: 400 }
    );
  }

  const profileDir = path.join(os.homedir(), ".rently", "chrome-profile");
  fs.mkdirSync(profileDir, { recursive: true });

  spawn(
    chromePath,
    [
      "--remote-debugging-port=9222",
      `--user-data-dir=${profileDir}`,
      "--no-first-run",
      "--no-default-browser-check",
      "--disable-popup-blocking",
      "https://www.facebook.com/",
    ],
    { detached: true, stdio: "ignore" }
  ).unref();

  return NextResponse.json({ success: true });
}
