import { paginationOptsValidator } from "convex/server";
import { query, mutation } from "./_generated/server";
import type { QueryCtx } from "./_generated/server";
import type { Doc } from "./_generated/dataModel";
import { v } from "convex/values";

function orderedArtworks(ctx: QueryCtx) {
  return ctx.db.query("artworks").withIndex("by_sort_order").order("desc");
}

function chronologicalArtworks(ctx: QueryCtx) {
  return ctx.db.query("artworks").withIndex("by_sort_order").order("asc");
}

async function cycleArtwork(ctx: QueryCtx, artwork: Doc<"artworks"> | null) {
  if (!artwork) return null;

  return {
    _id: artwork._id,
    _creationTime: artwork._creationTime,
    sortOrder: artwork.sortOrder,
    title: artwork.title,
    pieceTitle: artwork.pieceTitle,
    description: artwork.description,
    statement: artwork.statement,
    imageUrl: await ctx.storage.getUrl(artwork.imageId),
  };
}

async function firstCycleArtwork(ctx: QueryCtx) {
  return await chronologicalArtworks(ctx).first();
}

async function nextCycleArtwork(ctx: QueryCtx, sortOrder: number | undefined) {
  if (sortOrder === undefined) return await firstCycleArtwork(ctx);

  return await ctx.db
    .query("artworks")
    .withIndex("by_sort_order", (q) => q.gt("sortOrder", sortOrder))
    .order("asc")
    .first();
}

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

export const getCycleWindow = query({
  args: { currentSortOrder: v.optional(v.number()) },
  handler: async (ctx, args) => {
    const current =
      args.currentSortOrder === undefined
        ? await firstCycleArtwork(ctx)
        : (await ctx.db
            .query("artworks")
            .withIndex("by_sort_order", (q) => q.eq("sortOrder", args.currentSortOrder))
            .first()) ?? (await firstCycleArtwork(ctx));

    if (!current) return { current: null, next: null, nextWrapped: false };

    let next = await nextCycleArtwork(ctx, current.sortOrder);
    let nextWrapped = false;

    if (!next) {
      next = await firstCycleArtwork(ctx);
      nextWrapped = true;
    }

    if (next?._id === current._id) nextWrapped = true;

    return {
      current: await cycleArtwork(ctx, current),
      next: await cycleArtwork(ctx, next),
      nextWrapped,
    };
  },
});

export const listGalleryPage = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const page = await orderedArtworks(ctx).paginate(args.paginationOpts);
    const items = await Promise.all(
      page.page.map(async (artwork) => ({
        _id: artwork._id,
        _creationTime: artwork._creationTime,
        sortOrder: artwork.sortOrder,
        title: artwork.title,
        pieceTitle: artwork.pieceTitle,
        imageUrl: await ctx.storage.getUrl(artwork.imageId),
      }))
    );

    return { ...page, page: items };
  },
});

export const listEvolutionPage = query({
  args: { paginationOpts: paginationOptsValidator },
  handler: async (ctx, args) => {
    const page = await orderedArtworks(ctx).paginate(args.paginationOpts);
    const items = await Promise.all(
      page.page.map(async (artwork) => ({
        _id: artwork._id,
        _creationTime: artwork._creationTime,
        sortOrder: artwork.sortOrder,
        title: artwork.title,
        pieceTitle: artwork.pieceTitle,
        imageUrl: await ctx.storage.getUrl(artwork.imageId),
        statement: artwork.statement,
        artistThinking: artwork.artistThinking,
        inspirationEntry: artwork.inspirationEntry,
        evolutionEntry: artwork.evolutionEntry,
      }))
    );

    return { ...page, page: items };
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
    artistMission: v.optional(v.string()),
    inspirationEntry: v.optional(v.string()),
    evolutionEntry: v.optional(v.string()),
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
    artistMission: v.optional(v.string()),
    inspirationEntry: v.optional(v.string()),
    evolutionEntry: v.optional(v.string()),
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
