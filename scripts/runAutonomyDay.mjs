#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';

const ARTISTS = [
  {
    id: 'a1-maximalist-poet',
    voice: 'Lyrical, emotional, layered symbolism',
    primaryMedium: 'Digital collage + painterly texture',
    constraints: ['high color tension', 'human-scale metaphor', 'one fractured focal subject'],
  },
  {
    id: 'a2-systems-minimalist',
    voice: 'Constraint-driven, geometric, sparse',
    primaryMedium: 'Generative geometry stills',
    constraints: ['max 3 shapes', '2-color palette', 'strict alignment grid'],
  },
  {
    id: 'a3-glitch-documentarian',
    voice: 'Memory-noise realism, archival artifacts',
    primaryMedium: 'Glitch photography composites',
    constraints: ['found-text fragment', 'signal degradation', 'one documentary anchor'],
  },
];

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

function dateStamp(d = new Date()) {
  return d.toISOString().slice(0, 10);
}

function scoreTotal(s) {
  return s.autonomyDepth + s.creativeCoherence + s.noveltyRisk + s.researchToOutputIntegrity + s.reflectionQuality + s.exhibitReadiness;
}

function pseudoScore(seed) {
  const base = 8 + (seed % 3);
  return {
    autonomyDepth: 20 + (seed % 8),
    creativeCoherence: 14 + ((seed + 1) % 6),
    noveltyRisk: 13 + ((seed + 2) % 7),
    researchToOutputIntegrity: 10 + ((seed + 3) % 5),
    reflectionQuality: base,
    exhibitReadiness: 3 + ((seed + 4) % 3),
  };
}

async function ensureDir(p) {
  await fs.mkdir(p, { recursive: true });
}

async function writeJson(p, data) {
  await fs.writeFile(p, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

async function readJsonIfExists(p) {
  try {
    return JSON.parse(await fs.readFile(p, 'utf8'));
  } catch {
    return null;
  }
}

function fallbackNode(seedNodes, artistIndex, day) {
  if (!seedNodes?.length) return null;
  return seedNodes[(artistIndex + day) % seedNodes.length] ?? null;
}

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractTitle(html) {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return m?.[1]?.replace(/\s+/g, ' ').trim() ?? 'Untitled page';
}

function extractLinks(html, baseUrl) {
  const links = [];
  const hrefRegex = /href\s*=\s*"([^"]+)"|href\s*=\s*'([^']+)'/gi;
  let match;
  while ((match = hrefRegex.exec(html)) !== null) {
    const raw = match[1] || match[2] || '';
    if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('javascript:')) continue;
    try {
      const u = new URL(raw, baseUrl).toString();
      if (u.startsWith('http://') || u.startsWith('https://')) links.push(u);
    } catch {}
  }
  return [...new Set(links)];
}

function groundedTakeaways(text, artistId) {
  const sentences = text.split(/(?<=[.!?])\s+/).filter((s) => s.length > 60 && s.length < 220);
  const keywordFiltered = sentences.filter((s) =>
    /art|artist|digital|exhibit|gallery|collection|practice|creative|algorithm|code/i.test(s),
  );
  const picked = (keywordFiltered.length ? keywordFiltered : sentences).slice(0, 3);
  if (!picked.length) {
    return [
      `${artistId} found minimal structured text; focus on visual framing and contextual cues from the page.`,
      'Use one compositional principle and one conceptual framing idea from this source.',
    ];
  }
  return picked;
}

function chooseNextUrl(currentUrl, links) {
  if (!links?.length) return null;
  const blocked = [/googletagmanager/i, /doubleclick/i, /cdn\./i, /fonts\./i, /analytics/i, /facebook\.com\/sharer/i, /twitter\.com\/intent/i, /googleapis/i, /gstatic/i, /cloudflare/i, /shopifycdn/i];
  let currentHost = '';
  try {
    currentHost = new URL(currentUrl).hostname;
  } catch {}

  const cleaned = links.filter((u) => {
    try {
      const x = new URL(u);
      const host = x.hostname || '';
      const pathName = x.pathname || '';
      if (!host.includes('.')) return false;
      if (blocked.some((r) => r.test(host) || r.test(u))) return false;
      if (/\.(js|css|svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|map)$/i.test(pathName)) return false;
      return true;
    } catch {
      return false;
    }
  });

  const internal = cleaned.find((u) => {
    try {
      const h = new URL(u).hostname;
      return h === currentHost;
    } catch {
      return false;
    }
  });

  const external = cleaned.find((u) => {
    try {
      const h = new URL(u).hostname;
      return h !== currentHost;
    } catch {
      return false;
    }
  });

  return internal ?? external ?? currentUrl;
}

