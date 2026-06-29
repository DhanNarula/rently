import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

function fmt(doc: {
  _id: string;
  _creationTime: number;
  clerkId: string;
  email: string;
  sessionState?: string;
  groups: string;
  updatedAt: number;
}) {
  return {
    id: doc._id,
    clerkId: doc.clerkId,
    email: doc.email,
    sessionState: doc.sessionState ?? null,
    groups: doc.groups,
    createdAt: new Date(doc._creationTime).toISOString(),
    updatedAt: new Date(doc.updatedAt).toISOString(),
  };
}

export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    const account = await ctx.db
      .query("fbAccounts")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
    return account ? fmt(account) : null;
  },
});

export const upsert = mutation({
  args: {
    clerkId: v.string(),
    email: v.string(),
    sessionState: v.optional(v.string()),
    groups: v.optional(v.string()),
  },
  handler: async (ctx, { clerkId, email, sessionState, groups }) => {
    const existing = await ctx.db
      .query("fbAccounts")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
    const now = Date.now();
    if (existing) {
      await ctx.db.patch(existing._id, {
        email,
        ...(sessionState !== undefined && { sessionState }),
        ...(groups !== undefined && { groups }),
        updatedAt: now,
      });
      const updated = (await ctx.db.get(existing._id))!;
      return fmt(updated);
    }
    const id = await ctx.db.insert("fbAccounts", {
      clerkId,
      email,
      sessionState,
      groups: groups ?? "[]",
      updatedAt: now,
    });
    const account = (await ctx.db.get(id))!;
    return fmt(account);
  },
});

export const updateGroups = mutation({
  args: { clerkId: v.string(), groups: v.string() },
  handler: async (ctx, { clerkId, groups }) => {
    const account = await ctx.db
      .query("fbAccounts")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
    if (!account) return null;
    await ctx.db.patch(account._id, { groups, updatedAt: Date.now() });
    const updated = (await ctx.db.get(account._id))!;
    return fmt(updated);
  },
});

export const updateSession = mutation({
  args: { clerkId: v.string(), sessionState: v.string() },
  handler: async (ctx, { clerkId, sessionState }) => {
    const account = await ctx.db
      .query("fbAccounts")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
    if (!account) return null;
    await ctx.db.patch(account._id, { sessionState, updatedAt: Date.now() });
    return true;
  },
});

export const listAllWithSession = query({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("fbAccounts").collect();
    return all
      .filter((a) => !!a.sessionState)
      .map(fmt);
  },
});

export const remove = mutation({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    const accounts = await ctx.db
      .query("fbAccounts")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .collect();
    for (const a of accounts) await ctx.db.delete(a._id);
    return null;
  },
});
