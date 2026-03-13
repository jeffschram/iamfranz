#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';

dotenv.config({ path: path.resolve('.env.local') });

const artifactDir = getArg('--artifactDir') || getArg('--dir');
const overwrite = hasFlag('--overwrite');
const dryRun = hasFlag('--dry-run');

if (!artifactDir) {
  console.error('Usage: node scripts/importIamfranzArtifact.mjs --artifactDir <path> [--overwrite] [--dry-run]');
  process.exit(1);
}

const convexUrl = process.env.VITE_CONVEX_URL;
if (!convexUrl && !dryRun) throw new Error('Missing VITE_CONVEX_URL in .env.local');

const client = dryRun ? null : new ConvexHttpClient(convexUrl);

function getArg(name) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return undefined;
  }
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeDateString(input) {
  if (!input) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString().slice(0, 10);
}

function inferYear(metadata) {
  if (metadata.year) return metadata.year;
  const date = normalizeDateString(metadata.publishedAt || metadata.createdAt);
  return date ? Number(date.slice(0, 4)) : new Date().getFullYear();
}

function resolveFile(baseDir, relativePath, fallbacks = []) {
  if (relativePath) return path.resolve(baseDir, relativePath);
  return fallbacks.map((name) => path.resolve(baseDir, name));
}

async function resolveImagePath(baseDir, metadata) {
  const explicit = metadata.image ? [path.resolve(baseDir, metadata.image)] : [];
  const fallbacks = ['image.png', 'image.jpg', 'image.jpeg', 'image.webp', 'artwork.png', 'artwork.jpg', 'artwork.jpeg', 'artwork.webp'];
  const candidates = [...explicit, ...fallbacks.map((name) => path.resolve(baseDir, name))];
  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }
  throw new Error(`No image found for artifact at ${baseDir}`);
}

async function ensureIamfranzArtist(client) {
  const artists = await client.query(api.artists.list, {});
  const existing = artists.find((artist) => artist.name === 'IAMFRANZ');
  const payload = {
    name: 'IAMFRANZ',
    bio: 'Public-facing artist profile for IAMFRANZ. The canonical runtime and working mind live in the OpenClaw agent workspace.',
    personality: 'Reflective, image-sensitive, process-aware',
    style: 'Emergent; intentionally under-defined during repurpose',
    mediums: ['digital image', 'prompted image study', 'process archive'],
    motivations: ['build authorship through selection and recurrence', 'publish selected works'],
    interests: ['interior atmosphere', 'constructed selfhood', 'ritualized composition'],
    narrativeVoice: 'restrained, precise, process-aware',
    techSkills: ['prompt design', 'iterative critique', 'curation'],
    collabPreference: 'agent-led with human stewardship',
    emotionalRange: ['curiosity', 'tension', 'stillness'],
    learningAlgorithm: 'practice -> selection -> reflection -> publication',
    ethics: ['transparent provenance', 'no plagiarism', 'curation over output spam'],
    website: undefined,
    instagram: undefined,
    email: undefined,
  };

  if (existing) {
    await client.mutation(api.artists.update, { id: existing._id, ...payload });
    return existing._id;
  }

  return await client.mutation(api.artists.create, payload);
}

async function uploadImage(client, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentType = ext === '.jpg' || ext === '.jpeg'
    ? 'image/jpeg'
    : ext === '.webp'
      ? 'image/webp'
      : 'image/png';
  const bytes = await fs.readFile(filePath);
  const uploadUrl = await client.mutation(api.artworks.generateUploadUrl, {});
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': contentType },
    body: bytes,
  });
  if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
  const data = await res.json();
  return data.storageId;
}

async function findExistingArtwork(client, title) {
  const artworks = await client.query(api.artworks.list, {});
  return artworks.find((artwork) => artwork.title === title) || null;
}

