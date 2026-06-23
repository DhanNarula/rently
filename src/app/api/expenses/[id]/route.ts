import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const existing = await prisma.expense.findFirst({ where: { id, userId: user.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.expense.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/expenses/[id] error:", e);
    return NextResponse.json({ error: "Failed to delete expense" }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const existing = await prisma.expense.findFirst({ where: { id, userId: user.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const updated = await prisma.expense.update({
      where: { id },
      data: {
        ...(body.title !== undefined && { title: body.title }),
        ...(body.amount !== undefined && { amount: parseFloat(body.amount) }),
        ...(body.category !== undefined && { category: body.category }),
        ...(body.notes !== undefined && { notes: body.notes }),
        ...(body.receiptUrl !== undefined && { receiptUrl: body.receiptUrl }),
      },
      include: { unit: { select: { address: true, city: true } } },
    });
    return NextResponse.json(updated);
  } catch (e) {
    console.error("PATCH /api/expenses/[id] error:", e);
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 });
  }
}
