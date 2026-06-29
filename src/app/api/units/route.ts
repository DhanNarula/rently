import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { convex, api } from "@/lib/convex";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await convex.query(api.users.getByClerkId, { clerkId: userId });
  if (!user) return NextResponse.json([]);

  const units = await convex.query(api.units.listByUser, { userId: user.id });
  return NextResponse.json(units);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const body = await req.json();

    const user = await convex.mutation(api.users.getOrCreate, {
      clerkId: userId,
      email: body.email || `${userId}@placeholder.com`,
    });

    const unit = await convex.mutation(api.units.create, {
      userId: user.id,
      address: body.address,
      city: body.city,
      province: body.province,
      postalCode: body.postalCode || "",
      rent: parseFloat(body.rent),
      bedrooms: Math.round(Number(body.bedrooms)),
      bathrooms: parseFloat(body.bathrooms),
      ...(body.sqft && { sqft: parseInt(body.sqft) }),
      title: body.title,
      description: body.description,
      propertyType: body.propertyType || "House",
      amenities: JSON.stringify(body.amenities || []),
      photos: JSON.stringify(body.photos || []),
      ...(body.availableFrom && { availableFrom: new Date(body.availableFrom).getTime() }),
    });

    return NextResponse.json(unit, { status: 201 });
  } catch (e) {
    console.error("POST /api/units error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Failed to save unit" },
      { status: 500 }
    );
  }
}
