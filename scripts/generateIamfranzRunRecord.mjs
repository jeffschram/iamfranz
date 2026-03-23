#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const artifactDir = getArg('--artifactDir') || getArg('--dir');
const overwrite = hasFlag('--overwrite');

if (!artifactDir) {
  console.error('Usage: node scripts/generateIamfranzRunRecord.mjs --artifactDir <path> [--overwrite]');
  process.exit(1);
}

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

function inferRunId(metadata, bundleName) {
  return metadata.runId || `${metadata.publishedAt || metadata.createdAt || bundleName}`;
}

function inferMode(metadata, processNote) {
  if (/selected export-ready study bundle/i.test(processNote)) return 'Curate';
  if (/public study/i.test(processNote)) return 'Curate';
  if (/critique/i.test(processNote)) return 'Critique';
  if (/revise/i.test(processNote)) return 'Revise';
  if (/evolve/i.test(processNote)) return 'Evolve';
  if (/generate|render/i.test(processNote)) return 'Generate';
  return 'Curate';
}

function guessStartedAt(metadata) {
  const raw = metadata.createdAt || metadata.publishedAt;
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T10:30:00-04:00`;
  return raw;
}

function guessCompletedAt(metadata) {
  const raw = metadata.social?.updatedAt || metadata.publishedAt || metadata.createdAt;
  if (!raw) return undefined;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw}T10:32:00-04:00`;
  return raw;
}

function buildFilesSection(bundleName, metadata) {
  const promptFile = `publish/${bundleName}/${metadata.promptFile || 'prompt.md'}`;
  const processFile = `publish/${bundleName}/${metadata.processNoteFile || 'process.md'}`;
  const imageFile = `publish/${bundleName}/${metadata.image || 'image.png'}`;
  const metadataFile = `publish/${bundleName}/metadata.json`;
  const socialFile = metadata.social?.socialFile ? `publish/${bundleName}/${metadata.social.socialFile}` : `publish/${bundleName}/social.json`;
  const captionFile = metadata.social?.captionFile ? `publish/${bundleName}/${metadata.social.captionFile}` : `publish/${bundleName}/caption.md`;
  const runFile = `publish/${bundleName}/run.json`;
  return { promptFile, processFile, imageFile, metadataFile, socialFile, captionFile, runFile };
}

