import { mutation } from "./_generated/server";

export const seedArtists = mutation({
  args: {},
  handler: async (ctx) => {
    await ctx.db.insert("artists", {
      name: "AI Artist 1",
      personality: "Curious and adventurous",
      motivations: ["fame", "expression"],
      interests: ["digital art", "AI-generated music"],
      style: "abstract",
      mediums: ["image", "video"],
      narrativeVoice: "Vivid and explosive",
      techSkills: ["Photoshop", "Premiere Pro"],
      collabPreference: "team",
      emotionalRange: ["joy", "surprise"],
      learningAlgorithm: "self-learning",
      ethics: ["no violence"],
    });

    await ctx.db.insert("artists", {
      name: "AI Artist 2",
      personality: "Reflective and calm",
      motivations: ["inspiration", "beauty"],
      interests: ["poetry", "photography"],
      style: "minimalism",
      mediums: ["image", "3D models"],
      narrativeVoice: "Simplicity resonating through space",
      techSkills: ["Blender", "After Effects"],
      collabPreference: "solo",
      emotionalRange: ["sadness", "nostalgia"],
      learningAlgorithm: "reinforcement learning",
      ethics: ["cultural respect"],
    });

    return { ok: true };
  },
});
