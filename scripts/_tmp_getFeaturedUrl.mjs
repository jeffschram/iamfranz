import { ConvexHttpClient } from 'convex/browser';
import { api } from '../convex/_generated/api.js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve('.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim();
    if (t && !t.startsWith('#')) {
      const eq = t.indexOf('=');
      if (eq > 0) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
    }
  }
}

const client = new ConvexHttpClient(process.env.VITE_CONVEX_URL);
const artworks = await client.query(api.artworks.list, {});
const featured = artworks.find(a => a.featured);
if (!featured) {
  console.error('No featured artwork');
  process.exit(1);
}
console.log(JSON.stringify({ id: featured._id, title: featured.title, imageUrl: featured.imageUrl, pieceTitle: featured.pieceTitle }));
