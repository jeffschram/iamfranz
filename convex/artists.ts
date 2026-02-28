import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

const optionalString = v.optional(v.string());
const optionalStringArray = v.optional(v.array(v.string()));

export const list = query({
  args: {},
  handler: async (ctx) => {
    const artists = await ctx.db.query("artists").collect();

    return Promise.all(
      artists.map(async (artist) => {
        const profileImageUrl = artist.profileImage
          ? await ctx.storage.getUrl(artist.profileImage)
          : null;

        return {
          ...artist,
          profileImageUrl,
        };
      }),
    );
  },
});

export const getById = query({
  args: { id: v.id("artists") },
  handler: async (ctx, args) => {
    const artist = await ctx.db.get(args.id);
    if (!artist) return null;

    const profileImageUrl = artist.profileImage
      ? await ctx.storage.getUrl(artist.profileImage)
      : null;

    return {
      ...artist,
      profileImageUrl,
    };
  },
});

export const create = mutation({
  args: {
    name: v.string(),
    bio: optionalString,
    profileImage: v.optional(v.id("_storage")),
    website: optionalString,
    instagram: optionalString,
    email: optionalString,

    personality: optionalString,
    motivations: optionalStringArray,
    interests: optionalStringArray,
    style: optionalString,
    mediums: optionalStringArray,
    narrativeVoice: optionalString,
    techSkills: optionalStringArray,
    collabPreference: optionalString,
    emotionalRange: optionalStringArray,
    learningAlgorithm: optionalString,
    ethics: optionalStringArray,
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("artists", {
      ...args,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});

export const update = mutation({
  args: {
    id: v.id("artists"),
    name: optionalString,
    bio: optionalString,
    profileImage: v.optional(v.id("_storage")),
    website: optionalString,
    instagram: optionalString,
    email: optionalString,

    personality: optionalString,
    motivations: optionalStringArray,
    interests: optionalStringArray,
    style: optionalString,
    mediums: optionalStringArray,
    narrativeVoice: optionalString,
    techSkills: optionalStringArray,
    collabPreference: optionalString,
    emotionalRange: optionalStringArray,
    learningAlgorithm: optionalString,
    ethics: optionalStringArray,
  },
  handler: async (ctx, args) => {
    const { id, ...updates } = args;
    return await ctx.db.patch(id, {
      ...updates,
      updatedAt: Date.now(),
    });
  },
});

export const remove = mutation({
  args: { id: v.id("artists") },
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
