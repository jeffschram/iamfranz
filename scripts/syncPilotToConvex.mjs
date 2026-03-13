#!/usr/bin/env node
// LEGACY: retained from the retired three-artist runtime/import flow.
// Keep intact for now, but do not expand this as the future publishing contract.
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';

dotenv.config({ path: path.resolve('.env.local') });

const runId = process.argv.includes('--runId')
  ? process.argv[process.argv.indexOf('--runId') + 1]
  : new Date().toISOString().replace(/[:]/g, '-').slice(0, 19).replace('T', '_');
const date = process.argv.includes('--date')
  ? process.argv[process.argv.indexOf('--date') + 1]
  : runId.slice(0, 10);
const dayDir = process.argv.includes('--dayDir')
  ? process.argv[process.argv.indexOf('--dayDir') + 1]
  : `runs/${runId}`;

const convexUrl = process.env.VITE_CONVEX_URL;
if (!convexUrl) throw new Error('Missing VITE_CONVEX_URL in .env.local');

const client = new ConvexHttpClient(convexUrl);

const ARTISTS = [
  {
    slug: 'riker',
    legacySlugs: ['a1-maximalist-poet'],
    name: 'Riker',
    bio: 'Lyrical AI artist exploring emotional symbolism and layered digital collage.',
    personality: 'Expressive, introspective, dramatic',
    style: 'Maximalist neo-symbolism',
    mediums: ['digital collage', 'painterly textures'],
  },
  {
    slug: 'bill',
    legacySlugs: ['a2-systems-minimalist'],
    name: 'Bill',
    bio: 'Constraint-first AI artist working in sparse geometric compositions.',
    personality: 'Methodical, precise, meditative',
    style: 'Geometric minimalism',
    mediums: ['generative geometry', 'vector abstraction'],
  },
  {
    slug: 'milo',
    legacySlugs: ['a3-glitch-documentarian'],
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


function isFallbackPng(buffer) {
  if (!buffer || buffer.length < 24) return false;
  const pngSig = buffer.slice(0, 8).toString('hex') === '89504e470d0a1a0a';
  if (!pngSig) return false;
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return width === 1 && height === 1;
}

async function uploadPng(filePath) {
  const bytes = await fs.readFile(filePath);
  if (isFallbackPng(bytes)) {
    return { skippedFallback: true };
  }

  const uploadUrl = await client.mutation(api.artworks.generateUploadUrl, {});
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


async function resolveArtistSlug(absDayDir, artist) {
  const candidates = [artist.slug, ...(artist.legacySlugs ?? [])];
  for (const candidate of candidates) {
    const candidates = [
      path.join(absDayDir, 'artists', candidate, 'outputs', `${runId}_${candidate}_final.png`),
      path.join(absDayDir, 'artists', candidate, 'outputs', `${date}_${candidate}_final.png`),
    ];
    for (const finalPath of candidates) {
      try {
        await fs.access(finalPath);
        return candidate;
      } catch {}
    }
  }
  return artist.slug;
}

async function main() {
  const absDayDir = path.resolve(dayDir);
  let created = 0;
  let skipped = 0;
  let skippedFallback = 0;
  let skippedMissing = 0;

  for (const artist of ARTISTS) {
    const artistId = await ensureArtist(artist);
    const slugForDay = await resolveArtistSlug(absDayDir, artist);
    const finalCandidates = [
      path.join(absDayDir, 'artists', slugForDay, 'outputs', `${runId}_${slugForDay}_final.png`),
      path.join(absDayDir, 'artists', slugForDay, 'outputs', `${date}_${slugForDay}_final.png`),
    ];
    let finalPath = finalCandidates[0];
    for (const c of finalCandidates) {
      try { await fs.access(c); finalPath = c; break; } catch {}
    }
    const title = `${runId} — ${artist.name} — Pilot Run Output`;


    const recordCandidates = [
      path.join(absDayDir, 'artists', slugForDay, 'inputs', `${runId}_record.json`),
      path.join(absDayDir, 'artists', slugForDay, 'inputs', `${date}_record.json`),
    ];
    let recordPath = recordCandidates[0];
    for (const c of recordCandidates) { try { await fs.access(c); recordPath = c; break; } catch {} }
    const record = JSON.parse(await fs.readFile(recordPath, 'utf8'));

    if (await artworkExists(title)) {
      skipped += 1;
    } else {
      try {
        await fs.access(finalPath);
      } catch {
        skippedMissing += 1;
        continue;
      }

      const upload = await uploadPng(finalPath);
      if (upload.skippedFallback) {
        skippedFallback += 1;
      } else {
        const storageId = upload;
        await client.mutation(api.artworks.create, {
        title,
        pieceTitle: record?.finalOutput?.pieceTitle ?? undefined,
        description: record?.finalOutput?.rationale ?? `Autonomous pilot output for ${artist.name} (${date}).`,
        artistId,
        imageId: storageId,
        year: Number(date.slice(0, 4)),
        medium: artist.mediums[0],
        prompt: record?.finalOutput?.prompt ?? undefined,
        artistThinking: record?.finalOutput?.artistThinking ?? undefined,
        inspirationNote: record?.finalOutput?.inspirationNote ?? undefined,
        researchSourceTitle: record?.researchTrail?.[0]?.title ?? undefined,
        researchSourceUrl: record?.researchTrail?.[0]?.url ?? undefined,
        learningTechnique: record?.learnings?.technique ?? undefined,
        learningConcept: record?.learnings?.concept ?? undefined,
        learningVisual: record?.learnings?.visual ?? undefined,
        dimensions: '1024x1024',
        price: undefined,
        isAvailable: true,
        featured: true,
      });
        created += 1;
      }
    }

    const scoreCandidates = [
      path.join(absDayDir, 'curator', 'scores', `${runId}_${slugForDay}_score.json`),
      path.join(absDayDir, 'curator', 'scores', `${date}_${slugForDay}_score.json`),
    ];
    let scorePath = scoreCandidates[0];
    for (const c of scoreCandidates) { try { await fs.access(c); scorePath = c; break; } catch {} }

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
      runId,
      summary,
      interests: record.constraints ?? [],
      inspiration: inspirations,
      score: score.total,

      pieceTitle: record?.finalOutput?.pieceTitle ?? undefined,
      hypothesis: record?.hypothesis ?? undefined,
      experimentOutcome: record?.finalOutput?.rationale ?? undefined,
      arcName: record?.experiment?.arc?.name ?? undefined,
      arcStep: record?.experiment?.arc?.step ?? undefined,

      noveltyDelta: record?.evolution?.scoreDelta ?? undefined,
      coherence: record?.selfCritique?.coherence ?? undefined,
      risk: record?.styleGenomeAfter?.risk ?? record?.styleGenomeBefore?.risk ?? undefined,

      adoptedRefs: (record?.influencePlan?.adopt ?? []).map((x) => x.title),
      resistedRef: record?.influencePlan?.resist?.title ?? undefined,
      constraintBroken: record?.influencePlan?.breakConstraint ?? undefined,
    });
  }

  console.log(`Sync complete. runId=${runId} created=${created} skipped=${skipped} skippedFallback=${skippedFallback} skippedMissing=${skippedMissing}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
