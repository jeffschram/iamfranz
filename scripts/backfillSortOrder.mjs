#!/usr/bin/env node
/**
 * backfillSortOrder.mjs
 *
 * One-time script to set the `sortOrder` field on all existing artwork records
 * based on the folder timestamps in sync-state.json.
 *
 * Run from the `iamfranz/` directory:
 *   node scripts/backfillSortOrder.mjs
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
const SYNC_STATE_FILE = path.join(IAMFRANZ2_ROOT, 'sync-state.json');

dotenv.config({ path: path.join(IAMFRANZ_DIR, '.env.local') });

const convexUrl = process.env.VITE_CONVEX_URL;
if (!convexUrl) throw new Error('Missing VITE_CONVEX_URL in iamfranz/.env.local');
const client = new ConvexHttpClient(convexUrl);

function folderToEpoch(name) {
  const normalised = name.replace(/:/g, '-');
  const parts = normalised.split('-');
  if (parts.length < 3) return Date.now();
  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10) - 1;
  const day = parseInt(parts[2], 10);
  const hour = parts.length >= 4 ? parseInt(parts[3], 10) : 0;
  const minute = parts.length >= 5 ? parseInt(parts[4], 10) : 0;
  return new Date(year, month, day, hour, minute).getTime();
}

const syncState = JSON.parse(await fs.readFile(SYNC_STATE_FILE, 'utf8'));

for (const [folder, artworkId] of Object.entries(syncState)) {
  let sortOrder;
  if (folder === 'latest') {
    // Give latest the highest sortOrder (now)
    sortOrder = Date.now();
  } else {
    sortOrder = folderToEpoch(folder);
  }

  console.log(`📌 ${folder} (${artworkId}) → sortOrder: ${sortOrder} (${new Date(sortOrder).toISOString()})`);

  await client.mutation(api.artworks.update, {
    id: artworkId,
    sortOrder,
  });

  console.log(`   ✅ Updated`);
}

console.log('\n✅ Backfill complete.');
