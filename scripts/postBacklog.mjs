#!/usr/bin/env node
/**
 * postBacklog.mjs
 *
 * Posts all pending IAMFRANZ artworks to Instagram via Buffer (addToQueue mode).
 * Processes archive folders oldest-first, then the current latest/ artwork.
 * Stops gracefully if the Buffer queue is full — re-run once posts have published.
 *
 * Usage (from iamfranz/ directory):
 *   node scripts/postBacklog.mjs
 *   node scripts/postBacklog.mjs --dry-run
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

function formatArtworkDate(title) {
  const match = title?.match(/^(\d{4}-\d{2}-\d{2})/);
  if (!match) return null;
  const date = new Date(`${match[1]}T12:00:00Z`);
  if (isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).format(date);
}

function buildCaption(artwork, statementText) {
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
      mode: 'addToQueue',
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
  if (payload.message) {
    const err = new Error(`Buffer returned error: ${payload.message}`);
    err.isQueueFull = /limit|queue/i.test(payload.message);
    throw err;
  }

  return payload.post;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  if (dryRun) console.log('[dry-run mode — no posts will be sent]\n');

  // Load sync-state.json
  const syncStatePath = path.join(IAMFRANZ2_ROOT, 'sync-state.json');
  const syncState = JSON.parse(await fs.readFile(syncStatePath, 'utf8'));

  // Fetch all artworks from Convex once
  const convexUrl = process.env.VITE_CONVEX_URL;
  if (!convexUrl) throw new Error('Missing VITE_CONVEX_URL in .env.local');
  const client = new ConvexHttpClient(convexUrl);
  console.log('Fetching artworks from Convex...');
  const allArtworks = await client.query(api.artworks.list, {});
  const artworkById = new Map(allArtworks.map((a) => [a._id, a]));
  console.log(`  ${allArtworks.length} artworks loaded.\n`);

  // Build list of pending work items: { folderName, folderPath, isLatest }
  const pendingItems = [];

  // Archive folders (timestamp-named, sorted oldest-first)
  const entries = await fs.readdir(IAMFRANZ2_ROOT, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'latest') continue;
    if (!/^\d{4}-\d{2}-\d{2}/.test(entry.name)) continue;
    const pendingPath = path.join(IAMFRANZ2_ROOT, entry.name, 'INSTAGRAM_POST_PENDING.md');
    try {
      await fs.access(pendingPath);
      pendingItems.push({ folderName: entry.name, folderPath: path.join(IAMFRANZ2_ROOT, entry.name), isLatest: false });
    } catch { /* no pending file */ }
  }
  pendingItems.sort((a, b) => a.folderName.localeCompare(b.folderName));

  // latest/ — always last
  const latestPendingPath = path.join(IAMFRANZ2_ROOT, 'latest', 'INSTAGRAM_POST_PENDING.md');
  try {
    await fs.access(latestPendingPath);
    pendingItems.push({ folderName: 'latest', folderPath: path.join(IAMFRANZ2_ROOT, 'latest'), isLatest: true });
  } catch { /* no pending file */ }

  if (pendingItems.length === 0) {
    console.log('No pending posts found. All caught up!');
    return;
  }

  console.log(`${pendingItems.length} pending posts to queue:\n`);

  let posted = 0;
  let skipped = 0;

  for (const item of pendingItems) {
    const convexId = syncState[item.folderName];
    if (!convexId) {
      console.warn(`  ⚠️  No Convex ID for "${item.folderName}" in sync-state.json — skipping`);
      skipped++;
      continue;
    }

    const artwork = artworkById.get(convexId);
    if (!artwork) {
      console.warn(`  ⚠️  Artwork ${convexId} not found in Convex — skipping "${item.folderName}"`);
      skipped++;
      continue;
    }

    if (!artwork.imageUrl) {
      console.warn(`  ⚠️  No imageUrl for "${artwork.title}" — skipping`);
      skipped++;
      continue;
    }

    const statementPath = path.join(item.folderPath, 'statement.md');
    let statementText;
    try {
      statementText = (await fs.readFile(statementPath, 'utf8')).trim();
    } catch {
      console.warn(`  ⚠️  No statement.md in "${item.folderName}" — skipping`);
      skipped++;
      continue;
    }

    const caption = buildCaption(artwork, statementText);
    const altText = artwork.pieceTitle ?? artwork.title ?? 'Artwork by IAMFRANZ';

    console.log(`→ ${artwork.title}`);
    if (dryRun) {
      console.log(`  Caption preview: ${caption.slice(0, 80).replace(/\n/g, ' ')}…`);
      console.log(`  Image: ${artwork.imageUrl}`);
      console.log();
      posted++;
      continue;
    }

    try {
      const post = await createBufferPost({ text: caption, imageUrl: artwork.imageUrl, altText });
      console.log(`  ✅ Queued  (Buffer ID: ${post.id})`);
      await fs.unlink(path.join(item.folderPath, 'INSTAGRAM_POST_PENDING.md'));
      posted++;
    } catch (err) {
      if (err.isQueueFull) {
        const remaining = pendingItems.length - posted - skipped;
        console.log(`\n⏸  Buffer queue full — stopping after ${posted} queued.`);
        console.log(`   ${remaining} posts still pending. Re-run once queued posts have published.`);
        return;
      }
      throw err;
    }
  }

  const summary = dryRun ? `Would queue ${posted}` : `Queued ${posted}`;
  console.log(`\n✅ Done. ${summary}${skipped ? `, skipped ${skipped}` : ''}.`);
}

main().catch((err) => {
  console.error('❌', err.message ?? err);
  process.exit(1);
});
