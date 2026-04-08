#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve('.env.local') });

const artifactDir = getArg('--artifactDir') || getArg('--dir');
const overwrite = hasFlag('--overwrite');

if (!artifactDir) {
  console.error('Usage: node scripts/generateIamfranzSocialBundle.mjs --artifactDir <path> [--overwrite]');
  process.exit(1);
}

function getArg(name) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return '';
  }
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function dedupe(list) {
  return [...new Set(list.filter(Boolean))];
}

function normalizeTag(tag) {
  return String(tag || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((part, idx) => (idx === 0 ? part : part.charAt(0).toUpperCase() + part.slice(1)))
    .join('');
}

function buildFallbackHashtags(metadata) {
  const base = ['iamfranz', 'digitalart', 'aiart', 'contemporaryart'];
  const fromTags = (metadata.tags || []).map(normalizeTag);
  const fromSeries = metadata.series ? [normalizeTag(metadata.series)] : [];
  return dedupe([...base, ...fromTags, ...fromSeries]).slice(0, 12).map((tag) => `#${tag}`);
}

function firstSentence(text) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  if (!cleaned) return '';
  const match = cleaned.match(/^.*?[.!?](?:\s|$)/);
  return (match ? match[0] : cleaned).trim();
}

function buildFallbackCaption(metadata, processNote, promptDoc) {
  const selectionMatch = processNote.match(/## Why this piece was selected\n([\s\S]*?)(\n## |$)/);
  const testingMatch = processNote.match(/## What it is testing\n([\s\S]*?)(\n## |$)/);
  const exactPrompt = promptDoc.match(/## Exact prompt\n([\s\S]*?)(\n## |$)/)?.[1]?.trim() || '';
  const promptBits = [];
  if (/lamp/i.test(exactPrompt)) promptBits.push('lamp still on');
  if (/mirror/i.test(exactPrompt)) promptBits.push('mirror catching almost nothing');
  if (/chair/i.test(exactPrompt)) promptBits.push('chair pulled slightly off');
  if (/bed/i.test(exactPrompt)) promptBits.push('bed just barely disturbed');

  const opener = metadata.pieceTitle ? `${metadata.pieceTitle}.` : 'New study.';
  const line2 = firstSentence(selectionMatch?.[1]) || firstSentence(metadata.description || '');
  const line3 = promptBits.length ? `Kept it tight: ${promptBits.slice(0, 3).join(', ')}.` : (firstSentence(testingMatch?.[1]) || 'Trying to let the room carry the tension without overexplaining it.');
  return [opener, line2, line3].filter(Boolean).join('\n');
}

function buildFallbackAltText(metadata, promptDoc) {
  const exactPrompt = promptDoc.match(/## Exact prompt\n([\s\S]*?)(\n## |$)/)?.[1]?.trim();
  const description = String(metadata.description || '').trim();
  return (exactPrompt || description || `${metadata.pieceTitle || 'Artwork'} digital image`).slice(0, 900);
}

function buildFallbackPosting(metadata, hashtags) {
  return {
    platform: 'instagram',
    status: 'draft',
    aspectRatio: '1:1',
    audience: 'public',
    contentType: 'feed-post',
    publishWindow: 'flexible',
    captionLength: 'short',
    callToAction: 'none',
    hashtags,
    mentions: [],
    location: null,
    firstCommentHashtags: hashtags.length > 8 ? hashtags.slice(8) : [],
    accessibility: {
      altTextRequired: true,
      imageContainsText: false,
    },
  };
}

async function generateWithOpenAI(payload, fallback) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ...fallback, mode: 'fallback-no-key' };

  const system = [
    'You create Instagram-ready social copy for an experimental digital art project called IAMFRANZ.',
    'Return strict JSON with keys: caption, hashtags, altText, postingMetadata.',
    'Write like a sharp human artist posting their own work, not a curator statement and not marketing copy.',
    'caption: 2 or 3 short paragraphs max, usually 55-110 words total.',
    'Use plain, specific language. Cool, tight, observant. A little edge is fine. No emoji. No hashtags inside caption paragraphs.',
    'Avoid art-school fog and AI habits: no invites viewers to, explores the idea of, embodies, reflects on, interplay, psychological tension, nuanced, haunting, evocative, underscores, not just... but....',
    'Do not explain the work to death. Name 2-4 concrete details from the image or process and then stop.',
    'hashtags: array of 6-10 Instagram hashtags including project-specific and artwork-relevant tags.',
    'altText: 1-2 straightforward sentences describing what is visibly in the image for accessibility. No poetry.',
    'postingMetadata: object with keys platform, status, aspectRatio, audience, contentType, publishWindow, captionLength, callToAction, mentions, location, firstCommentHashtags, accessibility.',
    'Keep everything aligned to the artwork; do not invent exhibitions, sales status, collaborators, or audience reaction.',
  ].join(' ');

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.IAMFRANZ_SOCIAL_MODEL || process.env.IAMFRANZ_WRITER_MODEL || 'gpt-4o-mini',
        temperature: 0.55,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify(payload) },
        ],
      }),
    });

    if (!res.ok) return { ...fallback, mode: 'fallback-api-error' };
    const data = await res.json();
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content || '{}');
    const hashtags = dedupe((parsed.hashtags || []).map((tag) => String(tag).startsWith('#') ? String(tag) : `#${String(tag).replace(/^#+/, '')}`)).slice(0, 12);
    const mergedPosting = { ...fallback.postingMetadata, ...(parsed.postingMetadata || {}) };
    return {
      caption: String(parsed.caption || fallback.caption).trim(),
      hashtags: hashtags.length ? hashtags : fallback.hashtags,
      altText: String(parsed.altText || fallback.altText).trim(),
      postingMetadata: {
        ...mergedPosting,
        platform: 'instagram',
        status: 'draft',
        aspectRatio: '1:1',
        audience: 'public',
        contentType: 'feed-post',
        publishWindow: typeof mergedPosting.publishWindow === 'string' ? mergedPosting.publishWindow : 'flexible',
        captionLength: ['short', 'medium', 'long'].includes(String(mergedPosting.captionLength)) ? mergedPosting.captionLength : 'medium',
        callToAction: typeof mergedPosting.callToAction === 'string' ? mergedPosting.callToAction : 'none',
        mentions: Array.isArray(mergedPosting.mentions) ? mergedPosting.mentions : [],
        location: mergedPosting.location ?? null,
        firstCommentHashtags: Array.isArray(mergedPosting.firstCommentHashtags)
          ? mergedPosting.firstCommentHashtags.map((tag) => String(tag).startsWith('#') ? String(tag) : `#${String(tag).replace(/^#+/, '')}`)
          : [],
        accessibility: {
          altTextRequired: true,
          imageContainsText: false,
          ...(typeof mergedPosting.accessibility === 'object' && mergedPosting.accessibility ? mergedPosting.accessibility : {}),
        },
      },
      mode: 'openai',
    };
  } catch {
    return { ...fallback, mode: 'fallback-exception' };
  }
}