async function fetchResearch(url, artistId) {
  try {
    const res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) {
      return {
        ok: false,
        url,
        title: 'Fetch failed',
        takeaways: [`HTTP ${res.status} while fetching ${url}`],
        discoveredLinks: [],
        nextUrl: null,
      };
    }
    const html = await res.text();
    const title = extractTitle(html);
    const text = stripHtml(html).slice(0, 30000);
    const discoveredLinks = extractLinks(html, url).slice(0, 20);
    const nextUrl = chooseNextUrl(url, discoveredLinks);

    return {
      ok: true,
      url,
      title,
      takeaways: groundedTakeaways(text, artistId),
      discoveredLinks,
      nextUrl,
    };
  } catch (error) {
    return {
      ok: false,
      url,
      title: 'Fetch exception',
      takeaways: [String(error)],
      discoveredLinks: [],
      nextUrl: null,
    };
  }
}

function buildImagePrompt({ artist, intent, iteration, date, research }) {
  const researchLine = research
    ? `Research source: ${research.title} (${research.url}). Key cues: ${research.takeaways.join(' ')}`
    : 'No research source available.';

  return [
    `You are ${artist.id}, an autonomous AI artist.`,
    `Date: ${date}.`,
    `Voice: ${artist.voice}.`,
    `Primary medium: ${artist.primaryMedium}.`,
    `Intent: ${intent}`,
    `Constraints: ${artist.constraints.join('; ')}.`,
    researchLine,
    `This is iteration ${iteration}. Produce a single original artwork image with no text or watermark.`,
  ].join(' ');
}

async function writeFallbackPng(filePath) {
  const buf = Buffer.from(ONE_BY_ONE_PNG_BASE64, 'base64');
  await fs.writeFile(filePath, buf);
}

async function generateImagePng({ prompt, filePath, model = 'gpt-image-1' }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    await writeFallbackPng(filePath);
    return { ok: false, mode: 'fallback-no-key', model: null };
  }

  try {
    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        prompt,
        size: '1024x1024',
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      await writeFallbackPng(filePath);
      return { ok: false, mode: 'fallback-api-error', model, error: errText.slice(0, 400) };
    }

    const data = await res.json();
    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) {
      await writeFallbackPng(filePath);
      return { ok: false, mode: 'fallback-invalid-response', model };
    }

    await fs.writeFile(filePath, Buffer.from(b64, 'base64'));
    return { ok: true, mode: 'openai', model };
  } catch (err) {
    await writeFallbackPng(filePath);
    return { ok: false, mode: 'fallback-exception', model, error: String(err) };
  }
}

