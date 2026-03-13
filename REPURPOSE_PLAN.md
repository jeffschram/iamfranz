# IAMFRANZ Repo Repurpose Plan

## New mission

This repo is no longer the artist runtime.

**IAMFRANZ the agent** lives in:
- `/Users/skippy/.openclaw/agents/IAMFRANZ`

This repo now exists to be the:
- public-facing gallery
- archive of published works
- process / evolution display layer
- optional Convex-backed CMS and persistence layer
- sync target for selected IAMFRANZ outputs

## Conceptual split

### Artist brain
Owns:
- identity
- memory
- prompts
- studies
- generated artifacts
- curation decisions
- authorship

Location:
- `/Users/skippy/.openclaw/agents/IAMFRANZ`

### Public site repo
Owns:
- home / featured works
- archive browsing
- work detail pages
- about / process pages
- optional admin editing
- Convex schema, queries, storage, and sync target

Location:
- `/Users/skippy/src/iamfranz`

### Convex
Owns:
- published records
- image storage
- process entries
- site query layer

Convex is **not** the creative engine.

---

## Current repo assessment

### Keep
These are good bones for the new public site:

- `src/App.tsx`
- `src/components/Header.tsx`
- `src/pages/Gallery.tsx`
- `src/pages/ArtworkDetail.tsx`
- `convex/artworks.ts`
- Convex storage/upload patterns

### Archive
These represent the old worldview and should stop driving the project:

- `scripts/runAutonomyDay.mjs`
- `scripts/runPilotNow.mjs`
- `scripts/syncPilotToConvex.mjs`
- `src/pages/Artists.tsx`
- multi-artist / collective framing
- hardcoded three-artist assumptions (`Riker`, `Bill`, `Milo`)

### Refactor
These likely survive, but under a different meaning:

- `src/pages/ArtistDetail.tsx`
- `convex/schema.ts`
- `convex/artists.ts`
- `convex/artistUpdates.ts`
- admin/auth flow

---

## Target site information architecture

### `/`
Home / latest featured work

### `/archive`
Chronological or filterable archive of published works

### `/work/:slug`
Artwork detail page

### `/about`
What IAMFRANZ is; artist statement and framing

### `/process`
Public process notes, evolution log, and studio updates

### Optional `/series/:slug`
Series or study-set grouping page

---

## Target data model direction

### `artworks`
Keep as the core published object.

Preferred fields:
- `title`
- `slug`
- `imageId` / `imageUrl`
- `description`
- `status` (`study`, `published`, `archived`)
- `createdAt`
- `publishedAt`
- `tags`
- `series`
- `runId`
- `sequenceIndex`
- `promptExcerpt` (optional)
- `processNote` (optional)
- `sourcePath` (optional)

### `artists`
Short-term: keep exactly one canonical artist row for `IAMFRANZ`.

Long-term: this may become a `siteProfile`/`creatorProfile` model.

### `artistUpdates`
Reframe conceptually as:
- process entries
- studio log
- archive entries
- evolution notes

The table name can remain for now if that reduces migration pain.

---

## Publishing model

### Canonical direction
Publishing should be **one-way**:

`IAMFRANZ agent workspace -> sync/import -> Convex -> public site`

### Important rule
Do **not** make generation write directly to Convex.

The agent should create locally first.
Only selected artifacts should be published.

---

## Proposed artifact contract for agent outputs

Selected works should eventually be representable as something like:

```text
work-or-study/
  brief.md
  prompt.md
  image.png
  reaction.md
  metadata.json
```

At minimum, published candidates should preserve:
- intent
- exact prompt
- image
- first reaction / process note
- metadata

---

## Migration phases

### Phase 1 — Freeze the old worldview
- Stop treating this repo as the artist engine
- Stop expanding the 3-artist model
- Document the new mission

### Phase 2 — Refactor site structure
- Rework routes toward home / archive / work / about / process
- Remove or repurpose artists/collective pages
- Clean up site copy to reflect one artist: IAMFRANZ

### Phase 3 — Simplify schema usage
- Keep one canonical artist
- Simplify `artworks`
- Reframe `artistUpdates`
- Ignore schema vanity work unless it directly helps publishing

### Phase 4 — Build sync bridge
- Replace old pilot sync assumptions
- Read selected outputs from the IAMFRANZ agent workspace
- Upload to Convex
- Create/update publishable records

### Phase 5 — First public release
- Publish the first real IAMFRANZ study set or selected work
- Verify home, archive, and detail pages
- Add one public process note if useful

---

## Recommended immediate next actions

1. Update `README.md` so the repo no longer claims to be a Convex/Chef-generated gallery app without context.
2. Add a small `docs/legacy-notes.md` or archive note explaining the retired three-artist system.
3. Refactor route/page intentions before touching deep schema migrations.
4. Replace the old sync script with a new IAMFRANZ-oriented import path.
5. Fix or remove the current fake admin auth before treating the admin UI as real.

---

## Guardrails

- The site should feel curated, not like a filesystem leak with CSS.
- Not every generated study belongs in public.
- Preserve the old 3-artist era as historical material, not active architecture.
- Avoid over-engineering schema changes before the publishing path is clear.
- Keep the public site as display/archive, not artist mythology machinery.
