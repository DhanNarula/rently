import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { postToMarketplace, postToGroups } from "@/lib/fb-automation";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { unitId, postToMarketplace: doMarketplace, postToGroups: doGroups } = await req.json();

  const fbAccount = await prisma.fbAccount.findUnique({ where: { clerkId: userId } });
  if (!fbAccount?.sessionState) {
    return NextResponse.json({ error: "No Facebook account connected" }, { status: 400 });
  }

  const user = await prisma.user.findUnique({ where: { clerkId: userId } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

  const unit = await prisma.unit.findFirst({ where: { id: unitId, userId: user.id } });
  if (!unit) return NextResponse.json({ error: "Unit not found" }, { status: 404 });

  const sessionState = JSON.parse(fbAccount.sessionState);
  const unitData = {
    id: unit.id,
    title: unit.title,
    description: unit.description,
    address: unit.address,
    city: unit.city,
    province: unit.province,
    postalCode: unit.postalCode,
    rent: unit.rent,
    bedrooms: unit.bedrooms,
    bathrooms: unit.bathrooms,
    photos: JSON.parse(unit.photos),
  };

  const results: Record<string, unknown> = {};

  if (doMarketplace) {
    const result = await postToMarketplace(sessionState, unitData);
    results.marketplace = result;

    if (result.success) {
      await prisma.listing.upsert({
        where: { id: `mp-${unitId}` },
        update: {
          status: "active",
          fbPostId: result.postId,
          lastPostedAt: new Date(),
          nextPostAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
        create: {
          id: `mp-${unitId}`,
          unitId,
          platform: "marketplace",
          status: "active",
          fbPostId: result.postId,
          lastPostedAt: new Date(),
          nextPostAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  if (doGroups) {
    const groups = JSON.parse(fbAccount.groups);
    const groupResults = await postToGroups(sessionState, unitData, groups);
    results.groups = groupResults;

    for (const gr of groupResults) {
      if (gr.success) {
        await prisma.listing.upsert({
          where: { id: `grp-${unitId}-${gr.groupId}` },
          update: {
            status: "active",
            lastPostedAt: new Date(),
            nextPostAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
          create: {
            id: `grp-${unitId}-${gr.groupId}`,
            unitId,
            platform: "group",
            groupId: gr.groupId,
            status: "active",
            lastPostedAt: new Date(),
            nextPostAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
          },
        });
      }
    }
  }

  return NextResponse.json(results);
}
