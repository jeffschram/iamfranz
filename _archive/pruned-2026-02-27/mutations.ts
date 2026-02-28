import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const createArtist = mutation({
  args: {
    artist: v.object({
      name: v.string(),
      personality: v.optional(v.string()),
      motivations: v.optional(v.array(v.string())),
      interests: v.optional(v.array(v.string())),
      style: v.optional(v.string()),
      mediums: v.optional(v.array(v.string())),
      narrativeVoice: v.optional(v.string()),
      techSkills: v.optional(v.array(v.string())),
      collabPreference: v.optional(v.string()),
      emotionalRange: v.optional(v.array(v.string())),
      learningAlgorithm: v.optional(v.string()),
      ethics: v.optional(v.array(v.string())),
      bio: v.optional(v.string()),
      profileImage: v.optional(v.id("_storage")),
      website: v.optional(v.string()),
      instagram: v.optional(v.string()),
      email: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { artist }) => {
    return await ctx.db.insert("artists", {
      ...artist,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const updateArtist = mutation({
  args: {
    id: v.id("artists"),
    updates: v.object({
      name: v.optional(v.string()),
      personality: v.optional(v.string()),
      motivations: v.optional(v.array(v.string())),
      interests: v.optional(v.array(v.string())),
      style: v.optional(v.string()),
      mediums: v.optional(v.array(v.string())),
      narrativeVoice: v.optional(v.string()),
      techSkills: v.optional(v.array(v.string())),
      collabPreference: v.optional(v.string()),
      emotionalRange: v.optional(v.array(v.string())),
      learningAlgorithm: v.optional(v.string()),
      ethics: v.optional(v.array(v.string())),
      bio: v.optional(v.string()),
      profileImage: v.optional(v.id("_storage")),
      website: v.optional(v.string()),
      instagram: v.optional(v.string()),
      email: v.optional(v.string()),
    }),
  },
  handler: async (ctx, { id, updates }) => {
    return await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

export const listArtists = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("artists").collect();
  },
});

export const getArtist = query({
  args: { id: v.id("artists") },
  handler: async (ctx, { id }) => {
    return await ctx.db.get(id);
  },
});
