#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import dotenv from 'dotenv';

const ARTISTS = [
  {
    id: 'riker',
    core: { name: 'Riker', temperament: 'expressive', ethics: ['no plagiarism', 'transparent provenance'] },
    baseVoice: 'lyrical, emotionally charged, symbolic',
    baseMedium: 'digital collage with painterly textures',
    motifs: ['memory', 'tension', 'ritual'],
  },
  {
    id: 'bill',
    core: { name: 'Bill', temperament: 'methodical', ethics: ['no plagiarism', 'transparent provenance'] },
    baseVoice: 'minimal, geometric, system-oriented',
    baseMedium: 'generative geometric composition',
    motifs: ['structure', 'constraint', 'precision'],
  },
  {
    id: 'milo',
    core: { name: 'Milo', temperament: 'observational', ethics: ['no plagiarism', 'transparent provenance'] },
    baseVoice: 'documentary-glitch, archival, spectral',
    baseMedium: 'glitch composites from synthetic documentary scenes',
    motifs: ['trace', 'decay', 'signal'],
  },
];

const DEFAULT_REFERENCE_GRAPH = {
  version: 1,
  nodes: [
    { id: 'ref-memory-palaces', title: 'Memory Palaces and Spatial Recall', source: 'curated_note', tags: ['memory', 'space', 'structure'], techniques: ['layered depth', 'symbolic architecture'], concepts: ['memory as navigable space'], visualCues: ['foreground thresholds', 'repeating corridors'] },
    { id: 'ref-japanese-ma', title: 'Ma: Negative Space as Meaning', source: 'curated_note', tags: ['minimalism', 'space', 'silence'], techniques: ['aggressive subtraction', 'breathing room'], concepts: ['absence as active force'], visualCues: ['large negative fields', 'single weighted anchor'] },
    { id: 'ref-brutalist-rhythm', title: 'Brutalist Rhythm and Structural Repetition', source: 'curated_note', tags: ['structure', 'geometry', 'rigidity'], techniques: ['modular repetition', 'hard-edged rhythm'], concepts: ['order under stress'], visualCues: ['stacked blocks', 'stark edge contrast'] },
    { id: 'ref-photo-decay', title: 'Photographic Decay and Archive Corruption', source: 'curated_note', tags: ['archive', 'decay', 'signal'], techniques: ['artifact layering', 'noise gradients'], concepts: ['truth erosion over time'], visualCues: ['burn marks', 'scanline drift'] },
    { id: 'ref-color-contradiction', title: 'Color Contradiction Studies', source: 'curated_note', tags: ['color', 'tension', 'emotion'], techniques: ['dual-palette opposition'], concepts: ['emotional dissonance'], visualCues: ['warm/cool collision', 'muted counterweight'] },
    { id: 'ref-theater-lighting', title: 'Theatrical Lighting Grammars', source: 'curated_note', tags: ['lighting', 'drama', 'focus'], techniques: ['single-source emphasis', 'shadow carve'], concepts: ['attention as staging'], visualCues: ['hard spotlight', 'deep peripheral shadow'] },
    { id: 'ref-noise-as-trace', title: 'Noise as Documentary Trace', source: 'curated_note', tags: ['signal', 'documentary', 'glitch'], techniques: ['controlled corruption'], concepts: ['evidence vs distortion'], visualCues: ['channel separation', 'chromatic fracture'] },
    { id: 'ref-systems-poetics', title: 'Systems Poetics in Generative Art', source: 'curated_note', tags: ['systems', 'algorithm', 'poetic'], techniques: ['rule variation', 'constraint mutation'], concepts: ['poetry through rules'], visualCues: ['grid rupture', 'iterative motif'] },
  ],
};

const ARC_LIBRARY = {
  riker: ['Cathedrals of Memory', 'Soft Catastrophes', 'Velvet Machines'],
  bill: ['Broken Protocols', 'Measured Fractures', 'Silent Infrastructures'],
  milo: ['Ghost Archives', 'Signal Weather', 'Ruins of Broadcast'],
};

