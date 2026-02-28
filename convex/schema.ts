import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

// Legacy admin form shape used in parts of the app.
export type Artist = {
  name: string;
  personality: string;
  motivations: string[];
  interests: string[];
  style: string;
  mediums: string[];
  narrativeVoice?: string;
  techSkills?: string[];
  collabPreference?: string;
  emotionalRange?: string[];
  learningAlgorithm?: string;
  ethics?: string[];
  bio?: string;
  profileImage?: string;
  website?: string;
  instagram?: string;
  email?: string;
  createdAt?: number;
  updatedAt?: number;
};

const applicationTables = {
  artists: defineTable({
    name: v.string(),

    // "Persona" fields
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

    // Gallery profile fields used by convex/artists.ts
    bio: v.optional(v.string()),
    profileImage: v.optional(v.id("_storage")),
    website: v.optional(v.string()),
    instagram: v.optional(v.string()),
    email: v.optional(v.string()),

    // Legacy mutation timestamps
    createdAt: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  }),

  artworks: defineTable({
    title: v.string(),
    description: v.string(),
    artistId: v.id("artists"),
    imageId: v.id("_storage"),
    year: v.number(),
    medium: v.string(),
    dimensions: v.optional(v.string()),
    price: v.optional(v.number()),
    isAvailable: v.boolean(),
    featured: v.boolean(),
  })
    .index("by_artist", ["artistId"])
    .index("by_featured", ["featured"])
    .index("by_availability", ["isAvailable"]),

  artistUpdates: defineTable({
    artistId: v.id("artists"),
    date: v.string(),
    summary: v.string(),
    interests: v.optional(v.array(v.string())),
    inspiration: v.optional(v.array(v.string())),
    score: v.optional(v.number()),
    createdAt: v.number(),
  })
    .index("by_artist", ["artistId"])
    .index("by_artist_date", ["artistId", "date"]),
};

export default defineSchema({
  ...authTables,
  ...applicationTables,
});