async function main() {
  const absDir = path.resolve(artifactDir);
  const metadataPath = path.join(absDir, 'metadata.json');
  const socialPath = path.join(absDir, 'social.json');
  const captionPath = path.join(absDir, 'caption.md');

  if (!overwrite && await fileExists(socialPath)) {
    console.log(JSON.stringify({ ok: true, skipped: true, reason: 'social-exists', socialPath }, null, 2));
    return;
  }

  const metadata = await readJson(metadataPath);
  const promptDoc = await readTextIfExists(path.join(absDir, metadata.promptFile || 'prompt.md'));
  const processNote = await readTextIfExists(path.join(absDir, metadata.processNoteFile || 'process.md'));

  const fallbackHashtags = buildFallbackHashtags(metadata);
  const fallback = {
    caption: buildFallbackCaption(metadata, processNote, promptDoc),
    hashtags: fallbackHashtags,
    altText: buildFallbackAltText(metadata, promptDoc),
    postingMetadata: buildFallbackPosting(metadata, fallbackHashtags),
  };

  const generated = await generateWithOpenAI({
    metadata,
    promptDoc,
    processNote,
    existingSocial: metadata.social || null,
  }, fallback);

  const social = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: generated.mode,
    caption: generated.caption,
    hashtags: generated.hashtags,
    altText: generated.altText,
    postingMetadata: {
      ...generated.postingMetadata,
      hashtags: generated.hashtags,
    },
  };

  await fs.writeFile(socialPath, JSON.stringify(social, null, 2) + '\n', 'utf8');
  await fs.writeFile(
    captionPath,
    `# Instagram Caption — ${metadata.pieceTitle || metadata.title || 'Untitled'}\n\n${social.caption}\n\n${social.hashtags.join(' ')}\n\n## Alt Text\n${social.altText}\n`,
    'utf8',
  );

  metadata.social = {
    socialFile: 'social.json',
    captionFile: 'caption.md',
    updatedAt: social.generatedAt,
    mode: social.mode,
  };
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2) + '\n', 'utf8');

  console.log(JSON.stringify({ ok: true, artifactDir: absDir, socialPath, captionPath, mode: social.mode }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
