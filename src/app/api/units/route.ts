import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json([]);

  const units = await prisma.unit.findMany({
    where: { userId: user.id },
    include: { listings: true },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(units);
}

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();

  let user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user) {
    user = await prisma.user.create({
      data: { clerkId: userId, email: body.email || `${userId}@placeholder.com` },
    });
  }

  const unit = await prisma.unit.create({
    data: {
      userId: user.id,
      address: body.address,
      city: body.city,
      province: body.province,
      postalCode: body.postalCode,
      rent: parseFloat(body.rent),
      bedrooms: parseInt(body.bedrooms),
      bathrooms: parseFloat(body.bathrooms),
      sqft: body.sqft ? parseInt(body.sqft) : null,
      title: body.title,
      description: body.description,
      amenities: JSON.stringify(body.amenities || []),
      photos: JSON.stringify(body.photos || []),
    },
  });

  return NextResponse.json(unit, { status: 201 });
}