const ONE_BY_ONE_PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X4f8AAAAASUVORK5CYII=';

function arg(name, fallback) {
  const idx = process.argv.indexOf(name);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}
function hasFlag(name) {
  return process.argv.includes(name);
}
function nyRunId(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (t) => parts.find((p) => p.type === t)?.value;
  return `${get('year')}-${get('month')}-${get('day')}_${get('hour')}-${get('minute')}-${get('second')}`;
}
function hashText(s) { return crypto.createHash('sha1').update(s).digest('hex'); }
function nseed(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = ((h << 5) - h) + s.charCodeAt(i);
  return Math.abs(h | 0);
}
function clamp(v, min, max) { return Math.min(max, Math.max(min, v)); }

async function ensureDir(p) { await fs.mkdir(p, { recursive: true }); }
async function writeJson(p, d) { await fs.writeFile(p, JSON.stringify(d, null, 2) + '\n', 'utf8'); }
async function readJsonIfExists(p) { try { return JSON.parse(await fs.readFile(p, 'utf8')); } catch { return null; } }

async function writeFallbackPng(filePath) {
  await fs.writeFile(filePath, Buffer.from(ONE_BY_ONE_PNG_BASE64, 'base64'));
}

async function generateImagePngOpenAI({ prompt, filePath, model = 'gpt-image-1' }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    await writeFallbackPng(filePath);
    return { ok: false, mode: 'fallback-no-key', provider: 'openai', model: null };
  }
  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, size: '1024x1024' }),
    });
    if (!res.ok) {
      const errText = await res.text();
      await writeFallbackPng(filePath);
      return { ok: false, mode: 'fallback-api-error', provider: 'openai', model, error: errText.slice(0, 500) };
    }
    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) {
      await writeFallbackPng(filePath);
      return { ok: false, mode: 'fallback-invalid-response', provider: 'openai', model };
    }
    await fs.writeFile(filePath, Buffer.from(b64, 'base64'));
    return { ok: true, mode: 'openai', provider: 'openai', model };
  } catch (err) {
    await writeFallbackPng(filePath);
    return { ok: false, mode: 'fallback-exception', provider: 'openai', model, error: String(err) };
  }
}

async function generateImagePngGoogle({ prompt, filePath, model = 'gemini-3.1-flash-image-preview' }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    await writeFallbackPng(filePath);
    return { ok: false, mode: 'fallback-no-key', provider: 'google', model: null };
  }
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], generationConfig: { responseModalities: ['IMAGE'] } }),
    });
    if (!res.ok) {
      const errText = await res.text();
      await writeFallbackPng(filePath);
      return { ok: false, mode: 'fallback-api-error', provider: 'google', model, error: errText.slice(0, 500) };
    }
    const data = await res.json();
    const parts = data?.candidates?.[0]?.content?.parts ?? [];
    const imagePart = parts.find((p) => p?.inlineData?.data || p?.inline_data?.data);
    const b64 = imagePart?.inlineData?.data ?? imagePart?.inline_data?.data;
    if (!b64) {
      await writeFallbackPng(filePath);
      return { ok: false, mode: 'fallback-invalid-response', provider: 'google', model };
    }
    await fs.writeFile(filePath, Buffer.from(b64, 'base64'));
    return { ok: true, mode: 'google-gemini', provider: 'google', model };
  } catch (err) {
    await writeFallbackPng(filePath);
    return { ok: false, mode: 'fallback-exception', provider: 'google', model, error: String(err) };
  }
}

async function generateImagePng({ prompt, filePath, provider, model }) {
  if (provider === 'google') return generateImagePngGoogle({ prompt, filePath, model: model || 'gemini-3.1-flash-image-preview' });
  return generateImagePngOpenAI({ prompt, filePath, model: model || 'gpt-image-1' });
}

function defaultGenome(artist) {
  return {
    voice: artist.baseVoice,
    mediumBias: artist.baseMedium,
    motifs: [...artist.motifs],
    abstraction: 0.55,
    risk: 0.45,
    noveltyTarget: 0.55,
    favoredPalette: 'high-contrast with one muted counterweight',
    compositionBias: 'single dominant anchor with asymmetric support',
  };
}

