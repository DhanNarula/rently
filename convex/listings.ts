import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

function fmt(l: {
  _id: string;
  _creationTime: number;
  unitId: Id<"units">;
  externalId?: string;
  platform: string;
  groupId?: string;
  groupName?: string;
  fbPostId?: string;
  status: string;
  lastPostedAt?: number;
  nextPostAt?: number;
  updatedAt: number;
}) {
  return {
    id: l._id,
    unitId: l.unitId,
    externalId: l.externalId ?? null,
    platform: l.platform,
    groupId: l.groupId ?? null,
    groupName: l.groupName ?? null,
    fbPostId: l.fbPostId ?? null,
    status: l.status,
    lastPostedAt: l.lastPostedAt ? new Date(l.lastPostedAt).toISOString() : null,
    nextPostAt: l.nextPostAt ? new Date(l.nextPostAt).toISOString() : null,
    createdAt: new Date(l._creationTime).toISOString(),
    updatedAt: new Date(l.updatedAt).toISOString(),
  };
}

export const getDueListings = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const all = await ctx.db
      .query("listings")
      .filter((q) => q.and(q.eq(q.field("status"), "active"), q.lte(q.field("nextPostAt"), now)))
      .collect();

    const result = [];
    for (const listing of all) {
      const unit = await ctx.db.get(listing.unitId);
      if (!unit || !unit.isActive) continue;
      const user = await ctx.db.get(unit.userId);
      if (!user) continue;
      result.push({
        ...fmt(listing),
        clerkId: user.clerkId,
        unit: {
          id: unit._id,
          userId: unit.userId,
          title: unit.title,
          description: unit.description,
          address: unit.address,
          city: unit.city,
          province: unit.province,
          postalCode: unit.postalCode,
          rent: unit.rent,
          bedrooms: unit.bedrooms,
          bathrooms: unit.bathrooms,
          propertyType: unit.propertyType,
          photos: unit.photos,
          isActive: unit.isActive,
        },
      });
    }
    return result;
  },
});

export const upsertByExternalId = mutation({
  args: {
    externalId: v.string(),
    unitId: v.id("units"),
    platform: v.string(),
    groupId: v.optional(v.string()),
    status: v.string(),
    fbPostId: v.optional(v.string()),
    lastPostedAt: v.optional(v.number()),
    nextPostAt: v.optional(v.number()),
  },
  handler: async (ctx, { externalId, unitId, ...data }) => {
    const now = Date.now();
    const existing = await ctx.db
      .query("listings")
      .withIndex("by_external_id", (q) => q.eq("externalId", externalId))
      .unique();
    if (existing) {
      const patch: Record<string, unknown> = { updatedAt: now };
      for (const [k, v2] of Object.entries(data)) {
        if (v2 !== undefined) patch[k] = v2;
      }
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }
    const id = await ctx.db.insert("listings", {
      externalId,
      unitId,
      ...data,
      updatedAt: now,
    });
    return id;
  },
});

export const updateById = mutation({
  args: {
    id: v.id("listings"),
    status: v.optional(v.string()),
    fbPostId: v.optional(v.string()),
    lastPostedAt: v.optional(v.number()),
    nextPostAt: v.optional(v.number()),
  },
  handler: async (ctx, { id, ...data }) => {
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [k, v2] of Object.entries(data)) {
      if (v2 !== undefined) patch[k] = v2;
    }
    await ctx.db.patch(id, patch);
    return null;
  },
});
