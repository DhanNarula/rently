import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { convex, api } from "@/lib/convex";

async function getAuthedRequest(userId: string, id: string) {
  const user = await convex.query(api.users.getByClerkId, { clerkId: userId });
  if (!user) return null;
  const request = await convex.query(api.maintenance.getById, { id });
  if (!request) return null;
  const unit = await convex.query(api.units.getById, { id: request.unitId });
  if (!unit || unit.userId !== user.id) return null;
  return request;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const existing = await getAuthedRequest(userId, id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const body = await req.json();
    const { status, cost, vendor, resolvedAt } = body;

    const updated = await convex.mutation(api.maintenance.update, {
      id,
      ...(status !== undefined && { status }),
      ...(cost !== undefined && { cost }),
      ...(vendor !== undefined && { vendor }),
      ...(status === "resolved" && { setResolvedNow: true }),
      ...(resolvedAt !== undefined && resolvedAt && { resolvedAt: new Date(resolvedAt).getTime() }),
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("PATCH /api/maintenance/[id] error:", e);
    return NextResponse.json({ error: "Failed to update maintenance request" }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const existing = await getAuthedRequest(userId, id);
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await convex.mutation(api.maintenance.remove, { id });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/maintenance/[id] error:", e);
    return NextResponse.json({ error: "Failed to delete maintenance request" }, { status: 500 });
  }
}
