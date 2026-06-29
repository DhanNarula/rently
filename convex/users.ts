import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

function fmt(doc: { _id: string; _creationTime: number; clerkId: string; email: string; name?: string }) {
  return {
    id: doc._id,
    clerkId: doc.clerkId,
    email: doc.email,
    name: doc.name ?? null,
    createdAt: new Date(doc._creationTime).toISOString(),
  };
}

export const getByClerkId = query({
  args: { clerkId: v.string() },
  handler: async (ctx, { clerkId }) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
    return user ? fmt(user) : null;
  },
});

export const getOrCreate = mutation({
  args: { clerkId: v.string(), email: v.string() },
  handler: async (ctx, { clerkId, email }) => {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", clerkId))
      .unique();
    if (existing) return fmt(existing);
    const id = await ctx.db.insert("users", { clerkId, email });
    const user = (await ctx.db.get(id))!;
    return fmt(user);
  },
});
