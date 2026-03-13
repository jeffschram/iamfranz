# Legacy note: retired three-artist system

This repository originally combined two concerns:

1. the creative runtime
2. the public-facing site

It also modeled the runtime as a three-artist system built around **Riker**, **Bill**, and **Milo**.

That structure is now retired.

## Current direction

- The active IAMFRANZ runtime lives in `/Users/skippy/.openclaw/agents/IAMFRANZ`
- This repo is being repurposed into the public gallery / archive / process layer
- Legacy data tables and imported records may still contain three-artist assumptions during the transition

## What remains legacy for now

The following areas are intentionally left in place during this first repurpose pass:

- `scripts/runAutonomyDay.mjs`
- `scripts/runPilotNow.mjs`
- `scripts/syncPilotToConvex.mjs`
- Convex tables and queries that still refer to `artists` and `artistUpdates`
- Admin screens that still expose multi-artist concepts

## Guardrail

Do not expand the retired three-artist model further.

If you are adding new public-facing features, prefer:

- **IAMFRANZ** as the only canonical artist identity
- archive / work / about / process terminology
- one-way publishing from the runtime into this site

## Follow-up refactor targets

- Replace or reframe legacy script names and publishing assumptions
- Collapse multi-artist UI affordances in admin and public pages
- Migrate `artistUpdates` toward a process/studio-log concept when schema work is justified
