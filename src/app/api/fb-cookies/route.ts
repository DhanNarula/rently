import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { convex, api } from "@/lib/convex";

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { c_user, xs } = await req.json();
  if (!c_user || !xs) {
    return NextResponse.json({ error: "Both c_user and xs cookie values are required." }, { status: 400 });
  }

  const cookies = [
    { name: "c_user", value: String(c_user).trim(), domain: ".facebook.com", path: "/", expires: -1, httpOnly: true, secure: true, sameSite: "None" },
    { name: "xs",     value: String(xs).trim(),     domain: ".facebook.com", path: "/", expires: -1, httpOnly: true, secure: true, sameSite: "None" },
  ];

  const existing = await convex.query(api.fbAccounts.getByClerkId, { clerkId: userId });

  await convex.mutation(api.fbAccounts.upsert, {
    clerkId: userId,
    email: "connected",
    sessionState: JSON.stringify(cookies),
    groups: existing?.groups ?? "[]",
  });

  return NextResponse.json({ success: true });
}
