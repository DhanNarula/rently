import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

function fmt(
  r: {
    _id: string;
    _creationTime: number;
    unitId: Id<"units">;
    tenantId?: Id<"tenants">;
    title: string;
    description?: string;
    category: string;
    priority: string;
    status: string;
    cost?: number;
    vendor?: string;
    resolvedAt?: number;
    updatedAt: number;
  },
  unit: { address: string; city: string } | null
) {
  return {
    id: r._id,
    unitId: r.unitId,
    tenantId: r.tenantId ?? null,
    title: r.title,
    description: r.description ?? null,
    category: r.category,
    priority: r.priority,
    status: r.status,
    cost: r.cost ?? null,
    vendor: r.vendor ?? null,
    resolvedAt: r.resolvedAt ? new Date(r.resolvedAt).toISOString() : null,
    createdAt: new Date(r._creationTime).toISOString(),
    updatedAt: new Date(r.updatedAt).toISOString(),
    unit,
  };
}

export const listByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const userUnits = await ctx.db
      .query("units")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .collect();
    const unitIds = new Set(userUnits.map((u) => u._id));
    const unitMap = new Map(userUnits.map((u) => [u._id, u]));

    const result = [];
    for (const unit of userUnits) {
      const requests = await ctx.db
        .query("maintenanceRequests")
        .withIndex("by_unit", (q) => q.eq("unitId", unit._id))
        .order("desc")
        .collect();
      for (const r of requests) {
        result.push(fmt(r, { address: unit.address, city: unit.city }));
      }
    }
    // Sort all by createdAt desc
    result.sort((a, b) => (a.createdAt > b.createdAt ? -1 : 1));
    void unitIds; void unitMap;
    return result;
  },
});

export const getById = query({
  args: { id: v.id("maintenanceRequests") },
  handler: async (ctx, { id }) => {
    const r = await ctx.db.get(id);
    if (!r) return null;
    const unit = await ctx.db.get(r.unitId);
    return fmt(r, unit ? { address: unit.address, city: unit.city } : null);
  },
});

export const create = mutation({
  args: {
    unitId: v.id("units"),
    title: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    priority: v.string(),
    vendor: v.optional(v.string()),
    cost: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("maintenanceRequests", {
      ...args,
      status: "open",
      updatedAt: Date.now(),
    });
    const r = (await ctx.db.get(id))!;
    const unit = await ctx.db.get(r.unitId);
    return fmt(r, unit ? { address: unit.address, city: unit.city } : null);
  },
});

export const update = mutation({
  args: {
    id: v.id("maintenanceRequests"),
    status: v.optional(v.string()),
    cost: v.optional(v.number()),
    vendor: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
    setResolvedNow: v.optional(v.boolean()),
  },
  handler: async (ctx, { id, setResolvedNow, ...data }) => {
    const patch: Record<string, unknown> = { updatedAt: Date.now() };
    for (const [k, v2] of Object.entries(data)) {
      if (v2 !== undefined) patch[k] = v2;
    }
    if (setResolvedNow) patch.resolvedAt = Date.now();
    await ctx.db.patch(id, patch);
    const r = (await ctx.db.get(id))!;
    const unit = await ctx.db.get(r.unitId);
    return fmt(r, unit ? { address: unit.address, city: unit.city } : null);
  },
});

export const remove = mutation({
  args: { id: v.id("maintenanceRequests") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return null;
  },
});
