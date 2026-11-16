/**
 * A small, searchable record of every artwork, kept beside the `artworks`
 * table for "Chat with the Artist".
 *
 * Why a second table: artwork documents can be close to 1MB each (older ones
 * carry a whole inspiration log), so the chat can't scan or search them
 * directly. A digest row is a few KB — title, date and the text worth
 * searching — which makes "list everything from June" or "find the piece
 * about rivers" cheap. Rows are kept current by the artwork mutations in
 * artworks.ts, so the studio sync needs no changes.
 */
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

export function clip(text: string | undefined, max: number): string | undefined {
  const t = text?.trim();
  if (!t) return undefined;
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t;
}

/**
 * Older records hold the whole running inspiration log rather than one entry
 * (see syncFromIamfranz2.mjs); the entry for the piece is the last section.
 */
export function lastSection(text: string | undefined): string | undefined {
  if (!text) return undefined;
  const sections = text.split(/^## Iteration /m).filter((s) => s.trim());
  if (sections.length < 2) return text;
  return `## Iteration ${sections[sections.length - 1]}`;
}

export function titleDate(title: string): string | null {
  return title.match(/^(\d{4}-\d{2}-\d{2})\s+—/)?.[1] ?? null;
}

export function displayTitle(a: Doc<"artworks">): string {
  return a.pieceTitle ?? a.title;
}

/** The artist's own number for the piece ("No. 254 — Internode"), if it has one. */
function workNumber(title: string): number | undefined {
  const match = title.match(/\bNo\.\s*(\d{1,5})\b/);
  return match ? Number(match[1]) : undefined;
}

function buildDigest(a: Doc<"artworks">) {
  const title = displayTitle(a);
  const sortOrder = a.sortOrder ?? a._creationTime;
  const text = [
    title,
    clip(a.statement, 1500),
    clip(a.artistThinking, 600),
    clip(lastSection(a.inspirationEntry), 2500),
    clip(lastSection(a.evolutionEntry), 900),
    clip(a.description, 700),
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    artworkId: a._id,
    title,
    number: workNumber(title),
    date: titleDate(a.title) ?? new Date(sortOrder).toISOString().slice(0, 10),
    sortOrder,
    text,
  };
}

/** Create or refresh the digest row for one artwork. */
export async function upsertDigest(
  ctx: MutationCtx,
  artworkId: Id<"artworks">,
  // The backfill refreshes the overview once at the end instead of per piece.
  { skipOverview = false }: { skipOverview?: boolean } = {},
) {
  const artwork = await ctx.db.get(artworkId);
  if (!artwork) return;

  const digest = buildDigest(artwork);
  const existing = await ctx.db
    .query("artworkDigests")
    .withIndex("by_artwork", (q) => q.eq("artworkId", artworkId))
    .first();

  if (existing) {
    await ctx.db.replace(existing._id, digest);
    if (!skipOverview && (existing.title !== digest.title || existing.date !== digest.date)) {
      await refreshOverview(ctx);
    }
  } else {
    await ctx.db.insert("artworkDigests", digest);
    if (!skipOverview) await refreshOverview(ctx);
  }
}

export async function removeDigest(ctx: MutationCtx, artworkId: Id<"artworks">) {
  const existing = await ctx.db
    .query("artworkDigests")
    .withIndex("by_artwork", (q) => q.eq("artworkId", artworkId))
    .first();
  if (existing) {
    await ctx.db.delete(existing._id);
    await refreshOverview(ctx);
  }
}

/**
 * A few always-true facts about the whole body of work (how many pieces,
 * first, newest, how many per month), stored so every chat reply can include
 * them without scanning the table.
 */
export async function refreshOverview(ctx: MutationCtx) {
  const all = await ctx.db.query("artworkDigests").withIndex("by_sort_order").collect();

  let value = "No pieces yet.";
  if (all.length) {
    const first = all[0];
    const newest = all[all.length - 1];
    const perMonth = new Map<string, number>();
    for (const d of all) {
      const month = d.date.slice(0, 7);
      perMonth.set(month, (perMonth.get(month) ?? 0) + 1);
    }
    const numbers = all.map((d) => d.number).filter((n): n is number => n !== undefined);

    value = [
      `Pieces in the archive: ${all.length}.`,
      `First piece: "${clip(first.title, 160)}", ${first.date}.`,
      `Newest piece: "${clip(newest.title, 160)}", ${newest.date}.`,
      numbers.length
        ? `${numbers.length} of them carry a number in the title, from No. ${Math.min(...numbers)} to No. ${Math.max(...numbers)}; the rest (mostly the earliest) have no number.`
        : "",
      `Pieces per month: ${[...perMonth].map(([m, n]) => `${m}: ${n}`).join(", ")}.`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  const existing = await ctx.db
    .query("artistContext")
    .withIndex("by_key", (q) => q.eq("key", "catalogOverview"))
    .first();
  if (existing) await ctx.db.patch(existing._id, { value });
  else await ctx.db.insert("artistContext", { key: "catalogOverview", value });
}
