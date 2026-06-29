import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { convex, api } from "@/lib/convex";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const user = await convex.query(api.users.getByClerkId, { clerkId: userId });
    if (!user) return NextResponse.json([]);
    const requests = await convex.query(api.maintenance.listByUser, { userId: user.id });
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
    const user = await convex.query(api.users.getByClerkId, { clerkId: userId });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const body = await req.json();
    const { unitId, title, description, category, priority, vendor, cost } = body;

    if (!unitId || !title) {
      return NextResponse.json({ error: "unitId and title are required" }, { status: 400 });
    }

    const unit = await convex.query(api.units.getById, { id: unitId });
    if (!unit || unit.userId !== user.id) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    const request = await convex.mutation(api.maintenance.create, {
      unitId,
      title,
      ...(description && { description }),
      category: category || "general",
      priority: priority || "medium",
      ...(vendor && { vendor }),
      ...(cost !== undefined && cost !== null && { cost: parseFloat(cost) }),
    });

    return NextResponse.json(request, { status: 201 });
  } catch (e) {
    console.error("POST /api/maintenance error:", e);
    return NextResponse.json({ error: "Failed to create maintenance request" }, { status: 500 });
  }
}
