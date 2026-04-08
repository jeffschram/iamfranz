#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const publishRoot = getArg('--publishRoot') || '/Users/skippy/.openclaw/agents/IAMFRANZ/iamfranz-agent/publish';
const date = getArg('--date');
const outDir = getArg('--outDir') || '/tmp/openclaw/uploads';
const outName = getArg('--outName');
const dryRun = hasFlag('--dry-run');

function getArg(name) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function listCandidateDirs(root, datePrefix) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const dirs = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (datePrefix && !entry.name.startsWith(datePrefix)) continue;
    const abs = path.join(root, entry.name);
    const metadataPath = path.join(abs, 'metadata.json');
    if (!(await exists(metadataPath))) continue;
    const stat = await fs.stat(abs);
    dirs.push({ dir: abs, name: entry.name, mtimeMs: stat.mtimeMs });
  }
  return dirs.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function findImagePath(bundleDir, metadata) {
  const candidates = [metadata.image, 'image.png', 'image.jpg', 'image.jpeg', 'image.webp']
    .filter(Boolean)
    .map((name) => path.resolve(bundleDir, name));
  for (const candidate of candidates) {
    if (await exists(candidate)) return candidate;
  }
  throw new Error(`No image found in ${bundleDir}`);
}

function defaultCaptionFromSocial(social) {
  if (!social) return '';
  return [social.caption, Array.isArray(social.hashtags) ? social.hashtags.join(' ') : '']
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

async function main() {
  const root = path.resolve(publishRoot);
  const candidates = await listCandidateDirs(root, date);
  if (!candidates.length) throw new Error(`No publish bundle found in ${root}${date ? ` for ${date}` : ''}`);

  const latest = candidates[0];
  const metadata = await readJson(path.join(latest.dir, 'metadata.json'));
  const socialPath = path.join(latest.dir, metadata.social?.socialFile || 'social.json');
  const social = await exists(socialPath) ? await readJson(socialPath) : null;
  const imagePath = await findImagePath(latest.dir, metadata);
  const ext = path.extname(imagePath) || '.png';
  const safeSlug = latest.name.replace(/[^a-zA-Z0-9._-]+/g, '-');
  const targetName = outName || `${safeSlug}-${crypto.createHash('sha1').update(imagePath).digest('hex').slice(0, 8)}${ext}`;
  const stagedPath = path.resolve(outDir, targetName);

  const result = {
    ok: true,
    bundle: {
      dir: latest.dir,
      name: latest.name,
      title: metadata.title,
      pieceTitle: metadata.pieceTitle || metadata.title,
      imagePath,
      socialPath: await exists(socialPath) ? socialPath : null,
    },
    stagedUpload: {
      outDir: path.resolve(outDir),
      path: stagedPath,
    },
    social: social ? {
      caption: social.caption || '',
      hashtags: Array.isArray(social.hashtags) ? social.hashtags : [],
      altText: social.altText || '',
      postingMetadata: social.postingMetadata || null,
      fullCaption: defaultCaptionFromSocial(social),
    } : null,
  };

  if (!dryRun) {
    await fs.mkdir(path.dirname(stagedPath), { recursive: true });
    await fs.copyFile(imagePath, stagedPath);
  }

  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
