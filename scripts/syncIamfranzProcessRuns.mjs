#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const runsRoot = path.resolve(getArg('--runsRoot') || 'runs');
const outFile = path.resolve(getArg('--outFile') || 'src/data/iamfranz-process-runs.json');
const publicRunsDir = path.resolve(getArg('--publicRunsDir') || 'public/iamfranz/process-runs');
const runDirArg = getArg('--runDir') || getArg('--dayDir');
const appRoot = path.resolve('.');
const iamfranzAgentRoot = path.resolve('/Users/skippy/.openclaw/agents/IAMFRANZ');
const iamfranzWorkspaceRoot = path.resolve('/Users/skippy/.openclaw/agents/IAMFRANZ/iamfranz-agent');

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

function isTextFile(filePath) {
  return /\.(md|txt|json|js|mjs|ts|tsx|css|html|yml|yaml|csv|ndjson)$/i.test(filePath) || !path.extname(filePath);
}

async function listCandidates() {
  if (runDirArg) {
    const abs = path.resolve(runDirArg);
    const runPath = path.join(abs, 'run.json');
    if (!(await exists(runPath))) throw new Error(`No run.json found in ${abs}`);
    const stat = await fs.stat(runPath);
    return [{ dir: abs, runPath, mtimeMs: stat.mtimeMs, name: path.basename(abs) }];
  }

  if (!(await exists(runsRoot))) return [];
  const entries = await fs.readdir(runsRoot, { withFileTypes: true });
  const candidates = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'research_tree') continue;
    const dir = path.join(runsRoot, entry.name);
    const runPath = path.join(dir, 'run.json');
    if (!(await exists(runPath))) continue;
    const stat = await fs.stat(runPath);
    candidates.push({ dir, runPath, mtimeMs: stat.mtimeMs, name: entry.name });
  }
  return candidates.sort((a, b) => b.mtimeMs - a.mtimeMs);
}

function resolveFilePath(runDir, relativePath, runRecord) {
  if (!relativePath) return null;
  if (path.isAbsolute(relativePath)) return relativePath;
  if (relativePath.startsWith('runs/research_tree/')) {
    return path.resolve(appRoot, relativePath);
  }
  if (relativePath === 'run.json') return path.join(runDir, 'run.json');
  if (['AGENTS.md', 'SOUL.md', 'USER.md', 'README.md'].includes(relativePath)) {
    return path.join(iamfranzAgentRoot, relativePath);
  }
  if (relativePath.startsWith('iamfranz-agent/')) {
    return path.join(iamfranzAgentRoot, relativePath);
  }
  if (relativePath.startsWith('publish/')) {
    return path.join(iamfranzWorkspaceRoot, relativePath);
  }
  if (relativePath.startsWith('scripts/')) {
    return path.join(appRoot, relativePath);
  }
  return path.join(runDir, relativePath);
}

async function copyPrimaryImage(runDir, runRecord) {
  const sourcePath = runRecord?.source?.primaryImagePath ? path.join(runDir, runRecord.source.primaryImagePath) : null;
  if (!sourcePath || !(await exists(sourcePath))) return { imageUrl: null };
  const targetDir = path.join(publicRunsDir, runRecord.runId);
  await fs.mkdir(targetDir, { recursive: true });
  const fileName = path.basename(sourcePath);
  const targetPath = path.join(targetDir, fileName);
  await fs.copyFile(sourcePath, targetPath);
  return { imageUrl: `/iamfranz/process-runs/${runRecord.runId}/${fileName}` };
}

async function enrichRun(runDir, runRecord) {
  const { imageUrl } = await copyPrimaryImage(runDir, runRecord);

  const steps = await Promise.all((runRecord.steps || []).map(async (step) => {
    const files = await Promise.all((step.files || []).map(async (file) => {
      const absolutePath = resolveFilePath(runDir, file.path, runRecord);
      const inlineContent = absolutePath && isTextFile(file.path) ? await readTextIfExists(absolutePath) : null;
      return {
        ...file,
        absolutePath,
        inlineContent,
        inlineContentType: inlineContent ? 'text' : null,
      };
    }));

    const artifacts = await Promise.all((step.artifacts || []).map(async (artifact) => {
      if (artifact.kind !== 'image') return artifact;
      const absolutePath = resolveFilePath(runDir, artifact.path, runRecord);
      if (!absolutePath || !(await exists(absolutePath))) return artifact;
      const artifactDir = path.join(publicRunsDir, runRecord.runId, path.dirname(artifact.path));
      await fs.mkdir(artifactDir, { recursive: true });
      const targetPath = path.join(publicRunsDir, runRecord.runId, artifact.path);
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.copyFile(absolutePath, targetPath);
      return {
        ...artifact,
        previewUrl: `/${path.relative(path.resolve('public'), targetPath).split(path.sep).join('/')}`,
      };
    }));

    return { ...step, files, artifacts };
  }));

  return { ...runRecord, imageUrl, steps };
}

async function main() {
  const candidates = await listCandidates();
  const runs = [];
  for (const candidate of candidates) {
    const raw = await readJson(candidate.runPath);
    runs.push(await enrichRun(candidate.dir, raw));
  }

  await fs.mkdir(path.dirname(outFile), { recursive: true });
  await fs.writeFile(outFile, JSON.stringify({ schemaVersion: 2, syncedAt: new Date().toISOString(), runs }, null, 2) + '\n', 'utf8');

  console.log(JSON.stringify({ ok: true, outFile, runs: runs.length, runsRoot, mode: runDirArg ? 'single' : 'library' }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
