import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json();
    const { status, cost, vendor, resolvedAt } = body;

    const existing = await prisma.maintenanceRequest.findFirst({
      where: { id, unit: { userId: user.id } },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const updated = await prisma.maintenanceRequest.update({
      where: { id },
      data: {
        ...(status !== undefined && { status }),
        ...(cost !== undefined && { cost }),
        ...(vendor !== undefined && { vendor }),
        ...(status === "resolved" && { resolvedAt: new Date() }),
        ...(resolvedAt !== undefined && { resolvedAt: resolvedAt ? new Date(resolvedAt) : null }),
      },
      include: { unit: { select: { address: true, city: true } } },
    });

    return NextResponse.json(updated);
  } catch (e) {
    console.error("PATCH /api/maintenance/[id] error:", e);
    return NextResponse.json({ error: "Failed to update maintenance request" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await params;
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const existing = await prisma.maintenanceRequest.findFirst({
      where: { id, unit: { userId: user.id } },
    });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await prisma.maintenanceRequest.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("DELETE /api/maintenance/[id] error:", e);
    return NextResponse.json({ error: "Failed to delete maintenance request" }, { status: 500 });
  }
}
