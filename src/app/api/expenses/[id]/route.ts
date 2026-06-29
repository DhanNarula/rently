import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { convex, api } from "@/lib/convex";

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const user = await convex.query(api.users.getByClerkId, { clerkId: userId });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const existing = await convex.query(api.expenses.getById, { id });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await convex.mutation(api.expenses.remove, { id });
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
    const user = await convex.query(api.users.getByClerkId, { clerkId: userId });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const existing = await convex.query(api.expenses.getById, { id });
    if (!existing || existing.userId !== user.id) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const updated = await convex.mutation(api.expenses.update, {
      id,
      ...(body.title !== undefined && { title: body.title }),
      ...(body.amount !== undefined && { amount: parseFloat(body.amount) }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.notes !== undefined && { notes: body.notes }),
      ...(body.receiptUrl !== undefined && { receiptUrl: body.receiptUrl }),
    });
    return NextResponse.json(updated);
  } catch (e) {
    console.error("PATCH /api/expenses/[id] error:", e);
    return NextResponse.json({ error: "Failed to update expense" }, { status: 500 });
  }
}