async function main() {
  const absDir = path.resolve(artifactDir);
  const metadataPath = path.join(absDir, 'metadata.json');
  const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'));

  if (!metadata.title) throw new Error('metadata.json is missing required field: title');
  if (!metadata.description) throw new Error('metadata.json is missing required field: description');

  const imagePath = await resolveImagePath(absDir, metadata);
  const promptPath = metadata.promptFile ? path.resolve(absDir, metadata.promptFile) : undefined;
  const processPath = metadata.processNoteFile
    ? path.resolve(absDir, metadata.processNoteFile)
    : (await exists(path.resolve(absDir, 'process.md')))
      ? path.resolve(absDir, 'process.md')
      : (await exists(path.resolve(absDir, 'reaction.md')))
        ? path.resolve(absDir, 'reaction.md')
        : (await exists(path.resolve(absDir, 'notes.md')))
          ? path.resolve(absDir, 'notes.md')
          : undefined;

  const promptText = promptPath ? await readTextIfExists(promptPath) : undefined;
  const processText = processPath ? await readTextIfExists(processPath) : undefined;

  const date = normalizeDateString(metadata.publishedAt || metadata.createdAt) || new Date().toISOString().slice(0, 10);
  const year = inferYear(metadata);
  const title = metadata.title;
  const pieceTitle = metadata.pieceTitle || metadata.title;
  const medium = metadata.medium || 'Digital image';
  const dimensions = metadata.dimensions || '1024x1024';
  const featured = Boolean(metadata.featured);
  const isAvailable = metadata.isAvailable ?? false;

  const artworkPayload = {
    title,
    pieceTitle,
    description: metadata.description,
    year,
    medium,
    prompt: promptText || metadata.promptExcerpt || undefined,
    artistThinking: processText || metadata.processNote || undefined,
    inspirationNote: metadata.series ? `Series: ${metadata.series}` : undefined,
    researchSourceTitle: metadata.research?.title,
    researchSourceUrl: metadata.research?.url,
    learningTechnique: metadata.learning?.technique,
    learningConcept: metadata.learning?.concept,
    learningVisual: metadata.learning?.visual,
    dimensions,
    price: undefined,
    isAvailable,
    featured,
  };

  const preview = {
    artifactDir: absDir,
    imagePath,
    metadata,
    artworkPayload,
  };

  if (dryRun) {
    console.log(JSON.stringify({ dryRun: true, preview }, null, 2));
    return;
  }

  const artistId = await ensureIamfranzArtist(client);
  const existing = await findExistingArtwork(client, title);
  const storageId = await uploadImage(client, imagePath);

  let artworkId;
  if (existing) {
    if (!overwrite) {
      console.log(`Artwork already exists with title: ${title}`);
      console.log('Re-run with --overwrite to replace image/metadata.');
      return;
    }
    artworkId = await client.mutation(api.artworks.update, {
      id: existing._id,
      ...artworkPayload,
      imageId: storageId,
    });
  } else {
    artworkId = await client.mutation(api.artworks.create, {
      ...artworkPayload,
      artistId,
      imageId: storageId,
    });
  }

  if (metadata.artistUpdate?.summary) {
    await client.mutation(api.artistUpdates.upsertDaily, {
      artistId,
      date: metadata.artistUpdate.date || date,
      runId: metadata.runId || `${date}-${title}`,
      summary: metadata.artistUpdate.summary,
      interests: metadata.artistUpdate.interests,
      inspiration: metadata.artistUpdate.inspiration,
      score: metadata.artistUpdate.score,
      pieceTitle,
      hypothesis: metadata.artistUpdate.hypothesis,
      experimentOutcome: metadata.artistUpdate.experimentOutcome || processText || metadata.description,
      arcName: metadata.artistUpdate.arcName,
      arcStep: metadata.artistUpdate.arcStep,
      noveltyDelta: metadata.artistUpdate.noveltyDelta,
      coherence: metadata.artistUpdate.coherence,
      risk: metadata.artistUpdate.risk,
      adoptedRefs: metadata.artistUpdate.adoptedRefs,
      resistedRef: metadata.artistUpdate.resistedRef,
      constraintBroken: metadata.artistUpdate.constraintBroken,
    });
  }

  console.log(JSON.stringify({
    ok: true,
    imported: {
      title,
      pieceTitle,
      artworkId,
      artistId,
      artifactDir: absDir,
      imagePath,
      overwrite,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