function buildOverview(metadata, processNote) {
  const firstLine = String(metadata.description || '').trim();
  const processSummary = processNote.match(/## Why this piece was selected\n([\s\S]*?)(\n## |$)/)?.[1]?.trim();
  return processSummary || firstLine || 'IAMFRANZ completed a publish-bundle run for a selected artwork.';
}

function buildRunRecord({ bundleName, metadata, processNote, promptDoc, social }) {
  const files = buildFilesSection(bundleName, metadata);
  const mode = inferMode(metadata, processNote);
  const exactPrompt = promptDoc.match(/## Exact prompt\n([\s\S]*?)(\n## |$)/)?.[1]?.trim() || '';
  const workType = processNote.match(/## Work type\n([\s\S]*?)(\n## |$)/)?.[1]?.trim() || 'Selected publish bundle';
  const testing = processNote.match(/## What it is testing\n([\s\S]*?)(\n## |$)/)?.[1]?.trim() || '';
  const formalDecisionsRaw = processNote.match(/## Formal decisions\n([\s\S]*?)(\n## |$)/)?.[1] || '';
  const formalDecisions = formalDecisionsRaw
    .split('\n')
    .map((line) => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);

  return {
    schemaVersion: 1,
    runId: inferRunId(metadata, bundleName),
    agent: 'IAMFRANZ',
    bundleSlug: bundleName,
    pieceTitle: metadata.pieceTitle || metadata.title,
    title: metadata.title,
    startedAt: guessStartedAt(metadata),
    completedAt: guessCompletedAt(metadata),
    status: 'completed',
    mode,
    overview: buildOverview(metadata, processNote),
    source: {
      artifactDir: metadata.sourcePath || path.join('/Users/skippy/.openclaw/agents/IAMFRANZ/iamfranz-agent/publish', bundleName),
      metadataFile: files.metadataFile,
      promptFile: files.promptFile,
      processFile: files.processFile,
      socialFile: social ? files.socialFile : null,
      captionFile: social ? files.captionFile : null,
      imageFile: files.imageFile,
    },
    steps: [
      {
        id: 'session-start',
        title: 'Session Start',
        description: 'Boot sequence and required context load for the IAMFRANZ agent workspace.',
        status: 'completed',
        files: [
          { path: 'AGENTS.md', kind: 'read', note: 'workspace operating rules' },
          { path: 'SOUL.md', kind: 'read', note: 'voice and artistic stance' },
          { path: 'USER.md', kind: 'read', note: 'human collaborator context' },
        ],
        summary: 'Loaded the core operating context before touching any artwork state.',
      },
      {
        id: 'orientation',
        title: 'Orientation',
        description: 'Loaded system structure and current artistic identity before deciding how to handle the work.',
        status: 'completed',
        files: [
          { path: 'iamfranz-agent/ARCHITECTURE.md', kind: 'read', note: 'system blueprint' },
          { path: 'iamfranz-agent/skills/00-orchestrator.md', kind: 'read', note: 'mode routing rules' },
          { path: 'iamfranz-agent/state/artist-profile.md', kind: 'read', note: 'current self-definition' },
        ],
        changed: ['Established the current operating frame for the run.'],
      },
      {
        id: 'load-state',
        title: 'Load Current State',
        description: 'Reviewed current focus, memory, and recurring patterns before selecting the public bundle.',
        status: 'completed',
        files: [
          { path: 'iamfranz-agent/state/current-focus.md', kind: 'read', note: 'active series and focus' },
          { path: 'iamfranz-agent/state/style-tracker.md', kind: 'read', note: 'recurring motifs and failures' },
          { path: 'iamfranz-agent/state/memory.md', kind: 'read', note: 'durable artistic lessons' },
          { path: 'iamfranz-agent/state/journal.md', kind: 'read', note: 'recent working reflections' },
        ],
        summary: 'Checked whether the work fit the active arc rather than acting like a disconnected one-off.',
      },
      {
        id: 'route-mode',
        title: 'Route Session Mode',
        description: 'Selected the most appropriate artistic mode for the current bundle.',
        status: 'completed',
        mode,
        files: [{ path: 'iamfranz-agent/skills/00-orchestrator.md', kind: 'read', note: `${mode} mode chosen` }],
        changed: [`Session routed to ${mode}.`],
      },
      {
        id: 'prompt-and-process',
        title: 'Confirm Prompt + Process Notes',
        description: 'Validated the prompt source and updated the human-readable process explanation that travels with the work.',
        status: 'completed',
        files: [
          { path: files.promptFile, kind: 'read', note: 'exact image prompt' },
          { path: files.processFile, kind: 'updated', note: 'selection rationale and process note' },
        ],
        artifacts: [
          { label: 'Prompt document', path: files.promptFile, kind: 'markdown', note: exactPrompt ? `Prompt length ${exactPrompt.length} chars` : undefined },
          { label: 'Process note', path: files.processFile, kind: 'markdown', note: workType },
        ],
        changed: testing ? [testing] : undefined,
      },
      {
        id: 'render-artwork',
        title: 'Render Artwork',
        description: 'Generated the final image asset for the selected publish bundle.',
        status: 'completed',
        mode: 'Generate',
        files: [
          { path: files.imageFile, kind: 'generated', note: 'final rendered artwork' },
        ],
        artifacts: [
          { label: 'Rendered image', path: files.imageFile, kind: 'image', note: metadata.dimensions || metadata.medium || 'Digital image' },
        ],
        outputs: [metadata.description].filter(Boolean),
      },
      {
        id: 'assemble-bundle',
        title: 'Assemble Publish Bundle',
        description: 'Wrote the metadata and companion files needed for import into the public IAMFRANZ site.',
        status: 'completed',
        files: [
          { path: files.metadataFile, kind: 'updated', note: 'bundle metadata + run linkage' },
          ...(social ? [
            { path: files.socialFile, kind: 'generated', note: 'caption, hashtags, alt text' },
            { path: files.captionFile, kind: 'generated', note: 'social-ready caption copy' },
          ] : []),
          { path: files.runFile, kind: 'generated', note: 'human-readable run record' },
        ],
        artifacts: [
          { label: 'Bundle metadata', path: files.metadataFile, kind: 'json' },
          ...(social ? [
            { label: 'Social payload', path: files.socialFile, kind: 'json' },
            { label: 'Caption', path: files.captionFile, kind: 'markdown' },
          ] : []),
          { label: 'Run record', path: files.runFile, kind: 'json', note: 'timeline used by the Run page' },
        ],
        changed: formalDecisions.length ? formalDecisions : ['Created the public handoff package for the selected study.'],
      },
      {
        id: 'publish-handoff',
        title: 'Public Site Handoff',
        description: 'Prepared the bundle so the webapp importer can ingest it into the public-facing site.',
        status: 'completed',
        files: [
          { path: 'scripts/renderIamfranzBundle.mjs', kind: 'read', note: 'bundle renderer' },
          { path: 'scripts/importIamfranzArtifact.mjs', kind: 'read', note: 'site importer' },
          { path: `publish/${bundleName}`, kind: 'selected', note: 'ready for import' },
        ],
        outputs: [social?.caption ? 'Bundle includes social-ready caption payload.' : 'Bundle is ready to import into the public site.'],
        summary: 'The run ended with an export-ready artifact rather than a hidden internal draft.',
      },
    ],
  };
}

async function main() {
  const absDir = path.resolve(artifactDir);
  const bundleName = path.basename(absDir);
  const metadataPath = path.join(absDir, 'metadata.json');
  const runPath = path.join(absDir, 'run.json');

  if (!overwrite && await exists(runPath)) {
    console.log(JSON.stringify({ ok: true, skipped: true, reason: 'run-exists', runPath }, null, 2));
    return;
  }

  const metadata = await readJson(metadataPath);
  const processNote = await readTextIfExists(path.join(absDir, metadata.processNoteFile || 'process.md'));
  const promptDoc = await readTextIfExists(path.join(absDir, metadata.promptFile || 'prompt.md'));
  const socialPath = path.join(absDir, metadata.social?.socialFile || 'social.json');
  const social = await exists(socialPath) ? await readJson(socialPath) : null;

  const runRecord = buildRunRecord({ bundleName, metadata, processNote, promptDoc, social });
  await fs.writeFile(runPath, JSON.stringify(runRecord, null, 2) + '\n', 'utf8');

  metadata.run = {
    runFile: 'run.json',
    updatedAt: new Date().toISOString(),
    schemaVersion: runRecord.schemaVersion,
  };
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2) + '\n', 'utf8');

  console.log(JSON.stringify({ ok: true, artifactDir: absDir, runPath, runId: runRecord.runId }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
