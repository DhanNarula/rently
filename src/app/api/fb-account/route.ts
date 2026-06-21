import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { encrypt, decrypt } from "@/lib/crypto";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const account = await prisma.fbAccount.findUnique({ where: { clerkId: userId } });
  if (!account) return NextResponse.json(null);

  return NextResponse.json({
    id: account.id,
    email: account.email,
    groups: JSON.parse(account.groups),
    hasPassword: true,
  });
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { email, password, groups } = await req.json();
  if (!email || !password) return NextResponse.json({ error: "Email and password required" }, { status: 400 });

  const passwordEnc = encrypt(password);

  const account = await prisma.fbAccount.upsert({
    where: { clerkId: userId },
    update: { email, passwordEnc, groups: JSON.stringify(groups || []) },
    create: { clerkId: userId, email, passwordEnc, groups: JSON.stringify(groups || []) },
  });

  return NextResponse.json({ id: account.id, email: account.email, groups: JSON.parse(account.groups) });
}

export async function DELETE() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  await prisma.fbAccount.deleteMany({ where: { clerkId: userId } });
  return NextResponse.json({ success: true });
}
