import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json([]);

    const expenses = await prisma.expense.findMany({
      where: { userId: user.id },
      include: { unit: { select: { address: true, city: true } } },
      orderBy: { date: "desc" },
    });

    return NextResponse.json(expenses);
  } catch (e) {
    console.error("GET /api/expenses error:", e);
    return NextResponse.json({ error: "Failed to fetch expenses" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json();
    const { title, amount, category, date, unitId, notes, receiptUrl, taxYear } = body;

    if (!title || !amount) {
      return NextResponse.json({ error: "title and amount are required" }, { status: 400 });
    }

    if (unitId) {
      const unit = await prisma.unit.findFirst({ where: { id: unitId, userId: user.id } });
      if (!unit) return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const expense = await prisma.expense.create({
      data: {
        userId: user.id,
        title,
        amount: parseFloat(amount),
        category: category || "other",
        date: date ? new Date(date) : new Date(),
        unitId: unitId || null,
        notes: notes || null,
        receiptUrl: receiptUrl || null,
        taxYear: taxYear || new Date().getFullYear(),
      },
      include: { unit: { select: { address: true, city: true } } },
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (e) {
    console.error("POST /api/expenses error:", e);
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}
