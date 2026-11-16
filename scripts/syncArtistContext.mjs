#!/usr/bin/env node
/**
 * syncArtistContext.mjs
 *
 * Publishes a digest of latest/aesthetic-principles.md to Convex so the
 * "Chat with the Artist" feature can speak from it. The full file is over
 * 1MB — far too large to hand to the chat model on every message (and over
 * Convex's per-document limit) — so this sends:
 *
 *   1. the opening of "What I find compelling"  (the founding convictions)
 *   2. all of "What I find cheap or obvious"
 *   3. the newest entries at the end of the file (what was learned lately)
 *
 * Called at the end of syncFromIamfranz2.mjs. Can also be run on its own
 * from the iamfranz/ directory:
 *   node scripts/syncArtistContext.mjs [--dry-run]
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const FOUNDATION_CHARS = 3500;
const RECENT_CHARS = 8000;

/** Split a markdown document into its `## ` sections (heading included). */
function splitSections(text) {
  return text.split(/^(?=## )/m);
}

/** Keep whole bullets/paragraphs from the start of `text`, up to `max` chars. */
function headByBlock(text, max) {
  if (text.length <= max) return text.trim();
  const cut = text.lastIndexOf('\n- ', max);
  return text.slice(0, cut > 0 ? cut : max).trim();
}

/** Keep whole bullets/sections from the end of `text`, up to `max` chars. */
function tailByBlock(text, max) {
  if (text.length <= max) return text.trim();
  const tail = text.slice(-max);
  const start = tail.search(/^(?:## |- )/m);
  return (start >= 0 ? tail.slice(start) : tail).trim();
}

export function distillPrinciples(text) {
  const normalized = text.replace(/\r\n/g, '\n');
  const sections = splitSections(normalized);
  const find = (heading) => sections.find((s) => s.startsWith(`## ${heading}`));

  const compelling = find('What I find compelling');
  const cheap = find('What I find cheap or obvious');

  const parts = [];
  if (compelling) {
    parts.push(`${headByBlock(compelling, FOUNDATION_CHARS)}\n\n(…many later additions omitted…)`);
  }
  if (cheap) parts.push(cheap.trim());
  parts.push(
    `## Most recent additions (the end of the document)\n\n${tailByBlock(normalized, RECENT_CHARS)}`,
  );
  return parts.join('\n\n');
}

export async function syncArtistContext({ client, latestDir, dryRun = false }) {
  let text;
  try {
    text = await fs.readFile(path.join(latestDir, 'aesthetic-principles.md'), 'utf8');
  } catch {
    console.log('⏭  aesthetic-principles.md not found — chat context not updated');
    return;
  }

  const digest = distillPrinciples(text);
  if (dryRun) {
    console.log(`   [dry-run] would publish aesthetic principles digest (${digest.length} chars)`);
    return;
  }

  // Imported here so a dry run needs no generated Convex code.
  const { api } = await import('../convex/_generated/api.js');
  await client.mutation(api.chat.setAestheticPrinciples, { value: digest });
  console.log(`🧭  Published aesthetic principles digest for chat (${digest.length} chars)`);
}

// ── standalone ─────────────────────────────────────────────────────────────

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { default: dotenv } = await import('dotenv');
  const { ConvexHttpClient } = await import('convex/browser');

  const iamfranzDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  dotenv.config({ path: path.join(iamfranzDir, '.env.local') });

  const dryRun = process.argv.includes('--dry-run');
  const printOnly = process.argv.includes('--print');
  const latestDir = path.resolve(iamfranzDir, '..', 'latest');

  if (printOnly) {
    const text = await fs.readFile(path.join(latestDir, 'aesthetic-principles.md'), 'utf8');
    console.log(distillPrinciples(text));
  } else {
    if (!process.env.VITE_CONVEX_URL && !dryRun) {
      throw new Error('Missing VITE_CONVEX_URL in iamfranz/.env.local');
    }
    const client = dryRun ? null : new ConvexHttpClient(process.env.VITE_CONVEX_URL);
    await syncArtistContext({ client, latestDir, dryRun });
  }
}
