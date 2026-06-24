// Replaced by /api/chrome-launch + /api/chrome-status (CDP-based approach).
// Kept as a no-op to avoid 404s from any cached clients.
import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json(
    { error: "This endpoint is deprecated. Use /api/chrome-launch and /api/chrome-status instead." },
    { status: 410 }
  );
}
