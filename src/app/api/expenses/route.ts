import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { convex, api } from "@/lib/convex";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const user = await convex.query(api.users.getByClerkId, { clerkId: userId });
    if (!user) return NextResponse.json([]);
    const expenses = await convex.query(api.expenses.listByUser, { userId: user.id });
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
    const user = await convex.query(api.users.getByClerkId, { clerkId: userId });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json();
    const { title, amount, category, date, unitId, notes, receiptUrl, taxYear } = body;

    if (!title || !amount) {
      return NextResponse.json({ error: "title and amount are required" }, { status: 400 });
    }

    if (unitId) {
      const unit = await convex.query(api.units.getById, { id: unitId });
      if (!unit || unit.userId !== user.id) {
        return NextResponse.json({ error: "Unit not found" }, { status: 404 });
      }
    }

    const expense = await convex.mutation(api.expenses.create, {
      userId: user.id,
      title,
      amount: parseFloat(amount),
      category: category || "other",
      date: date ? new Date(date).getTime() : Date.now(),
      ...(unitId && { unitId }),
      ...(notes && { notes }),
      ...(receiptUrl && { receiptUrl }),
      taxYear: taxYear || new Date().getFullYear(),
    });

    return NextResponse.json(expense, { status: 201 });
  } catch (e) {
    console.error("POST /api/expenses error:", e);
    return NextResponse.json({ error: "Failed to create expense" }, { status: 500 });
  }
}
