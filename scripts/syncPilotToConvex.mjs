#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';

dotenv.config({ path: path.resolve('.env.local') });

const date = process.argv.includes('--date')
  ? process.argv[process.argv.indexOf('--date') + 1]
  : new Date().toISOString().slice(0, 10);
const dayDir = process.argv.includes('--dayDir')
  ? process.argv[process.argv.indexOf('--dayDir') + 1]
  : `runs/${date}_day1`;

const convexUrl = process.env.VITE_CONVEX_URL;
if (!convexUrl) throw new Error('Missing VITE_CONVEX_URL in .env.local');

const client = new ConvexHttpClient(convexUrl);

const ARTISTS = [
  {
    slug: 'a1-maximalist-poet',
    name: 'Riker',
    bio: 'Lyrical AI artist exploring emotional symbolism and layered digital collage.',
    personality: 'Expressive, introspective, dramatic',
    style: 'Maximalist neo-symbolism',
    mediums: ['digital collage', 'painterly textures'],
  },
  {
    slug: 'a2-systems-minimalist',
    name: 'Bill',
    bio: 'Constraint-first AI artist working in sparse geometric compositions.',
    personality: 'Methodical, precise, meditative',
    style: 'Geometric minimalism',
    mediums: ['generative geometry', 'vector abstraction'],
  },
  {
    slug: 'a3-glitch-documentarian',
    name: 'Milo',
    bio: 'Archival-noise AI artist blending documentary mood with glitch artifacts.',
    personality: 'Observational, haunted, curious',
    style: 'Glitch documentary surrealism',
    mediums: ['glitch photo composites', 'found imagery'],
  },
];

async function ensureArtist(artist) {
  const all = await client.query(api.artists.list, {});
  const existing = all.find((a) => a.name === artist.name);
  const payload = {
    name: artist.name,
    bio: artist.bio,
    personality: artist.personality,
    style: artist.style,
    mediums: artist.mediums,
    motivations: ['autonomy', 'discovery'],
    interests: ['ai art', 'creative systems'],
    narrativeVoice: artist.personality,
    techSkills: ['prompt composition', 'iterative critique'],
    collabPreference: 'autonomous',
    emotionalRange: ['awe', 'uncertainty', 'curiosity'],
    learningAlgorithm: 'iterative self-critique',
    ethics: ['no plagiarism', 'transparent provenance'],
  };

  if (existing) {
    await client.mutation(api.artists.update, { id: existing._id, ...payload });
    return existing._id;
  }

  return await client.mutation(api.artists.create, payload);
}

async function uploadPng(filePath) {
  const uploadUrl = await client.mutation(api.artworks.generateUploadUrl, {});
  const bytes = await fs.readFile(filePath);
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: bytes,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const data = await res.json();
  return data.storageId;
}

async function artworkExists(title) {
  const all = await client.query(api.artworks.list, {});
  return all.some((a) => a.title === title);
}

async function main() {
  const absDayDir = path.resolve(dayDir);
  let created = 0;
  let skipped = 0;

  for (const artist of ARTISTS) {
    const artistId = await ensureArtist(artist);
    const finalPath = path.join(absDayDir, 'artists', artist.slug, 'outputs', `${date}_${artist.slug}_final.png`);
    const title = `${date} — ${artist.name} — Pilot Day Output`;

    if (await artworkExists(title)) {
      skipped += 1;
    } else {
      const storageId = await uploadPng(finalPath);
      await client.mutation(api.artworks.create, {
        title,
        description: `Autonomous pilot output for ${artist.name} (${date}).`,
        artistId,
        imageId: storageId,
        year: Number(date.slice(0, 4)),
        medium: artist.mediums[0],
        dimensions: '1024x1024',
        price: undefined,
        isAvailable: true,
        featured: true,
      });
      created += 1;
    }

    const recordPath = path.join(absDayDir, 'artists', artist.slug, 'inputs', `${date}_record.json`);
    const scorePath = path.join(absDayDir, 'curator', 'scores', `${date}_${artist.slug}_score.json`);

    const record = JSON.parse(await fs.readFile(recordPath, 'utf8'));
    const score = JSON.parse(await fs.readFile(scorePath, 'utf8'));

    const inspirations = (record.researchTrail?.length
      ? record.researchTrail.map((x) => `${x.sourceNode}: ${x.url}`)
      : (record.inspiration ?? []).map((x) => `${x.source}: ${x.takeaway}`));
    const summary = [
      record.intent,
      record.researchTrail?.[0] ? `Research node: ${record.researchTrail[0].sourceNode}` : null,
      `Method: ${record.method}`,
      `Final rationale: ${record.finalOutput?.rationale ?? 'n/a'}`,
    ].filter(Boolean).join(' ');

    await client.mutation(api.artistUpdates.upsertDaily, {
      artistId,
      date,
      summary,
      interests: record.constraints ?? [],
      inspiration: inspirations,
      score: score.total,
    });
  }

  console.log(`Sync complete. created=${created} skipped=${skipped}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
