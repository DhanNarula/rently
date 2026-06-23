import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json([]);

    const requests = await prisma.maintenanceRequest.findMany({
      where: { unit: { userId: user.id } },
      include: { unit: { select: { address: true, city: true } } },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json(requests);
  } catch (e) {
    console.error("GET /api/maintenance error:", e);
    return NextResponse.json({ error: "Failed to fetch maintenance requests" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const user = await prisma.user.findUnique({ where: { clerkId: userId } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json();
    const { unitId, title, description, category, priority, vendor, cost } = body;

    if (!unitId || !title) {
      return NextResponse.json({ error: "unitId and title are required" }, { status: 400 });
    }

    const unit = await prisma.unit.findFirst({ where: { id: unitId, userId: user.id } });
    if (!unit) return NextResponse.json({ error: "Unit not found" }, { status: 404 });

    const request = await prisma.maintenanceRequest.create({
      data: {
        unitId,
        title,
        description: description || null,
        category: category || "general",
        priority: priority || "medium",
        vendor: vendor || null,
        cost: cost ? parseFloat(cost) : null,
      },
      include: { unit: { select: { address: true, city: true } } },
    });

    return NextResponse.json(request, { status: 201 });
  } catch (e) {
    console.error("POST /api/maintenance error:", e);
    return NextResponse.json({ error: "Failed to create maintenance request" }, { status: 500 });
  }
}
