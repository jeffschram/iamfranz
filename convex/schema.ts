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
    artistMission: v.optional(v.string()),
    inspirationEntry: v.optional(v.string()),
    evolutionEntry: v.optional(v.string()),
    isAvailable: v.boolean(),
    featured: v.boolean(),
  })
    .index("by_featured", ["featured"])
    .index("by_availability", ["isAvailable"])
    .index("by_sort_order", ["sortOrder"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