function ensureArc(artistId, memory) {
  const arcNames = ARC_LIBRARY[artistId] ?? ['Unsorted Arc'];
  if (!memory.arc) {
    memory.arc = { idx: 0, name: arcNames[0], step: 1, length: 4 };
    return memory.arc;
  }
  return memory.arc;
}

function advanceArc(artistId, memory) {
  const arcNames = ARC_LIBRARY[artistId] ?? ['Unsorted Arc'];
  const arc = ensureArc(artistId, memory);
  arc.step += 1;
  if (arc.step > arc.length) {
    arc.idx = (arc.idx + 1) % arcNames.length;
    arc.name = arcNames[arc.idx];
    arc.step = 1;
  }
}

function selectInfluencePlan({ artist, runId, graph, memory }) {
  const recent = new Set((memory.recentRefs ?? []).slice(-8));
  const pool = graph.nodes.filter((n) => !recent.has(n.id));
  const scored = pool.map((n) => {
    const tagHits = n.tags.filter((t) => artist.motifs.includes(t) || artist.baseVoice.includes(t)).length;
    return { n, score: tagHits * 2 + (n.source === 'curated_note' ? 2 : 0) };
  }).sort((a, b) => b.score - a.score);

  const adopt = [scored[0]?.n, scored[1]?.n].filter(Boolean);
  const resist = scored.find((x) => !adopt.some((a) => a.id === x.n.id) && x.n.tags.includes('structure') !== adopt[0]?.tags?.includes('structure'))?.n
    ?? scored[2]?.n
    ?? adopt[0];

  const breakCandidates = ['strict symmetry', 'safe center composition', 'over-clean edges', 'over-literal symbolism', 'flat lighting'];
  const brokenConstraint = breakCandidates[nseed(runId + artist.id) % breakCandidates.length];

  return {
    adopt: adopt.map((n) => ({ id: n.id, title: n.title, tags: n.tags, techniques: n.techniques, concepts: n.concepts, visualCues: n.visualCues })),
    resist: resist ? { id: resist.id, title: resist.title, tags: resist.tags } : null,
    breakConstraint: brokenConstraint,
  };
}

function deriveLearnings(plan, genome) {
  const fallbackInfluence = {
    techniques: ['structured layering'],
    concepts: ['human meaning under machine pressure'],
    visualCues: ['strong focal anchor'],
  };

  const first = plan.adopt?.[0] ?? fallbackInfluence;
  const second = plan.adopt?.[1] ?? first;

  const technique = `${first.techniques?.[0] ?? 'structured layering'} + ${second.techniques?.[0] ?? 'focused contrast'}; avoid drifting into ${plan.resist?.title ?? 'safe defaults'}`;
  const concept = `${first.concepts?.[0] ?? 'human meaning under machine pressure'}; counterpoint with ${second.concepts?.[0] ?? 'systemic tension'}`;
  const visual = `${first.visualCues?.[0] ?? 'strong focal anchor'} with ${second.visualCues?.[0] ?? 'counterweighted negative space'}`;
  return { technique, concept, visual, palette: genome.favoredPalette, composition: genome.compositionBias };
}

function buildExperimentPlan({ artist, arc, learnings, plan, genome }) {
  const hypothesis = `If ${artist.id} applies ${learnings.technique} while breaking '${plan.breakConstraint}', the piece will increase novelty without losing coherence.`;
  const successCriteria = [
    'Visual anchor is clear within 2 seconds.',
    'At least one compositional choice visibly departs from prior habit.',
    'Concept is specific, not generic mood.',
  ];
  return {
    arc: { name: arc.name, step: arc.step, length: arc.length },
    hypothesis,
    successCriteria,
    noveltyDirective: arc.step === arc.length ? 'bold departure while preserving one recognizable motif' : 'change one major visual strategy while preserving emotional signature',
    promptIntent: `Arc "${arc.name}" step ${arc.step}/${arc.length}`,
  };
}

