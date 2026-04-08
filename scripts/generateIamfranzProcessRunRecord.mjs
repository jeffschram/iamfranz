#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';

const dayDirArg = getArg('--dayDir') || getArg('--runDir') || getArg('--dir');
const overwrite = hasFlag('--overwrite');

if (!dayDirArg) {
  console.error('Usage: node scripts/generateIamfranzProcessRunRecord.mjs --dayDir <runs/runId> [--overwrite]');
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

async function readJsonIfExists(filePath) {
  try {
    return JSON.parse(await fs.readFile(filePath, 'utf8'));
  } catch {
    return null;
  }
}

async function readTextIfExists(filePath) {
  try {
    return await fs.readFile(filePath, 'utf8');
  } catch {
    return null;
  }
}

async function listFiles(dirPath) {
  try {
    const entries = await fs.readdir(dirPath, { withFileTypes: true });
    return entries.filter((entry) => entry.isFile()).map((entry) => entry.name).sort();
  } catch {
    return [];
  }
}

function rel(root, filePath) {
  return path.relative(root, filePath).split(path.sep).join('/');
}

function titleCase(value) {
  return String(value || '')
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatRunTitle(runId) {
  return `Process Run — ${runId}`;
}

function summarizeArtistMemory(memory) {
  if (!memory) return null;
  const recentRuns = memory.recentRuns ?? [];
  const lastRun = recentRuns[recentRuns.length - 1];
  if (!lastRun) return null;
  return `${titleCase(lastRun.artistId)} previously peaked at ${lastRun.total} in ${lastRun.arc} (${lastRun.step}).`;
}

async function buildArtistStage({ rootDir, runId, artistId, scoreMap }) {
  const artistDir = path.join(rootDir, 'artists', artistId);
  const inputsDir = path.join(artistDir, 'inputs');
  const outputsDir = path.join(artistDir, 'outputs');
  const notesDir = path.join(artistDir, 'notes');

  const inputFiles = await listFiles(inputsDir);
  const outputFiles = await listFiles(outputsDir);
  const noteFiles = await listFiles(notesDir);
  const finalImage = outputFiles.find((file) => file.endsWith('_final.png'));
  const score = scoreMap.get(artistId);

  const artifacts = [];
  if (finalImage) {
    artifacts.push({
      label: `${titleCase(artistId)} output`,
      path: rel(rootDir, path.join(outputsDir, finalImage)),
      kind: 'image',
      note: score ? `Total score ${score.total} • ${score.verdict}` : 'Rendered final candidate',
      status: score?.verdict === 'candidate' ? 'selected' : 'draft',
    });
  }

  return {
    id: `artist-${artistId}`,
    title: `${titleCase(artistId)} / Generate + Score`,
    description: `Input assembly, output render, notes, and curator score for ${titleCase(artistId)}.`,
    status: 'completed',
    mode: 'Generate',
    files: [
      ...inputFiles.map((file) => ({ path: rel(rootDir, path.join(inputsDir, file)), kind: 'created', note: 'artist input artifact' })),
      ...outputFiles.map((file) => ({ path: rel(rootDir, path.join(outputsDir, file)), kind: 'generated', note: 'artist output artifact' })),
      ...noteFiles.map((file) => ({ path: rel(rootDir, path.join(notesDir, file)), kind: 'updated', note: 'process note' })),
      ...(score ? [{ path: rel(rootDir, path.join(rootDir, 'curator', 'scores', `${runId}_${artistId}_score.json`)), kind: 'read', note: 'curator score record' }] : []),
    ],
    artifacts: artifacts.length ? artifacts : undefined,
    outputs: [
      score ? `${titleCase(artistId)} total score: ${score.total}` : null,
      score?.notes ?? null,
    ].filter(Boolean),
    decision: score ? {
      label: `${titleCase(artistId)} verdict`,
      value: `${score.verdict === 'candidate' ? 'Selected candidate' : 'Hold'} (${score.total})`,
      note: score.notes || undefined,
    } : undefined,
    changed: score ? [
      `${titleCase(artistId)} completed the generation loop with a ${score.verdict} verdict.`,
    ] : undefined,
  };
}

async function main() {
  const dayDir = path.resolve(dayDirArg);
  const runId = path.basename(dayDir);
  const runPath = path.join(dayDir, 'run.json');

  if (!overwrite && await exists(runPath)) {
    console.log(JSON.stringify({ ok: true, skipped: true, reason: 'run-exists', runPath }, null, 2));
    return;
  }

  const lastRun = await readJsonIfExists(path.join(dayDir, 'system', 'state', 'last_run.json'));
  const metrics = await readJsonIfExists(path.join(dayDir, 'system', 'metrics', `${runId}_metrics.json`));
  const shortlist = await readJsonIfExists(path.join(dayDir, 'curator', 'shortlists', `${runId}_shortlist.json`));
  const summaryText = await readTextIfExists(path.join(dayDir, 'curator', 'summaries', `${runId}_summary.md`));
  const researchExpansion = await readJsonIfExists(path.join(dayDir, 'runs', 'research_tree', `${runId}_expansion.json`));
  const legacyResearchExpansion = await readJsonIfExists(path.join('runs', 'research_tree', `${runId}_expansion.json`));
  const research = researchExpansion || legacyResearchExpansion;
  const memory = await readJsonIfExists(path.join('runs', 'research_tree', 'artist_memory.json'));

  const scoreDir = path.join(dayDir, 'curator', 'scores');
  const scoreFiles = (await listFiles(scoreDir)).filter((file) => file.endsWith('_score.json'));
  const scoreEntries = await Promise.all(scoreFiles.map(async (file) => readJson(path.join(scoreDir, file))));
  const scoreMap = new Map(scoreEntries.map((entry) => [entry.artistId, entry]));

  const artistDir = path.join(dayDir, 'artists');
  const artistEntries = await fs.readdir(artistDir, { withFileTypes: true }).catch(() => []);
  const artistIds = artistEntries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();

  const startedAt = lastRun?.startedAt || `${runId.replace('_', 'T').replace(/-/g, ':').replace(/^(.{10})T(.*)$/, '$1T$2')}`;
  const completedAt = lastRun?.completedAt || null;

  const explorationSummary = research?.expansions?.map((item) => {
    const influenceCount = item?.influencePlan?.adopt?.length ?? 0;
    return `${titleCase(item.artistId)}: ${item.arc} step ${item.arcStep}, ${influenceCount} adopted references.`;
  }) ?? [];

  const steps = [
    {
      id: 'session-start',
      title: 'Session Start',
      description: 'Created the canonical process-run workspace under runs/<runId>.',
      status: 'completed',
      files: [
        { path: 'run.json', kind: 'generated', note: 'process run manifest (this file)' },
        { path: 'system/state/last_run.json', kind: 'updated', note: 'run completion pointer' },
      ],
      summary: 'This run now owns a durable root directory instead of scattering evidence into detached sidecars.',
    },
    {
      id: 'research-and-planning',
      title: 'Research + Planning',
      description: 'Loaded the shared research tree, expanded influence plans, and set experiment hypotheses.',
      status: 'completed',
      mode: 'Explore',
      files: [
        { path: 'runs/research_tree/reference_graph.json', kind: 'read', note: 'reference graph' },
        { path: 'runs/research_tree/artist_memory.json', kind: 'read', note: 'cross-run memory' },
        ...(research ? [{ path: `runs/research_tree/${runId}_expansion.json`, kind: 'generated', note: 'per-run expansion log' }] : []),
      ],
      outputs: explorationSummary,
      changed: artistIds.map((artistId) => summarizeArtistMemory(memory?.byArtist?.[artistId])).filter(Boolean),
    },
    ...await Promise.all(artistIds.map((artistId) => buildArtistStage({ rootDir: dayDir, runId, artistId, scoreMap }))),
    {
      id: 'curation-summary',
      title: 'Curator Summary + Shortlist',
      description: 'Collapsed artist-level outputs into a run-level summary, CSV scores, and shortlist.',
      status: 'completed',
      mode: 'Curate',
      files: [
        { path: `curator/scores/${runId}_scores.csv`, kind: 'generated', note: 'score matrix' },
        { path: `curator/shortlists/${runId}_shortlist.json`, kind: 'generated', note: 'candidate shortlist' },
        { path: `curator/summaries/${runId}_summary.md`, kind: 'generated', note: 'run summary' },
        { path: `system/metrics/${runId}_metrics.json`, kind: 'generated', note: 'run metrics' },
        { path: `system/events/${runId}_events.ndjson`, kind: 'generated', note: 'event log' },
      ],
      decision: shortlist ? {
        label: 'Shortlist outcome',
        value: `${shortlist.count ?? shortlist.items?.length ?? 0} candidates selected`,
        note: metrics ? `Average score ${metrics.averageScore}` : undefined,
      } : undefined,
      outputs: [
        metrics ? `Artists processed: ${metrics.artistsProcessed}` : null,
        metrics ? `Images generated: ${metrics.imagesGenerated} real / ${metrics.fallbackImages} fallback` : null,
      ].filter(Boolean),
      summary: summaryText?.split('\n').find((line) => line.startsWith('- Average total score:'))?.replace(/^-\s*/, '') || 'Curator outputs recorded for the run.',
    },
  ];

  const primaryArtifact = shortlist?.items?.[0];
  const primaryImagePath = primaryArtifact?.finalOutput || null;

  const record = {
    schemaVersion: 2,
    runId,
    agent: 'IAMFRANZ',
    title: formatRunTitle(runId),
    pieceTitle: primaryArtifact ? `${titleCase(primaryArtifact.artistId)} candidate` : 'Process run',
    status: lastRun?.status || 'completed',
    mode: 'Curate',
    startedAt: startedAt || undefined,
    completedAt: completedAt || undefined,
    overview: metrics
      ? `Process-level autonomous run covering ${metrics.artistsProcessed} artists, ${shortlist?.count ?? 0} shortlisted candidates, and ${metrics.imagesGenerated} generated images.`
      : 'Process-level autonomous run emitted from the legacy multi-artist runtime.',
    source: {
      dayDir,
      summaryFile: `curator/summaries/${runId}_summary.md`,
      metricsFile: `system/metrics/${runId}_metrics.json`,
      shortlistFile: `curator/shortlists/${runId}_shortlist.json`,
      eventsFile: `system/events/${runId}_events.ndjson`,
      primaryImagePath,
    },
    steps,
  };

  await fs.writeFile(runPath, JSON.stringify(record, null, 2) + '\n', 'utf8');
  console.log(JSON.stringify({ ok: true, runId, dayDir, runPath }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
