import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

const applicationTables = {
  artworks: defineTable({
    title: v.string(),
    pieceTitle: v.optional(v.string()),
    description: v.string(),
    imageId: v.id("_storage"),
    year: v.number(),
    medium: v.string(),
    prompt: v.optional(v.string()),
    statement: v.optional(v.string()),
    artistThinking: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    isAvailable: v.boolean(),
    featured: v.boolean(),
  })
    .index("by_featured", ["featured"])
    .index("by_availability", ["isAvailable"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