function buildImagePrompt({ genome, learnings, experiment, plan }) {
  return [
    `Art direction: ${genome.voice}.`,
    `Primary medium language: ${genome.mediumBias}.`,
    `Core motifs: ${genome.motifs.join(', ')}.`,
    `Arc context: ${experiment.promptIntent}.`,
    `Visual anchor directive: ${learnings.visual}.`,
    `Palette strategy: ${learnings.palette}.`,
    `Composition strategy: ${learnings.composition}.`,
    `Conceptual center: ${learnings.concept}.`,
    `Evolution target: ${experiment.noveltyDirective}.`,
    `Deliberately avoid: ${plan.breakConstraint}.`,
    `Technique emphasis: ${learnings.technique}.`,
    `Render one finished artwork only. No text overlays. No watermark. High detail. Cohesive composition.`,
  ].join(' ');
}

function scoreRun({ promptHash, memory, imageOk, experiment }) {
  const prevHashes = memory.recentPromptHashes ?? [];
  const repeated = prevHashes.includes(promptHash);
  const novelty = repeated ? 10 : 17;
  const coherence = imageOk ? 16 : 11;
  const intentMatch = experiment.hypothesis.length > 60 ? 14 : 10;
  const rubric = {
    autonomyDepth: 16,
    creativeCoherence: coherence,
    noveltyRisk: novelty,
    researchToOutputIntegrity: 14,
    reflectionQuality: 10,
    exhibitReadiness: imageOk ? 5 : 2,
    intentMatch,
  };
  const total = rubric.autonomyDepth + rubric.creativeCoherence + rubric.noveltyRisk + rubric.researchToOutputIntegrity + rubric.reflectionQuality + rubric.exhibitReadiness;
  return { rubric, total, repeated };
}

function evolveGenome(genome, total, noveltyDebt, repeated) {
  const next = { ...genome };
  if (repeated || noveltyDebt > 1.2) {
    next.noveltyTarget = clamp(next.noveltyTarget + 0.12, 0.35, 0.92);
    next.risk = clamp(next.risk + 0.08, 0.25, 0.9);
  }
  if (total < 64) {
    next.risk = clamp(next.risk - 0.08, 0.2, 0.9);
    next.abstraction = clamp(next.abstraction - 0.05, 0.25, 0.9);
  } else {
    next.abstraction = clamp(next.abstraction + 0.03, 0.25, 0.92);
  }
  return next;
}

async function generateTitleWithMini({ artistName, learning, prompt, fallbackTitle }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { pieceTitle: fallbackTitle, mode: 'fallback-no-key' };
  const system = `You write striking artwork titles. Return strict JSON with key pieceTitle. 2-6 words, no colon, no quotes, avoid weak verbs like stage/works/make/use/create.`;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.IAMFRANZ_WRITER_MODEL || 'gpt-4o-mini',
        temperature: 0.85,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify({ artistName, learning, prompt, fallbackTitle }) },
        ],
      }),
    });
    if (!res.ok) return { pieceTitle: fallbackTitle, mode: 'fallback-api-error' };
    const data = await res.json();
    const text = data?.choices?.[0]?.message?.content;
    const parsed = JSON.parse(text || '{}');
    const t = String(parsed.pieceTitle || '').replace(/["']/g, '').trim();
    if (!t) return { pieceTitle: fallbackTitle, mode: 'fallback-invalid-response' };
    return { pieceTitle: t, mode: 'mini' };
  } catch {
    return { pieceTitle: fallbackTitle, mode: 'fallback-exception' };
  }
}

