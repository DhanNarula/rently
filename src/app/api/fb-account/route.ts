import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { convex, api } from "@/lib/convex";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await convex.query(api.fbAccounts.getByClerkId, { clerkId: userId });
  if (!account || !account.sessionState) return NextResponse.json(null);

  try {
    const cookies = JSON.parse(account.sessionState) as Array<{ name: string }>;
    if (!Array.isArray(cookies) || !cookies.some((c) => c.name === "c_user")) {
      return NextResponse.json(null);
    }
  } catch {
    return NextResponse.json(null);
  }

  return NextResponse.json({
    id: account.id,
    email: account.email,
    groups: JSON.parse(account.groups),
    connected: true,
  });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groups } = await req.json();

  const account = await convex.query(api.fbAccounts.getByClerkId, { clerkId: userId });
  if (!account) {
    return NextResponse.json({ error: "Connect your Facebook account first." }, { status: 400 });
  }

  const updated = await convex.mutation(api.fbAccounts.updateGroups, {
    clerkId: userId,
    groups: JSON.stringify(groups || []),
  });

  if (!updated) return NextResponse.json({ error: "Update failed" }, { status: 500 });

  return NextResponse.json({
    id: updated.id,
    email: updated.email,
    groups: JSON.parse(updated.groups),
    connected: true,
  });
}

export async function DELETE() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await convex.mutation(api.fbAccounts.remove, { clerkId: userId });
  return NextResponse.json({ success: true });
}
