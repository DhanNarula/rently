import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

function fmtListing(l: {
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

function fmtUnit(
  u: {
    _id: string;
    _creationTime: number;
    userId: Id<"users">;
    address: string;
    city: string;
    province: string;
    postalCode: string;
    rent: number;
    bedrooms: number;
    bathrooms: number;
    sqft?: number;
    description: string;
    title: string;
    propertyType: string;
    amenities: string;
    photos: string;
    videoUrl?: string;
    availableFrom?: number;
    isActive: boolean;
    updatedAt: number;
  },
  listings: ReturnType<typeof fmtListing>[]
) {
  return {
    id: u._id,
    userId: u.userId,
    address: u.address,
    city: u.city,
    province: u.province,
    postalCode: u.postalCode,
    rent: u.rent,
    bedrooms: u.bedrooms,
    bathrooms: u.bathrooms,
    sqft: u.sqft ?? null,
    description: u.description,
    title: u.title,
    propertyType: u.propertyType,
    amenities: u.amenities,
    photos: u.photos,
    videoUrl: u.videoUrl ?? null,
    availableFrom: u.availableFrom ? new Date(u.availableFrom).toISOString() : null,
    isActive: u.isActive,
    createdAt: new Date(u._creationTime).toISOString(),
    updatedAt: new Date(u.updatedAt).toISOString(),
    listings,
  };
}

export const listByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const units = await ctx.db
      .query("units")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    const result = [];
    for (const unit of units) {
      const listings = await ctx.db
        .query("listings")
        .withIndex("by_unit", (q) => q.eq("unitId", unit._id))
        .collect();
      result.push(fmtUnit(unit, listings.map(fmtListing)));
    }
    return result;
  },
});

export const getById = query({
  args: { id: v.id("units") },
  handler: async (ctx, { id }) => {
    const unit = await ctx.db.get(id);
    if (!unit) return null;
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_unit", (q) => q.eq("unitId", unit._id))
      .collect();
    return fmtUnit(unit, listings.map(fmtListing));
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    address: v.string(),
    city: v.string(),
    province: v.string(),
    postalCode: v.string(),
    rent: v.number(),
    bedrooms: v.number(),
    bathrooms: v.number(),
    sqft: v.optional(v.number()),
    title: v.string(),
    description: v.string(),
    propertyType: v.string(),
    amenities: v.string(),
    photos: v.string(),
    availableFrom: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("units", {
      ...args,
      isActive: true,
      updatedAt: Date.now(),
    });
    const unit = (await ctx.db.get(id))!;
    return fmtUnit(unit, []);
  },
});

export const update = mutation({
  args: {
    id: v.id("units"),
    title: v.optional(v.string()),
    description: v.optional(v.string()),
    rent: v.optional(v.number()),
    bedrooms: v.optional(v.number()),
    bathrooms: v.optional(v.number()),
    sqft: v.optional(v.number()),
    amenities: v.optional(v.string()),
    photos: v.optional(v.string()),
    videoUrl: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
    availableFrom: v.optional(v.number()),
    clearAvailableFrom: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, clearAvailableFrom, ...data }) => {
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [k, v2] of Object.entries(data)) {
      if (v2 !== undefined) patch[k] = v2;
    }
    if (clearAvailableFrom) patch.availableFrom = undefined;
    await ctx.db.patch(id, patch);
    const unit = (await ctx.db.get(id))!;
    const listings = await ctx.db
      .query("listings")
      .withIndex("by_unit", (q) => q.eq("unitId", id))
      .collect();
    return fmtUnit(unit, listings.map(fmtListing));
  },
});

export const remove = mutation({
  args: { id: v.id("units") },
  handler: async (ctx, { id }) => {
    const listings = await ctx.db.query("listings").withIndex("by_unit", (q) => q.eq("unitId", id)).collect();
    for (const l of listings) await ctx.db.delete(l._id);

    const tenants = await ctx.db.query("tenants").withIndex("by_unit", (q) => q.eq("unitId", id)).collect();
    for (const t of tenants) await ctx.db.delete(t._id);

    const maintenance = await ctx.db.query("maintenanceRequests").withIndex("by_unit", (q) => q.eq("unitId", id)).collect();
    for (const m of maintenance) await ctx.db.delete(m._id);

    const expenses = await ctx.db.query("expenses").filter((q) => q.eq(q.field("unitId"), id)).collect();
    for (const e of expenses) await ctx.db.delete(e._id);

    await ctx.db.delete(id);
    return null;
  },
});
