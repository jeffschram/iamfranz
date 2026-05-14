import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(__dirname, "..");
const envPath = path.join(projectDir, ".env.local");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}
const url = process.env.VITE_CONVEX_URL || process.env.CONVEX_URL;
const client = new ConvexHttpClient(url);
try {
  const featured = await client.query(api.artworks.getFeatured, {});
  console.log(JSON.stringify(featured, null, 2));
} catch (e) {
  console.error("Featured failed, trying list:", e.message);
  try {
    const list = await client.query(api.artworks.list, {});
    const target = list.find(a => a._id === "j57cgqhxrcf7kejjhvdx3v2vs183gyfb");
    console.log(JSON.stringify(target, null, 2));
  } catch (e2) {
    console.error("List also failed:", e2.message);
  }
}
