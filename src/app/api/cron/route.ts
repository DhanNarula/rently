import { NextRequest, NextResponse } from "next/server";
import { convex, api } from "@/lib/convex";
import { postToMarketplace, postToGroups } from "@/lib/fb-automation";

export async function GET(req: NextRequest) {
  const secret = req.headers.get("x-cron-secret") || req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = Date.now();
  const dueListings = await convex.query(api.listings.getDueListings, {});

  const results: { listingId: string; success: boolean; error?: string }[] = [];

  // Group by clerkId so we fetch each user's fbAccount once
  const byClerk = new Map<string, typeof dueListings>();
  for (const listing of dueListings) {
    const key = listing.clerkId as string;
    const existing = byClerk.get(key) || [];
    existing.push(listing);
    byClerk.set(key, existing);
  }

  for (const [clerkId, listings] of byClerk) {
    const fbAccount = await convex.query(api.fbAccounts.getByClerkId, { clerkId });
    if (!fbAccount?.sessionState) continue;

    const groups = JSON.parse(fbAccount.groups);

    for (const listing of listings) {
      const unit = listing.unit;
      const unitData = {
        id: unit.id as string,
        title: unit.title,
        description: unit.description,
        address: unit.address,
        city: unit.city,
        province: unit.province,
        postalCode: unit.postalCode,
        rent: unit.rent,
        bedrooms: unit.bedrooms,
        bathrooms: unit.bathrooms,
        propertyType: unit.propertyType ?? "House",
        photos: JSON.parse(unit.photos),
      };

      try {
        let success = false;

        if (listing.platform === "marketplace") {
          const result = await postToMarketplace(clerkId, unitData);
          success = result.success;
          if (result.success && result.postId) {
            await convex.mutation(api.listings.updateById, {
              id: listing.id as string,
              fbPostId: result.postId,
            });
          }
        } else if (listing.platform === "group" && listing.groupId) {
          const group = groups.find((g: { id: string }) => g.id === listing.groupId);
          if (group) {
            const groupResults = await postToGroups(clerkId, unitData, [group]);
            success = groupResults[0]?.success || false;
          }
        }

        await convex.mutation(api.listings.updateById, {
          id: listing.id as string,
          status: success ? "active" : "failed",
          ...(success && { lastPostedAt: now, nextPostAt: now + 24 * 60 * 60 * 1000 }),
        });

        results.push({ listingId: listing.id as string, success });
      } catch (err) {
        results.push({
          listingId: listing.id as string,
          success: false,
          error: err instanceof Error ? err.message : "Unknown",
        });
      }
    }
  }

  return NextResponse.json({ processed: results.length, results });
}
