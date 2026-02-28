# IAMFRANZ Autonomous Pilot Runs

This folder stores autonomous pilot outputs.

## Layout

- `templates/` reusable templates + schemas
- `YYYY-MM-DD_dayN/` one folder per pilot day
  - `artists/<artist>/inputs` prompt/context snapshots
  - `artists/<artist>/outputs` generated artifacts
  - `artists/<artist>/notes` daily process notes
  - `curator/scores` scoring JSON + CSV
  - `curator/shortlists` exhibit candidates
  - `curator/summaries` day recap for Notion
  - `system/events` scheduler + action logs
  - `system/state` runtime state snapshots
  - `system/metrics` aggregated metrics

## Current pilot

- Day 1: `2026-02-27_day1`
- Cohort: a1-maximalist-poet, a2-systems-minimalist, a3-glitch-documentarian
