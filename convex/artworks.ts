import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const artworks = await ctx.db.query("artworks").collect();

    return Promise.all(
      artworks.map(async (artwork) => {
        const imageUrl = await ctx.storage.getUrl(artwork.imageId);
        return { ...artwork, imageUrl };
      })
    );
  },
});

export const getFeatured = query({
  args: {},
  handler: async (ctx) => {
    const artworks = await ctx.db
      .query("artworks")
      .withIndex("by_featured", (q) => q.eq("featured", true))
      .collect();

    return Promise.all(
      artworks.map(async (artwork) => {
        const imageUrl = await ctx.storage.getUrl(artwork.imageId);
        return { ...artwork, imageUrl };
      })
    );
  },
});

export const getById = query({
  args: { id: v.id("artworks") },
  handler: async (ctx, args) => {
    const artwork = await ctx.db.get(args.id);
    if (!artwork) return null;

    const imageUrl = await ctx.storage.getUrl(artwork.imageId);
    return { ...artwork, imageUrl };
  },
});

export const create = mutation({
  args: {
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
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("artworks", args);
  },
});

export const update = mutation({
  args: {
    id: v.id("artworks"),
    title: v.optional(v.string()),
    pieceTitle: v.optional(v.string()),
    description: v.optional(v.string()),
    imageId: v.optional(v.id("_storage")),
    year: v.optional(v.number()),
    medium: v.optional(v.string()),
    prompt: v.optional(v.string()),
    statement: v.optional(v.string()),
    artistThinking: v.optional(v.string()),
    sortOrder: v.optional(v.number()),
    isAvailable: v.optional(v.boolean()),
    featured: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    return await ctx.db.patch(id, updates);
  },
});

export const remove = mutation({
  args: { id: v.id("artworks") },
  handler: async (ctx, args) => {
    return await ctx.db.delete(args.id);
  },
});

export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    return await ctx.storage.generateUploadUrl();
  },
});
