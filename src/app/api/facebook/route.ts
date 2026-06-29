import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";
import { convex, api } from "@/lib/convex";
import { postToMarketplace, postToGroups } from "@/lib/fb-automation";

export const maxDuration = 300;

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = await req.json();
    const { unitId, postToMarketplace: doMarketplace, postToGroups: doGroups } = body;

    if (!unitId) return NextResponse.json({ error: "unitId is required" }, { status: 400 });

    const fbAccount = await convex.query(api.fbAccounts.getByClerkId, { clerkId: userId });
    if (!fbAccount?.sessionState) {
      return NextResponse.json({ error: "No Facebook account connected" }, { status: 400 });
    }

    const user = await convex.query(api.users.getByClerkId, { clerkId: userId });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const unit = await convex.query(api.units.getById, { id: unitId });
    if (!unit || unit.userId !== user.id) {
      return NextResponse.json({ error: "Unit not found" }, { status: 404 });
    }

    let photos: string[] = [];
    try { photos = JSON.parse(unit.photos); } catch {}

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
      propertyType: unit.propertyType ?? "House",
      photos,
    };

    const results: Record<string, unknown> = {};
    const now = Date.now();

    if (doMarketplace) {
      const result = await postToMarketplace(userId, unitData);
      results.marketplace = result;

      if (result.success) {
        try {
          await convex.mutation(api.listings.upsertByExternalId, {
            externalId: `mp-${unitId}`,
            unitId,
            platform: "marketplace",
            status: "active",
            ...(result.postId && { fbPostId: result.postId }),
            lastPostedAt: now,
            nextPostAt: now + 24 * 60 * 60 * 1000,
          });
        } catch (e) {
          console.error("[facebook] upsertByExternalId marketplace failed:", e);
        }
      }
    }

    if (doGroups) {
      let groups: { id: string; name: string }[] = [];
      try { groups = JSON.parse(fbAccount.groups); } catch {}

      if (groups.length === 0) {
        results.groups = [];
      } else {
        const groupResults = await postToGroups(userId, unitData, groups);
        results.groups = groupResults;

        for (const gr of groupResults) {
          if (gr.success) {
            try {
              await convex.mutation(api.listings.upsertByExternalId, {
                externalId: `grp-${unitId}-${gr.groupId}`,
                unitId,
                platform: "group",
                groupId: gr.groupId,
                status: "active",
                lastPostedAt: now,
                nextPostAt: now + 24 * 60 * 60 * 1000,
              });
            } catch (e) {
              console.error("[facebook] upsertByExternalId group failed:", e);
            }
          }
        }
      }
    }

    return NextResponse.json(results);
  } catch (e) {
    console.error("[facebook] POST error:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Internal server error" },
      { status: 500 }
    );
  }
}
