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

    const sorted = rows.sort((a, b) => b.date.localeCompare(a.date));
    return sorted.slice(0, args.limit ?? 14);
  },
});

export const upsertDaily = mutation({
  args: {
    artistId: v.id("artists"),
    date: v.string(),
    summary: v.string(),
    interests: v.optional(v.array(v.string())),
    inspiration: v.optional(v.array(v.string())),
    score: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("artistUpdates")
      .withIndex("by_artist_date", (q) => q.eq("artistId", args.artistId).eq("date", args.date))
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, {
        summary: args.summary,
        interests: args.interests,
        inspiration: args.inspiration,
        score: args.score,
      });
      return existing._id;
    }

    return await ctx.db.insert("artistUpdates", {
      ...args,
      createdAt: Date.now(),
    });
  },
});
