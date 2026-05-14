#!/usr/bin/env node
/**
 * syncFromIamfranz2.mjs
 *
 * Scans IAMFRANZ2 archive folders and the `latest/` folder, uploads new
 * artwork images to Convex storage, and creates/updates artwork records in
 * the Convex `artworks` table so the public website updates automatically.
 *
 * Run from the `iamfranz/` directory:
 *   node scripts/syncFromIamfranz2.mjs
 *
 * Or with --dry-run to preview without writing anything:
 *   node scripts/syncFromIamfranz2.mjs --dry-run
 *
 * State is tracked in ../sync-state.json (IAMFRANZ2 root) so already-synced
 * archive folders are never re-uploaded. The `latest/` folder is always
 * re-synced (updated in place).
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// iamfranz/ directory (where this script lives under scripts/)
const IAMFRANZ_DIR = path.resolve(__dirname, '..');
// IAMFRANZ2 root (parent of iamfranz/)
const IAMFRANZ2_ROOT = path.resolve(IAMFRANZ_DIR, '..');
const SYNC_STATE_FILE = path.join(IAMFRANZ2_ROOT, 'sync-state.json');

dotenv.config({ path: path.join(IAMFRANZ_DIR, '.env.local') });

const dryRun = process.argv.includes('--dry-run');

const convexUrl = process.env.VITE_CONVEX_URL;
if (!convexUrl && !dryRun) {
  throw new Error('Missing VITE_CONVEX_URL in iamfranz/.env.local');
}
const client = dryRun ? null : new ConvexHttpClient(convexUrl);

// ── helpers ────────────────────────────────────────────────────────────────

async function readTextSafe(filePath) {
  try { return await fs.readFile(filePath, 'utf8'); } catch { return null; }
}

async function fileExists(filePath) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

/** Extract the bold title from a description.md (first **Title** line). */
function parsePieceTitle(text) {
  const match = text.match(/^\*\*(.+?)\*\*/m);
  return match ? match[1].trim() : null;
}

/** Return a clean first paragraph (no markdown) from description.md. */
function parseDescriptionSummary(text) {
  const withoutTitle = text.replace(/^\*\*(.+?)\*\*\n+/, '').trim();
  const firstPara = withoutTitle.split(/\n\n/)[0] ?? '';
  return firstPara
    .replace(/\*\*(.+?)\*\*/g, '$1')
    .replace(/\*(.+?)\*/g, '$1')
    .replace(/^#+\s+/gm, '')
    .trim();
}

/**
 * Parse a folder name like "2026-03-21-13-08" or "2026-03-21-13:30"
 * into a YYYY-MM-DD date string.
 */
function folderToDate(name) {
  const normalised = name.replace(/:/g, '-');
  const parts = normalised.split('-');
  if (parts.length >= 3) return `${parts[0]}-${parts[1]}-${parts[2]}`;
  return null;
}

/**
 * Parse a folder name like "2026-03-21-13-08" into epoch milliseconds
 * for use as a sortOrder value. Handles both ":" and "-" as hour/minute separators.
 */
function folderToEpoch(name) {
  const normalised = name.replace(/:/g, '-');
  const parts = normalised.split('-');
  if (parts.length < 3) return Date.now();
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1; // zero-based
  const day = parseInt(parts[2], 10);
  const hour = parts.length >= 4 ? parseInt(parts[3], 10) : 0;
  const minute = parts.length >= 5 ? parseInt(parts[4], 10) : 0;
  return new Date(year, month, day, hour, minute).getTime();
}

/**
 * Extract the last ## Iteration N section from a running evolution-log.md.
 * Returns the full text of that section, or null if not found.
 */
function parseLastEvolutionEntry(text) {
  const sections = text.split(/^## Iteration /m).filter(Boolean);
  if (!sections.length) return null;
  return ('## Iteration ' + sections[sections.length - 1]).trim();
}

/** Upload a PNG/JPG to Convex storage. Returns the storageId. */
async function uploadImage(filePath) {
  const bytes = await fs.readFile(filePath);
  const uploadUrl = await client.mutation(api.artworks.generateUploadUrl, {});
  const res = await fetch(uploadUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'image/png' },
    body: bytes,
  });
  if (!res.ok) {
    throw new Error(`Image upload failed: ${res.status} ${await res.text()}`);
  }
  const { storageId } = await res.json();
  return storageId;
}

