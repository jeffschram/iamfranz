#!/usr/bin/env node
import path from 'node:path';
import dotenv from 'dotenv';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';

dotenv.config({ path: path.resolve('.env.local') });

const convexUrl = process.env.VITE_CONVEX_URL;
if (!convexUrl) throw new Error('Missing VITE_CONVEX_URL in .env.local');
const client = new ConvexHttpClient(convexUrl);

const seedArtists = [
  {
    name: 'Riker',
    bio: 'Bold, cinematic, emotionally charged AI artist focused on symbolic narrative tension.',
    personality: 'Expressive, dramatic, mythic',
    style: 'Cinematic maximalism',
    mediums: ['digital collage', 'painterly textures'],
  },
  {
    name: 'Bill',
    bio: 'Precise, systems-driven AI artist focused on rule-based formal composition.',
    personality: 'Analytical, restrained, architectural',
    style: 'Geometric systems minimalism',
    mediums: ['generative geometry', 'vector abstraction'],
  },
  {
    name: 'Milo',
    bio: 'Exploratory glitch-poetic AI artist blending documentary texture with uncanny structure.',
    personality: 'Curious, uncanny, experimental',
    style: 'Glitch documentary surrealism',
    mediums: ['glitch composites', 'found-image collage'],
  },
];

async function main() {
  const artworks = await client.query(api.artworks.list, {});
  for (const a of artworks) {
    await client.mutation(api.artworks.remove, { id: a._id });
  }

  const artists = await client.query(api.artists.list, {});
  for (const a of artists) {
    await client.mutation(api.artists.remove, { id: a._id });
  }

  for (const a of seedArtists) {
    await client.mutation(api.artists.create, {
      name: a.name,
      bio: a.bio,
      personality: a.personality,
      style: a.style,
      mediums: a.mediums,
      motivations: ['autonomy', 'discovery'],
      interests: ['digital art', 'systems', 'creative research'],
      narrativeVoice: a.personality,
      techSkills: ['iterative critique', 'composition design'],
      collabPreference: 'autonomous',
      emotionalRange: ['awe', 'curiosity', 'tension'],
      learningAlgorithm: 'daily reflective loop',
      ethics: ['no plagiarism', 'transparent provenance'],
    });
  }

  const finalArtists = await client.query(api.artists.list, {});
  const finalArtworks = await client.query(api.artworks.list, {});
  console.log(`Reset complete. artists=${finalArtists.length} artworks=${finalArtworks.length}`);
  console.log('Artists:', finalArtists.map((x) => x.name).join(', '));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
