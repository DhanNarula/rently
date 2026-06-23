import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { postToMarketplace, postToGroups } from "@/lib/fb-automation";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  const dueListings = await prisma.listing.findMany({
    where: {
      status: "active",
      nextPostAt: { lte: now },
      unit: { isActive: true },
    },
    include: { unit: true },
  });

  const results: { listingId: string; success: boolean; error?: string }[] = [];

  const byUser = new Map<string, typeof dueListings>();
  for (const listing of dueListings) {
    const user = await prisma.user.findUnique({ where: { id: listing.unit.userId } });
    if (!user) continue;
    const existing = byUser.get(user.clerkId) || [];
    existing.push(listing);
    byUser.set(user.clerkId, existing);
  }

  for (const [clerkId, listings] of byUser) {
    const fbAccount = await prisma.fbAccount.findUnique({ where: { clerkId } });
    if (!fbAccount?.sessionState) continue;

    const sessionState = JSON.parse(fbAccount.sessionState);
    const groups = JSON.parse(fbAccount.groups);

    for (const listing of listings) {
      const unit = listing.unit;
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

      try {
        let success = false;

        if (listing.platform === "marketplace") {
          const result = await postToMarketplace(sessionState, unitData);
          success = result.success;
          if (result.success && result.postId) {
            await prisma.listing.update({
              where: { id: listing.id },
              data: { fbPostId: result.postId },
            });
          }
        } else if (listing.platform === "group" && listing.groupId) {
          const group = groups.find((g: { id: string }) => g.id === listing.groupId);
          if (group) {
            const groupResults = await postToGroups(sessionState, unitData, [group]);
            success = groupResults[0]?.success || false;
          }
        }

        await prisma.listing.update({
          where: { id: listing.id },
          data: {
            status: success ? "active" : "failed",
            lastPostedAt: success ? now : undefined,
            nextPostAt: success ? new Date(now.getTime() + 24 * 60 * 60 * 1000) : undefined,
          },
        });

        results.push({ listingId: listing.id, success });
      } catch (err) {
        results.push({
          listingId: listing.id,
          success: false,
          error: err instanceof Error ? err.message : "Unknown",
        });
      }
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