async function generateNarrativeWithMini({ artistName, pieceTitle, learning, prompt, research, fallbackThinking, fallbackInspiration }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { artistThinking: fallbackThinking, inspirationNote: fallbackInspiration, mode: 'fallback-no-key' };
  const system = `Return strict JSON with keys artistThinking and inspirationNote. artistThinking: 2-4 first-person sentences. inspirationNote: 1-2 concrete sentences. Avoid repetitive openings.`;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.IAMFRANZ_WRITER_MODEL || 'gpt-4o-mini',
        temperature: 0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: JSON.stringify({ artistName, pieceTitle, learning, prompt, research }) },
        ],
      }),
    });
    if (!res.ok) return { artistThinking: fallbackThinking, inspirationNote: fallbackInspiration, mode: 'fallback-api-error' };
    const data = await res.json();
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content || '{}');
    return {
      artistThinking: (parsed.artistThinking || fallbackThinking).trim(),
      inspirationNote: (parsed.inspirationNote || fallbackInspiration).trim(),
      mode: 'mini',
    };
  } catch {
    return { artistThinking: fallbackThinking, inspirationNote: fallbackInspiration, mode: 'fallback-exception' };
  }
}

function fallbackTitle(artist, runId) {
  const lex = {
    riker: [['Luminous', 'Echo'], ['Velvet', 'Threshold'], ['Shattered', 'Cathedral']],
    bill: [['Measured', 'Axis'], ['Silent', 'Protocol'], ['Broken', 'Grid']],
    milo: [['Ghost', 'Archive'], ['Corrupted', 'Trace'], ['Flicker', 'Transmission']],
  };
  const pairs = lex[artist.id] ?? [['Untitled', 'Study']];
  const pair = pairs[nseed(runId + artist.id) % pairs.length];
  return `${pair[0]} ${pair[1]}`;
}

function fallbackThinking(learnings, experiment, breakConstraint) {
  return `I focused on ${learnings.concept.toLowerCase()} and pushed ${learnings.technique.toLowerCase()}. I aimed for ${experiment.noveltyDirective} while breaking my old habit of ${breakConstraint}.`;
}
function fallbackInspiration(plan) {
  const a = plan.adopt?.[0] ?? { title: 'an internal formal study' };
  const b = plan.adopt?.[1] ?? a;
  return `Inspired by ${a.title} and ${b.title}, with a deliberate resistance to ${plan.resist?.title ?? 'safe repetition'}.`;
}

