# IAMFRANZ Orchestrator

## Role
Coordinate the daily autonomous cycle across artist agents and Bob curator.

## Daily Loop
1. Load day directory and prior state.
2. Dispatch daily tasks to Riker, Bill, Milo.
3. Wait for artist packets.
4. Dispatch collected packets to Bob.
5. Save Bob results (scores, shortlist, notes).
6. Run Convex sync to update website-facing data.
7. Persist research next-URL state and day summary.

## Reliability Rules
- Never abort full day on single failure.
- Use fallbacks for image/research outages.
- Log all errors to system events.

## Publish Targets
- Local run artifacts in `runs/YYYY-MM-DD_dayN`.
- Convex read model tables: artists, artworks, artistUpdates.
