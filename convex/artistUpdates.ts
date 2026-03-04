import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const listByArtist = query({
  args: {
    artistId: v.id("artists"),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const rows = await ctx.db
      .query("artistUpdates")
      .withIndex("by_artist", (q) => q.eq("artistId", args.artistId))
      .collect();

    const sorted = rows.sort((a, b) => (b.runId ?? b.date).localeCompare(a.runId ?? a.date));
    return sorted.slice(0, args.limit ?? 14);
  },
});

export const upsertDaily = mutation({
  args: {
    artistId: v.id("artists"),
    date: v.string(),
    runId: v.string(),
    summary: v.string(),
    interests: v.optional(v.array(v.string())),
    inspiration: v.optional(v.array(v.string())),
    score: v.optional(v.number()),

    pieceTitle: v.optional(v.string()),
    hypothesis: v.optional(v.string()),
    experimentOutcome: v.optional(v.string()),
    arcName: v.optional(v.string()),
    arcStep: v.optional(v.number()),

    noveltyDelta: v.optional(v.number()),
    coherence: v.optional(v.number()),
    risk: v.optional(v.number()),

    adoptedRefs: v.optional(v.array(v.string())),
    resistedRef: v.optional(v.string()),
    constraintBroken: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("artistUpdates")
      .withIndex("by_artist_run", (q) => q.eq("artistId", args.artistId).eq("runId", args.runId))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        ...args,
      });
      return existing._id;
    }

    return await ctx.db.insert("artistUpdates", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
