#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const publishRoot = getArg('--publishRoot') || '/Users/skippy/.openclaw/agents/IAMFRANZ/iamfranz-agent/publish';
const bundleDir = getArg('--bundleDir');
const date = getArg('--date');
const outFile = getArg('--outFile') || path.resolve('src/data/iamfranz-run-record.json');
const outLibraryFile = getArg('--outLibraryFile') || path.resolve('src/data/iamfranz-run-records.json');
const publicRunsDir = getArg('--publicRunsDir') || path.resolve('public/iamfranz/runs');
const iamfranzAgentRoot = '/Users/skippy/.openclaw/agents/IAMFRANZ';
const iamfranzWorkspaceRoot = '/Users/skippy/.openclaw/agents/IAMFRANZ/iamfranz-agent';
const appRoot = '/Users/skippy/src/iamfranz';

function getArg(name) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

async function listCandidateDirs(root, datePrefix) {
  const entries = await fs.readdir(root, { withFileTypes: true });
  const dirs = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (datePrefix && !entry.name.startsWith(datePrefix)) continue;

    const abs = path.join(root, entry.name);
    const runPath = path.join(abs, 'run.json');
    if (!(await exists(runPath))) continue;

    const stat = await fs.stat(runPath);
    dirs.push({ name: entry.name, dir: abs, runPath, mtimeMs: stat.mtimeMs });
  }

  return dirs.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function isTextFile(filePath) {
  return /\.(md|txt|json|js|mjs|ts|tsx|css|html|yml|yaml)$/i.test(filePath) || !path.extname(filePath);
}

function resolveTouchedFilePath(filePath, runRecord) {
  if (!filePath) return null;
  if (filePath.startsWith('publish/')) {
    const bundleSlug = runRecord.bundleSlug;
    const sourceDir = runRecord?.source?.artifactDir;
    if (!bundleSlug || !sourceDir) return null;
    const prefix = `publish/${bundleSlug}/`;
    if (!filePath.startsWith(prefix)) return null;
    return path.join(sourceDir, filePath.slice(prefix.length));
  }
  if (filePath.startsWith('iamfranz-agent/')) {
    return path.join(iamfranzAgentRoot, filePath);
  }
  if (['AGENTS.md', 'SOUL.md', 'USER.md', 'README.md'].includes(filePath)) {
    return path.join(iamfranzAgentRoot, filePath);
  }
  if (filePath.startsWith('scripts/')) {
    return path.join(appRoot, filePath);
  }
  return null;
}

async function enrichRunRecord(runRecord) {
  const steps = await Promise.all(
    (runRecord.steps || []).map(async (step) => {
      const files = await Promise.all(
        (step.files || []).map(async (file) => {
          const absolutePath = resolveTouchedFilePath(file.path, runRecord);
          const canInlineText = absolutePath && isTextFile(file.path);
          const textContent = canInlineText ? await readTextIfExists(absolutePath) : null;
          return {
            ...file,
            absolutePath,
            inlineContent: textContent,
            inlineContentType: textContent ? 'text' : null,
          };
        }),
      );
      return { ...step, files };
    }),
  );

  return { ...runRecord, steps };
}

async function copyImageForBundle(bundleName, runRecord) {
  const sourceImagePath = runRecord?.source?.artifactDir && runRecord?.source?.imageFile
    ? path.resolve(runRecord.source.artifactDir, path.basename(runRecord.source.imageFile))
    : null;

  if (!sourceImagePath || !(await exists(sourceImagePath))) {
    return { imageUrl: null, copiedImagePath: null };
  }

  const imageName = path.basename(sourceImagePath);
  const targetDir = path.join(publicRunsDir, bundleName);
  const targetPath = path.join(targetDir, imageName);
  await fs.mkdir(targetDir, { recursive: true });
  await fs.copyFile(sourceImagePath, targetPath);

  return {
    imageUrl: `/iamfranz/runs/${bundleName}/${imageName}`,
    copiedImagePath: targetPath,
  };
}

async function buildRunLibrary(candidates) {
  const runs = [];
  for (const candidate of candidates) {
    const rawRunRecord = await readJson(candidate.runPath);
    const enrichedRunRecord = await enrichRunRecord(rawRunRecord);
    const { imageUrl, copiedImagePath } = await copyImageForBundle(candidate.name, enrichedRunRecord);
    runs.push({
      ...enrichedRunRecord,
      imageUrl,
      copiedImagePath,
    });
  }
  return runs;
}

async function resolveCandidates() {
  if (bundleDir) {
    const absBundle = path.resolve(bundleDir);
    const runPath = path.join(absBundle, 'run.json');
    if (!(await exists(runPath))) {
      throw new Error(`No run.json found in bundle: ${absBundle}`);
    }
    const stat = await fs.stat(runPath);
    return [{ name: path.basename(absBundle), dir: absBundle, runPath, mtimeMs: stat.mtimeMs }];
  }

  const candidates = await listCandidateDirs(path.resolve(publishRoot), date);
  if (!candidates.length) {
    throw new Error(`No publish bundle with run.json found in ${publishRoot}${date ? ` for ${date}` : ''}`);
  }

  return candidates;
}

async function main() {
  const candidates = await resolveCandidates();
  const latest = candidates[0];
  const runLibrary = await buildRunLibrary(candidates);
  const latestRunRecord = runLibrary[0];

  const latestPath = path.resolve(outFile);
  const libraryPath = path.resolve(outLibraryFile);

  await fs.mkdir(path.dirname(latestPath), { recursive: true });
  await fs.mkdir(path.dirname(libraryPath), { recursive: true });
  await fs.writeFile(latestPath, JSON.stringify(latestRunRecord, null, 2) + '\n', 'utf8');
  await fs.writeFile(libraryPath, JSON.stringify({ schemaVersion: 1, syncedAt: new Date().toISOString(), runs: runLibrary }, null, 2) + '\n', 'utf8');

  console.log(JSON.stringify({
    ok: true,
    source: {
      bundleName: latest.name,
      bundleDir: latest.dir,
      runPath: latest.runPath,
      totalRuns: runLibrary.length,
    },
    latestTargetPath: latestPath,
    libraryTargetPath: libraryPath,
    publicRunsDir: path.resolve(publicRunsDir),
    runId: latestRunRecord.runId,
    pieceTitle: latestRunRecord.pieceTitle || null,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
