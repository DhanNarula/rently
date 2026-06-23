import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await prisma.fbAccount.findUnique({ where: { clerkId: userId } });
  if (!account || !account.sessionState) return NextResponse.json(null);

  return NextResponse.json({
    id: account.id,
    email: account.email,
    groups: JSON.parse(account.groups),
    connected: true,
  });
}

// Updates groups only — Facebook session is managed via /api/fb-session
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { groups } = await req.json();

  const account = await prisma.fbAccount.findUnique({ where: { clerkId: userId } });
  if (!account) {
    return NextResponse.json({ error: "Connect your Facebook account first." }, { status: 400 });
  }

  const updated = await prisma.fbAccount.update({
    where: { clerkId: userId },
    data: { groups: JSON.stringify(groups || []) },
  });

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

  await prisma.fbAccount.deleteMany({ where: { clerkId: userId } });
  return NextResponse.json({ success: true });
}