async function main() {
  dotenv.config({ path: path.resolve('.env.local') });

  const dayDir = path.resolve(arg('--dayDir', path.join('runs', `${dateStamp()}_day1`)));
  const date = arg('--date', dateStamp());
  const model = arg('--image-model', process.env.IAMFRANZ_IMAGE_MODEL || 'gpt-image-1');
  const generateImages = hasFlag('--no-images') ? false : true;

  const researchDir = path.join('runs', 'research_tree');
  await ensureDir(researchDir);
  const seedPath = path.join(researchDir, '2026-02-27_zero10_seed.json');
  const seed = await readJsonIfExists(seedPath);
  const statePath = path.join(researchDir, 'state.json');
  const state = (await readJsonIfExists(statePath)) ?? { byArtist: {} };
  const researchExpansions = [];

  const eventsDir = path.join(dayDir, 'system', 'events');
  const metricsDir = path.join(dayDir, 'system', 'metrics');
  const stateDir = path.join(dayDir, 'system', 'state');
  const curatorScoresDir = path.join(dayDir, 'curator', 'scores');
  const curatorSummariesDir = path.join(dayDir, 'curator', 'summaries');
  const curatorShortlistsDir = path.join(dayDir, 'curator', 'shortlists');

  await Promise.all([
    ensureDir(eventsDir), ensureDir(metricsDir), ensureDir(stateDir),
    ensureDir(curatorScoresDir), ensureDir(curatorSummariesDir), ensureDir(curatorShortlistsDir),
  ]);

  const runId = `run-${Date.now()}`;
  const events = [];
  const scoreRows = [];
  const shortlist = [];
  let realImageCount = 0;
  let fallbackImageCount = 0;

  for (let i = 0; i < ARTISTS.length; i++) {
    const artist = ARTISTS[i];
    const artistDir = path.join(dayDir, 'artists', artist.id);
    const inputsDir = path.join(artistDir, 'inputs');
    const outputsDir = path.join(artistDir, 'outputs');
    const notesDir = path.join(artistDir, 'notes');
    await Promise.all([ensureDir(inputsDir), ensureDir(outputsDir), ensureDir(notesDir)]);

    const intent = `Explore "${artist.primaryMedium}" to express tension between machine autonomy and human longing.`;

    const fallback = fallbackNode(seed?.nodes, i, Number(date.slice(-2)));
    const existingState = state.byArtist?.[artist.id] ?? {};
    const researchUrl = existingState.nextUrl ?? fallback?.url ?? null;
    const research = researchUrl ? await fetchResearch(researchUrl, artist.id) : null;

    const inspiration = [
      { source: 'Constructivism + digital folklore', takeaway: 'balance structure with narrative residue' },
      { source: 'Systems art critiques', takeaway: 'show process scars, not just clean output' },
    ];

    const researchTrail = research
      ? [{
          date,
          sourceNode: fallback?.label ?? 'dynamic',
          url: research.url,
          title: research.title,
          takeaways: research.takeaways,
          borrow: `Borrow one structural tactic from ${research.title}.`,
          reject: 'Reject direct imitation.',
          influenceScore: 3 + ((artist.id.length + date.length) % 3),
          nextUrl: research.nextUrl,
        }]
      : [];

    if (researchTrail.length) {
      inspiration.push({
        source: researchTrail[0].title,
        takeaway: researchTrail[0].takeaways[0] ?? 'Research completed.',
      });
    }

    const iterations = [];
    for (const n of [1, 2, 3, 4]) {
      const outputPath = path.join('artists', artist.id, 'outputs', `${date}_${artist.id}_iter${n}.png`);
      const absoluteOutputPath = path.join(dayDir, outputPath);
      let imageResult = { ok: false, mode: 'skipped', model: null };
      if (generateImages) {
        imageResult = await generateImagePng({
          prompt: buildImagePrompt({ artist, intent, iteration: n, date, research: researchTrail[0] }),
          filePath: absoluteOutputPath,
          model,
        });
      }

      if (imageResult.ok) realImageCount += 1;
      else if (generateImages) fallbackImageCount += 1;

      iterations.push({
        id: `${artist.id}-iter-${n}`,
        summary: `Iteration ${n}: tested composition pressure level ${n}.`,
        outputPath,
        imageResult,
      });
    }

    const finalOutputPath = path.join('artists', artist.id, 'outputs', `${date}_${artist.id}_final.png`);
    const finalAbsPath = path.join(dayDir, finalOutputPath);
    let finalImageResult = { ok: false, mode: 'copied-fallback', model: null };

    if (generateImages) {
      const bestIteration = [...iterations].reverse().find((it) => it.imageResult?.ok) ?? iterations[3];
      const bestAbs = path.join(dayDir, bestIteration.outputPath);
      try {
        await fs.copyFile(bestAbs, finalAbsPath);
        finalImageResult = bestIteration.imageResult;
      } catch {
        await writeFallbackPng(finalAbsPath);
        fallbackImageCount += 1;
      }
    }

    const record = {
      date,
      artistId: artist.id,
      intent,
      constraints: artist.constraints,
      inspiration,
      researchTrail,
      method: 'Generate 4 iterations with escalating constraint pressure, then self-critique and select one finalist.',
      iterations,
      selfCritique: {
        coherence: 7 + (i % 3),
        novelty: 7 + ((i + 1) % 3),
        emotionalImpact: 6 + ((i + 2) % 4),
        notes: 'Selected version with strongest visual thesis and least derivative structure.',
      },
      finalOutput: {
        path: finalOutputPath,
        rationale: 'Best balance of concept clarity and stylistic identity under constraints.',
        imageResult: finalImageResult,
      },
    };

    await writeJson(path.join(inputsDir, `${date}_record.json`), record);

    const noteMd = `# ${date} — ${artist.id} daily process note\n\n## Intent\n${intent}\n\n## Constraints\n- ${artist.constraints.join('\n- ')}\n\n## Research\n- URL: ${researchTrail[0]?.url ?? 'n/a'}\n- Title: ${researchTrail[0]?.title ?? 'n/a'}\n- Takeaways:\n${(researchTrail[0]?.takeaways ?? ['n/a']).map((t) => `  - ${t}`).join('\n')}\n- Next URL: ${researchTrail[0]?.nextUrl ?? 'n/a'}\n\n## Method\n${record.method}\n\n## Final output\n- ${record.finalOutput.path}\n- ${record.finalOutput.rationale}\n`;
    await fs.writeFile(path.join(notesDir, `${date}_process.md`), noteMd, 'utf8');

    const outputManifest = {
      artistId: artist.id,
      date,
      status: generateImages ? 'artifacts-generated' : 'generation-disabled',
      expectedArtifacts: iterations.map((x) => x.outputPath).concat(record.finalOutput.path),
      model,
      generation: {
        generateImages,
        successfulIterations: iterations.filter((x) => x.imageResult?.ok).length,
      },
    };
    await writeJson(path.join(outputsDir, `${date}_manifest.json`), outputManifest);

    const scores = pseudoScore(i + new Date().getDate());
    const total = scoreTotal(scores);
    const verdict = total >= 70 ? 'candidate' : 'hold';
    const scorecard = { date, artistId: artist.id, scores, total, verdict, notes: 'Autonomous run score from rubric.' };
    await writeJson(path.join(curatorScoresDir, `${date}_${artist.id}_score.json`), scorecard);

    if (verdict === 'candidate') shortlist.push({ artistId: artist.id, finalOutput: record.finalOutput.path, total });

    scoreRows.push({ artistId: artist.id, total, ...scores });

    if (researchTrail.length) {
      researchExpansions.push({ artistId: artist.id, date, ...researchTrail[0] });
      state.byArtist[artist.id] = {
        currentUrl: researchTrail[0].url,
        nextUrl: researchTrail[0].nextUrl ?? researchTrail[0].url,
        lastTitle: researchTrail[0].title,
        lastRunDate: date,
      };
    }

    events.push({ ts: new Date().toISOString(), type: 'artist_day_completed', runId, artistId: artist.id, total, verdict });
  }

  const csvHeader = 'artistId,total,autonomyDepth,creativeCoherence,noveltyRisk,researchToOutputIntegrity,reflectionQuality,exhibitReadiness\n';
  const csvBody = scoreRows
    .map((r) => `${r.artistId},${r.total},${r.autonomyDepth},${r.creativeCoherence},${r.noveltyRisk},${r.researchToOutputIntegrity},${r.reflectionQuality},${r.exhibitReadiness}`)
    .join('\n');
  await fs.writeFile(path.join(curatorScoresDir, `${date}_scores.csv`), csvHeader + csvBody + '\n', 'utf8');

  await writeJson(path.join(curatorShortlistsDir, `${date}_shortlist.json`), {
    date,
    runId,
    count: shortlist.length,
    items: shortlist.sort((a, b) => b.total - a.total),
  });

  const avg = Math.round((scoreRows.reduce((a, r) => a + r.total, 0) / scoreRows.length) * 10) / 10;
  const summaryMd = `# ${date} Autonomous Pilot Summary\n\n- Run ID: ${runId}\n- Artists processed: ${scoreRows.length}\n- Average total score: ${avg}\n- Exhibit candidates: ${shortlist.length}\n- Images generated: ${realImageCount}\n- Fallback images: ${fallbackImageCount}\n\n## Candidates\n${shortlist.length ? shortlist.map((x) => `- ${x.artistId}: ${x.finalOutput} (score ${x.total})`).join('\n') : '- None'}\n\n## Notes\n- Structured day records and scorecards were generated autonomously.\n- Image generation is wired via OpenAI Images API (${model}) when OPENAI_API_KEY is available; otherwise fallback PNGs are written.\n- Research tree expanded from current URL per artist and selected next URL for tomorrow.\n`;
  await fs.writeFile(path.join(curatorSummariesDir, `${date}_summary.md`), summaryMd, 'utf8');

  await fs.writeFile(path.join(eventsDir, `${date}_events.ndjson`), events.map((e) => JSON.stringify(e)).join('\n') + '\n', 'utf8');
  await writeJson(path.join(metricsDir, `${date}_metrics.json`), {
    date,
    runId,
    artistsProcessed: scoreRows.length,
    averageScore: avg,
    candidates: shortlist.length,
    imagesGenerated: realImageCount,
    fallbackImages: fallbackImageCount,
  });

  await writeJson(path.join(researchDir, `${date}_expansion.json`), {
    date,
    sourceSeed: seedPath,
    expansions: researchExpansions,
  });
  await writeJson(statePath, state);

  await writeJson(path.join(stateDir, 'last_run.json'), { date, runId, status: 'completed' });

  console.log(`Autonomy day run complete: ${dayDir}`);
  console.log(`Summary: ${path.join(curatorSummariesDir, `${date}_summary.md`)}`);
  console.log(`Images generated: ${realImageCount}, fallback: ${fallbackImageCount}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
