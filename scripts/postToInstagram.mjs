#!/usr/bin/env node
/**
 * postToInstagram.mjs
 *
 * Posts the featured artwork to Instagram via the Buffer GraphQL API.
 * No MCP dependency — works in any environment including unattended launchd runs.
 *
 * Usage (from iamfranz/ directory):
 *   node scripts/postToInstagram.mjs
 *   node scripts/postToInstagram.mjs --dry-run
 *   node scripts/postToInstagram.mjs --statement ../latest/statement.md --imageUrl https://...
 *
 * By default:
 *   - Fetches the featured artwork's image URL from Convex
 *   - Uses ../latest/statement.md as the caption
 *   - Posts immediately (shareNow) to the iamfranz_art Instagram channel
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

function getArg(name) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] ?? null : null;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

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

async function getFeaturedArtwork() {
  const convexUrl = process.env.VITE_CONVEX_URL;
  if (!convexUrl) throw new Error('Missing VITE_CONVEX_URL in .env.local');
  const client = new ConvexHttpClient(convexUrl);
  const artworks = await client.query(api.artworks.list, {});
  const featured = artworks.find((a) => a.featured);
  if (!featured) throw new Error('No featured artwork found in Convex');
  return featured;
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
        image: { url: imageUrl, metadata: { altText } },
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

async function main() {
  const dryRun = hasFlag('--dry-run');

  // Resolve statement / caption
  const statementArg = getArg('--statement');
  const statementPath = statementArg
    ? path.resolve(statementArg)
    : path.join(IAMFRANZ2_ROOT, 'latest', 'statement.md');

  const text = (await fs.readFile(statementPath, 'utf8')).trim();
  if (!text) throw new Error(`Empty statement at ${statementPath}`);

  // Resolve image URL and alt text
  let imageUrl = getArg('--imageUrl');
  let altText = getArg('--altText');

  let caption = text;

  if (!imageUrl) {
    console.log('Fetching featured artwork from Convex...');
    const artwork = await getFeaturedArtwork();
    imageUrl = artwork.imageUrl ?? null;
    if (!altText) altText = artwork.pieceTitle ?? artwork.title ?? 'Artwork by IAMFRANZ';
    caption = buildCaption(artwork, text);
    console.log(`  Title:     ${artwork.title}`);
    console.log(`  Image URL: ${imageUrl}`);
  }

  if (!imageUrl) throw new Error('No image URL available (featured artwork has no imageUrl)');
  if (!altText) altText = 'Abstract artwork by IAMFRANZ';

  if (dryRun) {
    console.log('\n[dry-run] Would post to Instagram via Buffer:');
    console.log(`  Channel:   ${INSTAGRAM_CHANNEL_ID}`);
    console.log(`  Image URL: ${imageUrl}`);
    console.log(`  Alt text:  ${altText}`);
    console.log(`  Caption (${caption.length} chars):\n`);
    console.log(caption.slice(0, 400) + (caption.length > 400 ? '\n...' : ''));
    return;
  }

  console.log('Posting to Instagram via Buffer...');
  const post = await createBufferPost({ text: caption, imageUrl, altText });
  console.log(`✅ Posted! Buffer post ID: ${post.id}  status: ${post.status}`);
}

main().catch((err) => {
  console.error('❌', err.message ?? err);
  process.exit(1);
});