/** Load sync state (maps folder name → Convex artwork _id). */
async function loadSyncState() {
  try {
    const raw = await fs.readFile(SYNC_STATE_FILE, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function saveSyncState(state) {
  await fs.writeFile(SYNC_STATE_FILE, JSON.stringify(state, null, 2) + '\n');
}

// ── scan IAMFRANZ2 folders ─────────────────────────────────────────────────

const allEntries = await fs.readdir(IAMFRANZ2_ROOT);
const archiveFolders = [];
for (const name of allEntries) {
  if (!name.match(/^\d{4}-\d{2}-\d{2}/)) continue;
  const full = path.join(IAMFRANZ2_ROOT, name);
  const stat = await fs.stat(full);
  if (!stat.isDirectory()) continue;
  const hasImage = await fileExists(path.join(full, 'artwork.png'));
  const hasDesc = await fileExists(path.join(full, 'description.md'));
  if (hasImage && hasDesc) archiveFolders.push(name);
}
archiveFolders.sort(); // chronological

// ── load sync state ────────────────────────────────────────────────────────

const syncState = await loadSyncState();
let syncStateChanged = false;

// ── process archive folders (sync once, skip if already synced) ────────────

for (const folder of archiveFolders) {
  if (syncState[folder]) {
    console.log(`⏭  ${folder} — already synced (${syncState[folder]})`);
    continue;
  }

  const dir = path.join(IAMFRANZ2_ROOT, folder);
  const descContent = await readTextSafe(path.join(dir, 'description.md')) ?? '';
  const notesContent = await readTextSafe(path.join(dir, 'artist-notes.md')) ?? '';
  const statementContent = await readTextSafe(path.join(dir, 'statement.md')) ?? '';
  const missionContent = await readTextSafe(path.join(dir, 'artist-mission.md')) ?? '';
  const inspirationContent = await readTextSafe(path.join(dir, 'inspiration-log.md')) ?? '';
  const evolutionLogContent = await readTextSafe(path.join(dir, 'evolution-log.md')) ?? '';

  const pieceTitle = parsePieceTitle(descContent) ?? folder;
  const date = folderToDate(folder) ?? new Date().toISOString().slice(0, 10);
  const year = parseInt(date.slice(0, 4), 10);
  const title = `${date} — ${pieceTitle}`;
  const description = parseDescriptionSummary(descContent);
  const artistThinking = notesContent.trim() || undefined;
  const statement = statementContent.trim() || undefined;
  const artistMission = missionContent.trim() || undefined;
  const inspirationEntry = inspirationContent.trim() || undefined;
  const evolutionEntry = parseLastEvolutionEntry(evolutionLogContent) || undefined;
  const sortOrder = folderToEpoch(folder);

  console.log(`⬆  ${folder} → "${title}"`);

  if (dryRun) {
    console.log(`   [dry-run] would upload image and create artwork`);
    continue;
  }

  const storageId = await uploadImage(path.join(dir, 'artwork.png'));
  const artworkId = await client.mutation(api.artworks.create, {
    title,
    pieceTitle,
    description,
    imageId: storageId,
    year,
    medium: 'AI-generated image (Google Gemini)',
    prompt: descContent,
    statement,
    sortOrder,
    artistThinking,
    artistMission,
    inspirationEntry,
    evolutionEntry,
    isAvailable: false,
    featured: false,
  });

  syncState[folder] = artworkId;
  await saveSyncState(syncState); // save after each upload so a crash doesn't cause re-uploads
  console.log(`   ✅ Created artwork ${artworkId}`);
}

// ── process latest/ (always update) ───────────────────────────────────────

const latestDir = path.join(IAMFRANZ2_ROOT, 'latest');
const latestHasImage = await fileExists(path.join(latestDir, 'artwork.png'));
const latestHasDesc = await fileExists(path.join(latestDir, 'description.md'));

if (latestHasImage && latestHasDesc) {
  const descContent = await readTextSafe(path.join(latestDir, 'description.md')) ?? '';
  const notesContent = await readTextSafe(path.join(latestDir, 'artist-notes.md')) ?? '';
  const statementContent = await readTextSafe(path.join(latestDir, 'statement.md')) ?? '';
  const missionContent = await readTextSafe(path.join(latestDir, 'artist-mission.md')) ?? '';
  const inspirationContent = await readTextSafe(path.join(latestDir, 'inspiration-log.md')) ?? '';
  const evolutionLogContent = await readTextSafe(path.join(latestDir, 'evolution-log.md')) ?? '';

  const pieceTitle = parsePieceTitle(descContent) ?? 'Untitled';
  const today = new Date().toISOString().slice(0, 10);
  const year = parseInt(today.slice(0, 4), 10);
  const title = `${today} — ${pieceTitle}`;
  const description = parseDescriptionSummary(descContent);
  const artistThinking = notesContent.trim() || undefined;
  const statement = statementContent.trim() || undefined;
  const artistMission = missionContent.trim() || undefined;
  const inspirationEntry = inspirationContent.trim() || undefined;
  const evolutionEntry = parseLastEvolutionEntry(evolutionLogContent) || undefined;

  const sortOrder = Date.now(); // latest always gets the newest sort order
  const existingLatestId = syncState['latest'];

  console.log(`🔄  latest/ → "${title}" (${existingLatestId ? 'update' : 'create'})`);

  if (!dryRun) {
    // Un-feature everything first
    const existing = await client.query(api.artworks.list, {});
    for (const artwork of existing) {
      if (artwork.featured) {
        await client.mutation(api.artworks.update, { id: artwork._id, featured: false });
      }
    }

    const storageId = await uploadImage(path.join(latestDir, 'artwork.png'));

    if (existingLatestId) {
      // Update the existing latest record
      await client.mutation(api.artworks.update, {
        id: existingLatestId,
        title,
        pieceTitle,
        description,
        imageId: storageId,
        year,
        prompt: descContent,
        statement,
        sortOrder,
        artistThinking,
        artistMission,
        inspirationEntry,
        evolutionEntry,
        featured: true,
      });
      console.log(`   ✅ Updated latest artwork ${existingLatestId}`);
    } else {
      // Create a new record for latest
      const artworkId = await client.mutation(api.artworks.create, {
        title,
        pieceTitle,
        description,
        imageId: storageId,
        year,
        medium: 'AI-generated image (Google Gemini)',
        prompt: descContent,
        statement,
        sortOrder,
        artistThinking,
        artistMission,
        inspirationEntry,
        evolutionEntry,
        isAvailable: false,
        featured: true,
      });
      syncState['latest'] = artworkId;
      syncStateChanged = true;
      console.log(`   ✅ Created latest artwork ${artworkId}`);
    }
  } else {
    console.log(`   [dry-run] would upload image and ${existingLatestId ? 'update' : 'create'} artwork`);
  }
} else {
  console.log('⚠  latest/ has no artwork.png or description.md — skipping');
}

// ── save sync state ────────────────────────────────────────────────────────

if (syncStateChanged && !dryRun) {
  await saveSyncState(syncState);
  console.log(`💾  Sync state saved → sync-state.json`);
}

console.log('\n✅ Sync complete.');
