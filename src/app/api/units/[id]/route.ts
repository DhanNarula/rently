import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

async function getAuthedUnit(userId: string, id: string) {
  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user) return null;
  return prisma.unit.findFirst({ where: { id, userId: user.id }, include: { listings: true } });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const unit = await getAuthedUnit(userId, id);
  if (!unit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(unit);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const unit = await getAuthedUnit(userId, id);
  if (!unit) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const updated = await prisma.unit.update({
    where: { id },
    data: {
      ...(body.title && { title: body.title }),
      ...(body.description && { description: body.description }),
      ...(body.rent && { rent: parseFloat(body.rent) }),
      ...(body.bedrooms && { bedrooms: parseInt(body.bedrooms) }),
      ...(body.bathrooms && { bathrooms: parseFloat(body.bathrooms) }),
      ...(body.sqft && { sqft: parseInt(body.sqft) }),
      ...(body.amenities && { amenities: JSON.stringify(body.amenities) }),
      ...(body.photos && { photos: JSON.stringify(body.photos) }),
      ...(body.videoUrl !== undefined && { videoUrl: body.videoUrl }),
      ...(body.isActive !== undefined && { isActive: body.isActive }),
    },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const unit = await getAuthedUnit(userId, id);
  if (!unit) return NextResponse.json({ error: "Not found" }, { status: 404 });
  await prisma.unit.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