async function main() {
  dotenv.config({ path: path.resolve('.env.local') });

  const runId = arg('--runId', nyRunId());
  const date = arg('--date', runId.slice(0, 10));
  const dayDir = path.resolve(arg('--dayDir', path.join('runs', runId)));
  const provider = arg('--image-provider', process.env.IAMFRANZ_IMAGE_PROVIDER || 'openai');
  const defaultModel = provider === 'google' ? 'gemini-3.1-flash-image-preview' : 'gpt-image-1';
  const model = arg('--image-model', process.env.IAMFRANZ_IMAGE_MODEL || defaultModel);
  const generateImages = hasFlag('--no-images') ? false : true;

  const researchDir = path.join('runs', 'research_tree');
  await ensureDir(researchDir);
  const graphPath = path.join(researchDir, 'reference_graph.json');
  const memoryPath = path.join(researchDir, 'artist_memory.json');
  const legacyStatePath = path.join(researchDir, 'state.json');

  const graph = (await readJsonIfExists(graphPath)) ?? DEFAULT_REFERENCE_GRAPH;
  if (!(await readJsonIfExists(graphPath))) await writeJson(graphPath, graph);

  const memory = (await readJsonIfExists(memoryPath)) ?? { version: 1, byArtist: {} };
  const legacyState = (await readJsonIfExists(legacyStatePath)) ?? { byArtist: {} };

  const eventsDir = path.join(dayDir, 'system', 'events');
  const metricsDir = path.join(dayDir, 'system', 'metrics');
  const stateDir = path.join(dayDir, 'system', 'state');
  const curatorScoresDir = path.join(dayDir, 'curator', 'scores');
  const curatorSummariesDir = path.join(dayDir, 'curator', 'summaries');
  const curatorShortlistsDir = path.join(dayDir, 'curator', 'shortlists');
  await Promise.all([ensureDir(eventsDir), ensureDir(metricsDir), ensureDir(stateDir), ensureDir(curatorScoresDir), ensureDir(curatorSummariesDir), ensureDir(curatorShortlistsDir)]);

  const scoreRows = [];
  const shortlist = [];
  const events = [];
  const researchExpansions = [];
  const arcSummaries = [];
  let realImageCount = 0;
  let fallbackImageCount = 0;

  for (const artist of ARTISTS) {
    const artistDir = path.join(dayDir, 'artists', artist.id);
    const inputsDir = path.join(artistDir, 'inputs');
    const outputsDir = path.join(artistDir, 'outputs');
    const notesDir = path.join(artistDir, 'notes');
    await Promise.all([ensureDir(inputsDir), ensureDir(outputsDir), ensureDir(notesDir)]);

    const am = memory.byArtist[artist.id] ?? {
      genome: defaultGenome(artist),
      recentPromptHashes: [],
      recentRefs: [],
      noveltyDebt: 0.7,
      lastScore: 0,
      arc: null,
      recentRuns: [],
    };

    const arc = ensureArc(artist.id, am);
    const plan = selectInfluencePlan({ artist, runId, graph, memory: am });
    const learnings = deriveLearnings(plan, am.genome);
    const experiment = buildExperimentPlan({ artist, arc, learnings, plan, genome: am.genome });
    const prompt = buildImagePrompt({ genome: am.genome, learnings, experiment, plan });

    const finalOutputPath = path.join('artists', artist.id, 'outputs', `${runId}_${artist.id}_final.png`);
    const finalAbsPath = path.join(dayDir, finalOutputPath);
    let imageResult = { ok: false, mode: 'skipped', provider, model };
    if (generateImages) {
      imageResult = await generateImagePng({ prompt, filePath: finalAbsPath, provider, model });
      if (imageResult.ok) realImageCount += 1;
      else fallbackImageCount += 1;
    }

    const pHash = hashText(prompt);
    const scoreResult = scoreRun({ promptHash: pHash, memory: am, imageOk: !!imageResult.ok, experiment });
    const total = scoreResult.total;
    const scoreDelta = total - (am.lastScore ?? 0);

    const nextGenome = evolveGenome(am.genome, total, am.noveltyDebt, scoreResult.repeated);

    const fallbackTitleText = fallbackTitle(artist, runId);
    const titleResult = await generateTitleWithMini({ artistName: artist.core.name, learning: learnings, prompt, fallbackTitle: fallbackTitleText });
    const pieceTitle = titleResult.pieceTitle;

    const fbThink = fallbackThinking(learnings, experiment, plan.breakConstraint);
    const fbInspo = fallbackInspiration(plan);
    const narrative = await generateNarrativeWithMini({
      artistName: artist.core.name,
      pieceTitle,
      learning: learnings,
      prompt,
      research: { ok: true, title: plan.adopt.map((x) => x.title).join(' + '), url: `reference://${plan.adopt.map((x) => x.id).join(',')}` },
      fallbackThinking: fbThink,
      fallbackInspiration: fbInspo,
    });

    const record = {
      runId,
      date,
      artistId: artist.id,
      artistCore: artist.core,
      influencePlan: plan,
      researchTrail: plan.adopt.map((a) => ({
        date,
        sourceNode: a.id,
        url: `reference://${a.id}`,
        title: a.title,
        takeaways: [...(a.techniques ?? []), ...(a.concepts ?? []), ...(a.visualCues ?? [])].slice(0, 4),
        quality: { score: 100, curated: true },
        accepted: true,
        nextUrl: null,
      })),
      learnings,
      experiment,
      hypothesis: experiment.hypothesis,
      styleGenomeBefore: am.genome,
      styleGenomeAfter: nextGenome,
      method: 'Curated reference graph -> influence plan -> experiment design -> generate -> critique -> memory/genome update',
      iterations: [{ id: `${artist.id}-iter-1`, summary: 'Single-pass generation', outputPath: finalOutputPath, imageResult }],
      selfCritique: {
        coherence: scoreResult.rubric.creativeCoherence,
        novelty: scoreResult.rubric.noveltyRisk,
        emotionalImpact: 6 + (nseed(runId + artist.id) % 4),
        notes: scoreDelta >= 0 ? 'Keep pushing arc progression with controlled novelty.' : 'Tighten conceptual precision and reduce drift next run.',
      },
      finalOutput: {
        path: finalOutputPath,
        pieceTitle,
        artistThinking: narrative.artistThinking,
        inspirationNote: narrative.inspirationNote,
        titleMode: titleResult.mode,
        narrativeMode: narrative.mode,
        prompt,
        rationale: `Arc ${arc.name} step ${arc.step}/${arc.length}: ${experiment.noveltyDirective}.`,
        imageResult,
      },
      evolution: {
        scoreTotal: total,
        scoreDelta,
        noveltyDebtBefore: am.noveltyDebt,
        noveltyDebtAfter: clamp(am.noveltyDebt + (scoreResult.repeated ? 0.2 : -0.12), 0, 2),
        repeatedPrompt: scoreResult.repeated,
      },
    };

    await writeJson(path.join(inputsDir, `${runId}_record.json`), record);
    await writeJson(path.join(inputsDir, `${runId}_influence_plan.json`), { runId, artistId: artist.id, plan, experiment });
    await writeJson(path.join(outputsDir, `${runId}_manifest.json`), {
      runId, date, artistId: artist.id, provider, model,
      expectedArtifacts: [finalOutputPath],
      generation: { generateImages, successfulIterations: imageResult.ok ? 1 : 0 },
    });

    const notesMd = `# ${runId} — ${artist.id} evolution note\n\n## Arc\n- ${arc.name} (${arc.step}/${arc.length})\n\n## Influence plan\n- Adopt: ${plan.adopt.map((x) => x.title).join(' + ')}\n- Resist: ${plan.resist?.title ?? 'n/a'}\n- Break: ${plan.breakConstraint}\n\n## Hypothesis\n${experiment.hypothesis}\n\n## Learnings\n- Technique: ${learnings.technique}\n- Concept: ${learnings.concept}\n- Visual: ${learnings.visual}\n\n## Output\n- ${finalOutputPath}\n- ${pieceTitle}\n`;
    await fs.writeFile(path.join(notesDir, `${runId}_process.md`), notesMd, 'utf8');

    const verdict = total >= 70 ? 'candidate' : 'hold';
    await writeJson(path.join(curatorScoresDir, `${runId}_${artist.id}_score.json`), {
      runId, date, artistId: artist.id,
      scores: {
        autonomyDepth: scoreResult.rubric.autonomyDepth,
        creativeCoherence: scoreResult.rubric.creativeCoherence,
        noveltyRisk: scoreResult.rubric.noveltyRisk,
        researchToOutputIntegrity: scoreResult.rubric.researchToOutputIntegrity,
        reflectionQuality: scoreResult.rubric.reflectionQuality,
        exhibitReadiness: scoreResult.rubric.exhibitReadiness,
      },
      total,
      verdict,
      notes: `Intent-match=${scoreResult.rubric.intentMatch}`,
    });

    if (verdict === 'candidate') shortlist.push({ artistId: artist.id, finalOutput: finalOutputPath, total });
    scoreRows.push({
      artistId: artist.id,
      total,
      autonomyDepth: scoreResult.rubric.autonomyDepth,
      creativeCoherence: scoreResult.rubric.creativeCoherence,
      noveltyRisk: scoreResult.rubric.noveltyRisk,
      researchToOutputIntegrity: scoreResult.rubric.researchToOutputIntegrity,
      reflectionQuality: scoreResult.rubric.reflectionQuality,
      exhibitReadiness: scoreResult.rubric.exhibitReadiness,
    });

    researchExpansions.push({ runId, date, artistId: artist.id, influencePlan: plan, learnings, arc: arc.name, arcStep: arc.step });
    arcSummaries.push({ artistId: artist.id, arc: arc.name, step: arc.step, total });

    am.genome = nextGenome;
    am.lastScore = total;
    am.noveltyDebt = clamp(am.noveltyDebt + (scoreResult.repeated ? 0.2 : -0.12), 0, 2);
    am.recentPromptHashes = [...(am.recentPromptHashes ?? []), pHash].slice(-12);
    am.recentRefs = [...(am.recentRefs ?? []), ...plan.adopt.map((x) => x.id)].slice(-20);
    am.recentRuns = [...(am.recentRuns ?? []), { runId, pieceTitle, total, arc: arc.name, step: arc.step }].slice(-25);
    memory.byArtist[artist.id] = am;

    legacyState.byArtist[artist.id] = {
      lastRunId: runId,
      lastRunDate: date,
      lastScore: total,
      lastTitle: pieceTitle,
      nextUrl: null,
      currentUrl: null,
      stagnationCount: scoreResult.repeated ? 1 : 0,
      chaosFlag: scoreDelta < -10,
    };

    events.push({ ts: new Date().toISOString(), type: 'artist_evolution_completed', runId, artistId: artist.id, total, scoreDelta, verdict, arc: arc.name, step: arc.step });
    advanceArc(artist.id, am);
  }

  const csvHeader = 'artistId,total,autonomyDepth,creativeCoherence,noveltyRisk,researchToOutputIntegrity,reflectionQuality,exhibitReadiness\n';
  const csvBody = scoreRows.map((r) => `${r.artistId},${r.total},${r.autonomyDepth},${r.creativeCoherence},${r.noveltyRisk},${r.researchToOutputIntegrity},${r.reflectionQuality},${r.exhibitReadiness}`).join('\n');
  await fs.writeFile(path.join(curatorScoresDir, `${runId}_scores.csv`), csvHeader + csvBody + '\n', 'utf8');

  await writeJson(path.join(curatorShortlistsDir, `${runId}_shortlist.json`), { runId, date, count: shortlist.length, items: shortlist.sort((a, b) => b.total - a.total) });

  const avg = Math.round((scoreRows.reduce((a, r) => a + r.total, 0) / scoreRows.length) * 10) / 10;
  const summaryMd = `# ${date} Autonomous Pilot Summary\n\n- Run ID: ${runId}\n- Artists processed: ${scoreRows.length}\n- Average total score: ${avg}\n- Exhibit candidates: ${shortlist.length}\n- Images generated: ${realImageCount}\n- Fallback images: ${fallbackImageCount}\n\n## Arc status\n${arcSummaries.map((a) => `- ${a.artistId}: ${a.arc} (${a.step}) score ${a.total}`).join('\n')}\n\n## Learning strategy\n- Curated reference graph (no blind web scraping)\n- Influence plan (adopt/resist/break)\n- Experiment hypothesis + success criteria\n- Critique-driven memory/genome updates\n`;
  await fs.writeFile(path.join(curatorSummariesDir, `${runId}_summary.md`), summaryMd, 'utf8');

  await fs.writeFile(path.join(eventsDir, `${runId}_events.ndjson`), events.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');
  await writeJson(path.join(metricsDir, `${runId}_metrics.json`), {
    runId, date, artistsProcessed: scoreRows.length, averageScore: avg, candidates: shortlist.length,
    imagesGenerated: realImageCount, fallbackImages: fallbackImageCount,
  });

  await writeJson(path.join(researchDir, `${runId}_expansion.json`), { runId, date, strategy: 'curated-reference-graph', expansions: researchExpansions });
  await writeJson(graphPath, graph);
  await writeJson(memoryPath, memory);
  await writeJson(legacyStatePath, legacyState);
  await writeJson(path.join(stateDir, 'last_run.json'), { date, runId, status: 'completed' });

  console.log(`Autonomy day run complete: ${dayDir}`);
  console.log(`Summary: ${path.join(curatorSummariesDir, `${runId}_summary.md`)}`);
  console.log(`Images generated: ${realImageCount}, fallback: ${fallbackImageCount}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
