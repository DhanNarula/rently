import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import type { Id } from "./_generated/dataModel";

function fmt(
  e: {
    _id: string;
    _creationTime: number;
    userId: Id<"users">;
    unitId?: Id<"units">;
    title: string;
    amount: number;
    category: string;
    date: number;
    receiptUrl?: string;
    notes?: string;
    taxYear: number;
  },
  unit: { address: string; city: string } | null
) {
  return {
    id: e._id,
    userId: e.userId,
    unitId: e.unitId ?? null,
    title: e.title,
    amount: e.amount,
    category: e.category,
    date: new Date(e.date).toISOString(),
    receiptUrl: e.receiptUrl ?? null,
    notes: e.notes ?? null,
    taxYear: e.taxYear,
    createdAt: new Date(e._creationTime).toISOString(),
    unit,
  };
}

export const listByUser = query({
  args: { userId: v.id("users") },
  handler: async (ctx, { userId }) => {
    const expenses = await ctx.db
      .query("expenses")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .collect();
    const result = [];
    for (const e of expenses) {
      let unit: { address: string; city: string } | null = null;
      if (e.unitId) {
        const u = await ctx.db.get(e.unitId);
        if (u) unit = { address: u.address, city: u.city };
      }
      result.push(fmt(e, unit));
    }
    return result;
  },
});

export const getById = query({
  args: { id: v.id("expenses") },
  handler: async (ctx, { id }) => {
    const e = await ctx.db.get(id);
    if (!e) return null;
    let unit: { address: string; city: string } | null = null;
    if (e.unitId) {
      const u = await ctx.db.get(e.unitId);
      if (u) unit = { address: u.address, city: u.city };
    }
    return fmt(e, unit);
  },
});

export const create = mutation({
  args: {
    userId: v.id("users"),
    unitId: v.optional(v.id("units")),
    title: v.string(),
    amount: v.number(),
    category: v.string(),
    date: v.number(),
    receiptUrl: v.optional(v.string()),
    notes: v.optional(v.string()),
    taxYear: v.number(),
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("expenses", args);
    const e = (await ctx.db.get(id))!;
    let unit: { address: string; city: string } | null = null;
    if (e.unitId) {
      const u = await ctx.db.get(e.unitId);
      if (u) unit = { address: u.address, city: u.city };
    }
    return fmt(e, unit);
  },
});

export const update = mutation({
  args: {
    id: v.id("expenses"),
    title: v.optional(v.string()),
    amount: v.optional(v.number()),
    category: v.optional(v.string()),
    notes: v.optional(v.string()),
    receiptUrl: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...data }) => {
    const patch: Record<string, unknown> = {};
    for (const [k, v2] of Object.entries(data)) {
      if (v2 !== undefined) patch[k] = v2;
    }
    await ctx.db.patch(id, patch);
    const e = (await ctx.db.get(id))!;
    let unit: { address: string; city: string } | null = null;
    if (e.unitId) {
      const u = await ctx.db.get(e.unitId);
      if (u) unit = { address: u.address, city: u.city };
    }
    return fmt(e, unit);
  },
});

export const remove = mutation({
  args: { id: v.id("expenses") },
  handler: async (ctx, { id }) => {
    await ctx.db.delete(id);
    return null;
  },
});
