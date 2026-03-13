#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawn } from 'node:child_process';

const publishRoot = getArg('--publishRoot') || '/Users/skippy/.openclaw/agents/IAMFRANZ/iamfranz-agent/publish';
const date = getArg('--date') || new Date().toISOString().slice(0, 10);
const overwrite = hasFlag('--overwrite');
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
    if (!entry.name.startsWith(datePrefix)) continue;
    const abs = path.join(root, entry.name);
    const metadataPath = path.join(abs, 'metadata.json');
    const imageCandidates = ['image.png', 'image.jpg', 'image.jpeg', 'image.webp'].map((name) => path.join(abs, name));
    const hasMetadata = await exists(metadataPath);
    let imagePath = null;
    for (const candidate of imageCandidates) {
      if (await exists(candidate)) {
        imagePath = candidate;
        break;
      }
    }
    if (hasMetadata && imagePath) {
      const stat = await fs.stat(abs);
      dirs.push({ dir: abs, name: entry.name, imagePath, mtimeMs: stat.mtimeMs });
    }
  }
  return dirs.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function runImport(dir, overwrite) {
  return new Promise((resolve, reject) => {
    const args = ['scripts/importIamfranzArtifact.mjs', '--artifactDir', dir];
    if (overwrite) args.push('--overwrite');
    const child = spawn('node', args, {
      cwd: '/Users/skippy/src/iamfranz',
      stdio: 'inherit',
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Importer exited with code ${code}`));
    });
    child.on('error', reject);
  });
}

async function main() {
  const root = path.resolve(publishRoot);
  const candidates = await listCandidateDirs(root, date);

  if (!candidates.length) {
    console.log(JSON.stringify({ ok: false, reason: 'no-ready-bundle-found', publishRoot: root, date }, null, 2));
    process.exit(1);
  }

  const latest = candidates[0];

  if (dryRun) {
    console.log(JSON.stringify({
      ok: true,
      dryRun: true,
      selected: latest,
      candidateCount: candidates.length,
    }, null, 2));
    return;
  }

  await runImport(latest.dir, overwrite);
  console.log(JSON.stringify({
    ok: true,
    importedLatest: latest.dir,
    date,
    overwrite,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
