# IAMFRANZ Public Site

This repo is the **public-facing gallery, archive, and process layer** for IAMFRANZ.

The active artist runtime now lives in the OpenClaw agent workspace:
- `/Users/skippy/.openclaw/agents/IAMFRANZ`

This repo should be treated as the place for:
- featured and archived works
- public-facing work detail pages
- process / evolution notes
- optional Convex-backed publishing, storage, and admin tooling

It is **not** the artist brain or primary generation runtime.

## Current status

This codebase is in an intentional repurpose phase.

The old three-artist runtime model has been retired, but some schema, admin, and import code still reflects that history. Public-facing copy and route intent are being shifted first, with deeper schema and publishing refactors to follow.

Key reference files:
- `REPURPOSE_PLAN.md`
- `docs/legacy-three-artist-system.md`
- `docs/publishable-artifact-contract.md`

## Project structure

- `src/` — Vite/React frontend for the public site
- `convex/` — backend schema, queries, mutations, and storage logic
- `scripts/` — mostly legacy pilot/runtime sync scripts retained temporarily for reference

`npm run dev` starts the frontend and Convex backend locally.

## Routing direction

The intended public information architecture is:
- `/` or `/archive` — archive / featured works
- `/work/:id` — work detail
- `/about` — artist framing
- `/process` — process and evolution notes

Legacy `/artists` and `/artist/:id` routes are still present temporarily for historical imported data.

## Legacy scripts

The following npm scripts are retained for now but should be considered **legacy**:
- `npm run pilot:run-day`
- `npm run pilot:sync-convex`
- `npm run pilot:run-now`
- `npm run pilot:run-now:google`

They reflect the retired runtime architecture and should not be expanded as the long-term publishing path.

## New importer path

The first supported publishing bridge is:

1. Render a selected bundle into a real image file:
   - `npm run iamfranz:render-bundle -- --artifactDir <path-to-artifact-dir>`
2. Import that bundle into Convex/site:
   - `npm run iamfranz:import-artifact -- --artifactDir <path-to-artifact-dir>`
3. Or import today’s newest ready bundle automatically:
   - `npm run iamfranz:import-latest -- --date YYYY-MM-DD`

The render step reads `prompt.md` from the selected bundle and writes `image.png` into the same directory.
By default it now uses the Google image path (`gemini-3.1-flash-image-preview`) unless you override provider/model flags or env vars.
The import step uploads the image to Convex storage and creates or updates a publishable artwork record.
The `import-latest` helper finds the newest bundle for the given date that already has both `metadata.json` and an image file, then runs the importer for it.

See:
- `docs/publishable-artifact-contract.md`
- `docs/publishable-artifact-example.json`

## Auth / admin caveat

Anonymous auth and the current admin flow are still inherited from the original Chef/Convex setup. Treat admin as transitional until authentication and permissions are reworked for real publishing use.

## Convex / Chef notes

This project was bootstrapped with [Chef](https://chef.convex.dev) and uses [Convex](https://convex.dev) as its backend.

Connected deployment:
- [`reliable-terrier-796`](https://dashboard.convex.dev/d/reliable-terrier-796)

If you need deeper platform docs:
- [Convex overview](https://docs.convex.dev/understanding/)
- [Chef docs](https://docs.convex.dev/chef)
- [Hosting and deployment](https://docs.convex.dev/production/)
