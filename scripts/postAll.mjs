#!/usr/bin/env node
/**
 * postAll.mjs
 *
 * Posts every artwork in the backlog to Instagram via Buffer (shareNow mode).
 * Handles three categories:
 *   1. No. 18-27: archive folders whose PENDING files were already cleaned up
 *   2. No. 28-55: archive folders still carrying INSTAGRAM_POST_PENDING.md
 *   3. latest/ (Cosmic Web): posted last, no PENDING file needed
 *
 * Run from iamfranz/ directory:
 *   node scripts/postAll.mjs
 *   node scripts/postAll.mjs --dry-run
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';
import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const IAMFRANZ_DIR = path.resolve(__dirname, '..');
const IAMFRANZ2_ROOT = path.resolve(IAMFRANZ_DIR, '..');

dotenv.config({ path: path.join(IAMFRANZ_DIR, '.env.local') });

const BUFFER_API_URL = 'https://api.buffer.com/graphql';
const INSTAGRAM_CHANNEL_ID = '69e0f5b0031bfa423c0e26ba';

// Archive folders for No. 18-27 — PENDING files already removed by previous backlog run
const QUEUED_FOLDERS = [
  '2026-04-19-10:25',
  '2026-04-19-16:23',
  '2026-04-20-10:23',
  '2026-04-20-16:23',
  '2026-04-21-10:30',
  '2026-04-21-16:35',
  '2026-04-22-10:24',
  '2026-04-22-16:36',
  '2026-04-23-10:30',
  '2026-04-23-16:25',
];

function formatArtworkDate(title) {
  const match = title?.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  const date = new Date(`${match[1]}T12:00:00Z`);
  if (isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
}

function stripLegacyHeader(text) {
  // Old statement files start with "# Afterglow No. XX — Title\n\n"
  // Strip it so buildCaption can add the properly-formatted header
  return text.replace(/^#[^\n]+\n+/, '').trim();
}

function buildCaption(artwork, rawStatement) {
  const statementText = stripLegacyHeader(rawStatement);
  const pieceTitle = artwork.pieceTitle ?? null;
  if (!pieceTitle) return statementText;
  const dateStr = formatArtworkDate(artwork.title);
  const header = dateStr ? `${pieceTitle}\n${dateStr}` : pieceTitle;
  return `${header}\n\n${statementText}`;
}

async function createBufferPost({ text, imageUrl, altText }) {
  const apiKey = process.env.BUFFER_API_KEY;
  if (!apiKey) throw new Error('Missing BUFFER_API_KEY in .env.local');

  const mutation = `
    mutation CreatePost($input: CreatePostInput!) {
      createPost(input: $input) {
        ... on PostActionSuccess {
          post { id status }
        }
        ... on NotFoundError     { message }
        ... on UnauthorizedError  { message }
        ... on UnexpectedError    { message }
        ... on RestProxyError     { message code }
        ... on LimitReachedError  { message }
        ... on InvalidInputError  { message }
      }
    }
  `;

  const variables = {
    input: {
      channelId: INSTAGRAM_CHANNEL_ID,
      schedulingType: 'automatic',
      mode: 'shareNow',
      text,
      assets: {
        images: [{ url: imageUrl, metadata: { altText } }],
      },
      metadata: {
        instagram: { type: 'post', shouldShareToFeed: true },
      },
    },
  };

  const res = await fetch(BUFFER_API_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: mutation, variables }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Buffer API HTTP error (${res.status}): ${body.slice(0, 500)}`);
  }

  const data = await res.json();
  if (data.errors?.length) {
    throw new Error(`Buffer GraphQL errors: ${data.errors.map((e) => e.message).join('; ')}`);
  }

  const payload = data.data?.createPost;
  if (!payload) throw new Error('No createPost payload in response');
  if (payload.message) throw new Error(`Buffer returned error: ${payload.message}`);

  return payload.post;
}

async function fileExists(p) {
  try { await fs.access(p); return true; } catch { return false; }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.log('[dry-run mode — no posts will be sent]\n');

  // Load sync-state.json
  const syncState = JSON.parse(
    await fs.readFile(path.join(IAMFRANZ2_ROOT, 'sync-state.json'), 'utf8')
  );

  // Fetch all artworks from Convex
  const convexUrl = process.env.VITE_CONVEX_URL;
  if (!convexUrl) throw new Error('Missing VITE_CONVEX_URL in .env.local');
  const client = new ConvexHttpClient(convexUrl);
  console.log('Fetching artworks from Convex...');
  const allArtworks = await client.query(api.artworks.list, {});
  const artworkById = new Map(allArtworks.map((a) => [a._id, a]));
  console.log(`  ${allArtworks.length} artworks loaded.\n`);

  // Build ordered list of items to post
  // Step 1: the 10 No. 18-27 folders (no PENDING files)
  const archiveFolders = [...QUEUED_FOLDERS];

  // Step 2: archive folders that have PENDING files
  const entries = await fs.readdir(IAMFRANZ2_ROOT, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'latest') continue;
    if (!/^\d{4}-\d{2}-\d{2}/.test(entry.name)) continue;
    if (archiveFolders.includes(entry.name)) continue; // already in list
    const hasPending = await fileExists(path.join(IAMFRANZ2_ROOT, entry.name, 'INSTAGRAM_POST_PENDING.md'));
    if (hasPending) archiveFolders.push(entry.name);
  }

  archiveFolders.sort(); // chronological by folder name

  // Build work items
  const items = [];
  for (const folderName of archiveFolders) {
    const convexId = syncState[folderName];
    if (!convexId) { console.warn(`  ⚠️  No Convex ID for "${folderName}" — skipping`); continue; }
    const artwork = artworkById.get(convexId);
    if (!artwork) { console.warn(`  ⚠️  Artwork ${convexId} not in Convex — skipping "${folderName}"`); continue; }
    if (!artwork.imageUrl) { console.warn(`  ⚠️  No imageUrl for "${artwork.title}" — skipping`); continue; }
    const statementPath = path.join(IAMFRANZ2_ROOT, folderName, 'statement.md');
    if (!await fileExists(statementPath)) { console.warn(`  ⚠️  No statement.md in "${folderName}" — skipping`); continue; }
    const hasPending = await fileExists(path.join(IAMFRANZ2_ROOT, folderName, 'INSTAGRAM_POST_PENDING.md'));
    items.push({ folderName, folderPath: path.join(IAMFRANZ2_ROOT, folderName), artwork, statementPath, hasPending });
  }

  // Step 3: latest/ (Cosmic Web) — always last
  const latestConvexId = syncState['latest'];
  const latestArtwork = latestConvexId ? artworkById.get(latestConvexId) : null;
  if (latestArtwork?.imageUrl) {
    items.push({
      folderName: 'latest',
      folderPath: path.join(IAMFRANZ2_ROOT, 'latest'),
      artwork: latestArtwork,
      statementPath: path.join(IAMFRANZ2_ROOT, 'latest', 'statement.md'),
      hasPending: await fileExists(path.join(IAMFRANZ2_ROOT, 'latest', 'INSTAGRAM_POST_PENDING.md')),
    });
  }

  console.log(`Posting ${items.length} artworks to Instagram (oldest first):\n`);

  let posted = 0;
  for (const item of items) {
    const rawStatement = (await fs.readFile(item.statementPath, 'utf8')).trim();
    const caption = buildCaption(item.artwork, rawStatement);
    const altText = item.artwork.pieceTitle ?? item.artwork.title ?? 'Artwork by IAMFRANZ';

    console.log(`→ ${item.artwork.title}`);

    if (dryRun) {
      console.log(`  Caption: ${caption.slice(0, 80).replace(/\n/g, ' ')}…`);
      posted++;
      continue;
    }

    const post = await createBufferPost({ text: caption, imageUrl: item.artwork.imageUrl, altText });
    console.log(`  ✅ Posted (Buffer ID: ${post.id})`);

    if (item.hasPending) {
      await fs.unlink(path.join(item.folderPath, 'INSTAGRAM_POST_PENDING.md'));
    }
    posted++;
  }

  console.log(`\n${dryRun ? 'Would post' : 'Posted'} ${posted} artworks to Instagram.`);
}

main().catch((err) => {
  console.error('❌', err.message ?? err);
  process.exit(1);
});
