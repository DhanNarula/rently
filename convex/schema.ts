import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(),
    email: v.string(),
    name: v.optional(v.string()),
  }).index("by_clerk_id", ["clerkId"]),

  units: defineTable({
    userId: v.id("users"),
    address: v.string(),
    city: v.string(),
    province: v.string(),
    postalCode: v.string(),
    rent: v.number(),
    bedrooms: v.number(),
    bathrooms: v.number(),
    sqft: v.optional(v.number()),
    description: v.string(),
    title: v.string(),
    propertyType: v.string(),
    amenities: v.string(),
    photos: v.string(),
    videoUrl: v.optional(v.string()),
    availableFrom: v.optional(v.number()),
    isActive: v.boolean(),
    updatedAt: v.number(),
  }).index("by_user", ["userId"]),

  listings: defineTable({
    unitId: v.id("units"),
    externalId: v.optional(v.string()),
    platform: v.string(),
    groupId: v.optional(v.string()),
    groupName: v.optional(v.string()),
    fbPostId: v.optional(v.string()),
    status: v.string(),
    lastPostedAt: v.optional(v.number()),
    nextPostAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_unit", ["unitId"])
    .index("by_external_id", ["externalId"]),

  tenants: defineTable({
    unitId: v.id("units"),
    name: v.string(),
    email: v.optional(v.string()),
    phone: v.optional(v.string()),
    leaseStart: v.optional(v.number()),
    leaseEnd: v.optional(v.number()),
    rentAmount: v.number(),
    notes: v.optional(v.string()),
  }).index("by_unit", ["unitId"]),

  maintenanceRequests: defineTable({
    unitId: v.id("units"),
    tenantId: v.optional(v.id("tenants")),
    title: v.string(),
    description: v.optional(v.string()),
    category: v.string(),
    priority: v.string(),
    status: v.string(),
    cost: v.optional(v.number()),
    vendor: v.optional(v.string()),
    resolvedAt: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_unit", ["unitId"]),

  expenses: defineTable({
    userId: v.id("users"),
    unitId: v.optional(v.id("units")),
    title: v.string(),
    amount: v.number(),
    category: v.string(),
    date: v.number(),
    receiptUrl: v.optional(v.string()),
    notes: v.optional(v.string()),
    taxYear: v.number(),
  }).index("by_user", ["userId"]),

  fbAccounts: defineTable({
    clerkId: v.string(),
    email: v.string(),
    sessionState: v.optional(v.string()),
    groups: v.string(),
    updatedAt: v.number(),
  }).index("by_clerk_id", ["clerkId"]),
});
