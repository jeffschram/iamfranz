#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config({ path: path.resolve('.env.local') });

const artifactDir = getArg('--artifactDir') || getArg('--dir');
const provider = getArg('--provider') || process.env.IAMFRANZ_IMAGE_PROVIDER || 'google';
const model = getArg('--model') || process.env.IAMFRANZ_IMAGE_MODEL || (provider === 'google' ? 'gemini-3.1-flash-image-preview' : 'gpt-image-1');
const outputName = getArg('--out') || 'image.png';
const dryRun = hasFlag('--dry-run');

if (!artifactDir) {
  console.error('Usage: node scripts/renderIamfranzBundle.mjs --artifactDir <path> [--provider openai|google] [--model <model>] [--out image.png] [--dry-run]');
  process.exit(1);
}

function getArg(name) {
  const idx = process.argv.indexOf(name);
  return idx >= 0 ? process.argv[idx + 1] : undefined;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

async function readText(filePath) {
  return await fs.readFile(filePath, 'utf8');
}

async function readJson(filePath) {
  return JSON.parse(await fs.readFile(filePath, 'utf8'));
}

async function writeBuffer(filePath, buf) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, buf);
}

async function generateImagePngOpenAI({ prompt, filePath, model = 'gpt-image-1' }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('Missing OPENAI_API_KEY for OpenAI image generation.');

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
    throw new Error(`OpenAI image generation failed (${res.status}): ${errText.slice(0, 800)}`);
  }

  const data = await res.json();
  const b64 = data?.data?.[0]?.b64_json;
  if (!b64) throw new Error('OpenAI image generation returned no b64_json payload.');

  await writeBuffer(filePath, Buffer.from(b64, 'base64'));
  return { ok: true, provider: 'openai', model, filePath };
}

async function generateImagePngGoogle({ prompt, filePath, model = 'gemini-3.1-flash-image-preview' }) {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) throw new Error('Missing GEMINI_API_KEY / GOOGLE_API_KEY for Google image generation.');

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const res = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE'] },
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Google image generation failed (${res.status}): ${errText.slice(0, 800)}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts ?? [];
  const imagePart = parts.find((p) => p?.inlineData?.data || p?.inline_data?.data);
  const b64 = imagePart?.inlineData?.data ?? imagePart?.inline_data?.data;
  if (!b64) throw new Error('Google image generation returned no inline image payload.');

  await writeBuffer(filePath, Buffer.from(b64, 'base64'));
  return { ok: true, provider: 'google', model, filePath };
}

async function main() {
  const absDir = path.resolve(artifactDir);
  const metadataPath = path.join(absDir, 'metadata.json');
  const metadata = await readJson(metadataPath);
  const promptPath = path.resolve(absDir, metadata.promptFile || 'prompt.md');
  const promptDoc = await readText(promptPath);
  const outPath = path.resolve(absDir, outputName);

  const promptMatch = promptDoc.match(/## Exact prompt\n([\s\S]*?)(\n## |$)/);
  const prompt = (promptMatch?.[1] || promptDoc).trim();
  if (!prompt) throw new Error('Could not find prompt text in prompt.md.');

  if (dryRun) {
    console.log(JSON.stringify({
      dryRun: true,
      artifactDir: absDir,
      provider,
      model,
      output: outPath,
      promptPreview: prompt.slice(0, 500),
    }, null, 2));
    return;
  }

  const result = provider === 'google'
    ? await generateImagePngGoogle({ prompt, filePath: outPath, model })
    : await generateImagePngOpenAI({ prompt, filePath: outPath, model });

  console.log(JSON.stringify({
    ok: true,
    rendered: {
      title: metadata.title,
      provider,
      model,
      output: outPath,
    },
    result,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
