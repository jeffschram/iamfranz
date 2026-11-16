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

  // "Chat with the Artist" — one row per message. sessionId is a random id
  // kept in the visitor's browser; it is the only key to a conversation.
  chatMessages: defineTable({
    sessionId: v.string(),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    status: v.union(v.literal("streaming"), v.literal("done"), v.literal("error")),
    // What the visitor had open when they wrote the message.
    artworkId: v.optional(v.id("artworks")),
    viewingTitle: v.optional(v.string()),
  }).index("by_session", ["sessionId"]),

  // Things the artist knows that don't belong to any one artwork (currently
  // just a digest of aesthetic-principles.md), published by the studio sync.
  artistContext: defineTable({
    key: v.string(),
    value: v.string(),
  }).index("by_key", ["key"]),

  // Site-wide message count per UTC day, used to cap API spend.
  chatUsage: defineTable({
    day: v.string(),
    count: v.number(),
  }).index("by_day", ["day"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
