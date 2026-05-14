import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';
import fs from 'node:fs';
import path from 'node:path';

function loadEnvFile(p) {
  if (!fs.existsSync(p)) return;
  const content = fs.readFileSync(p, 'utf-8');
  for (const line of content.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}
loadEnvFile('.env.local');

const url = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;
const client = new ConvexHttpClient(url);
const artworks = await client.query(api.artworks.list, {});
const latest = artworks.find(a => a._id === 'j57cgqhxrcf7kejjhvdx3v2vs183gyfb');
console.log(JSON.stringify({ title: latest?.title, imageUrl: latest?.imageUrl, imageId: latest?.imageId, _id: latest?._id }, null, 2));
