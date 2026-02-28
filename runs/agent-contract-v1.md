# IAMFRANZ Agent Contract v1

Date: 2026-02-27
Status: Active draft for next-day execution

## 1) System roles

### Orchestrator (unnamed)
- Starts daily cycle
- Dispatches prompts to artist agents (Riker, Bill, Milo)
- Collects structured outputs + files
- Dispatches all artist outputs to Curator (Bob)
- Applies Bob's decisions (shortlist, exhibit picks)
- Syncs website-facing read model to Convex

### Curator: Bob
- Receives all artist packets for the day
- Scores each artist output with fixed rubric
- Selects exhibit candidates
- Writes daily curatorial note (public + internal)

### Artists
- **Riker**
- **Bill**
- **Milo**

Each artist runs autonomously, with persistent identity memory and evolving research state.

---

## 2) Daily autonomous flow

1. **Seed load**
   - Read prior state + research tree + artist memory
2. **Artist phase (parallel)**
   - Think/intent
   - Research URL fetch + grounded takeaways
   - Choose next research URL for tomorrow
   - Generate artwork iterations + final
   - Self-critique + evolution update
3. **Curator phase (Bob)**
   - Score each artist
   - Choose shortlist/exhibit candidates
   - Emit rationale and tomorrow guidance
4. **Publish phase**
   - Save run artifacts in `runs/YYYY-MM-DD_dayN/...`
   - Sync read-model into Convex (`artists`, `artworks`, `artistUpdates`)
5. **State update**
   - Persist per-artist next URL and identity deltas

---

## 3) Artist identities (v1)

### Riker
- Voice: bold, cinematic, emotionally charged
- Bias: dramatic composition, high contrast, symbolic motifs
- Growth axis: emotional specificity + narrative coherence

### Bill
- Voice: precise, architectural, systems-driven
- Bias: minimal geometry, rule-based composition, restraint
- Growth axis: conceptual depth under strict constraints

### Milo
- Voice: exploratory, glitch-poetic, uncanny documentary
- Bias: artifact textures, noise memory, found-structure collage
- Growth axis: balancing experimentation with readability

---

## 4) Curator Bob rubric (100 points)

- Autonomy depth: 30
- Creative coherence: 20
- Novelty/risk: 20
- Research-to-output integrity: 15
- Reflection quality: 10
- Exhibit readiness: 5

Selection defaults:
- Candidate if >= 70
- Priority shortlist by top total score + diversity across styles

---

## 5) Required per-artist daily output

Each artist must produce:
- `inputs/YYYY-MM-DD_record.json`
- `notes/YYYY-MM-DD_process.md`
- `outputs/YYYY-MM-DD_<artist>_iter{1..4}.png`
- `outputs/YYYY-MM-DD_<artist>_final.png`

`record.json` minimum fields:
- `date`
- `artistId`
- `intent`
- `constraints[]`
- `researchTrail[]` with:
  - `url`, `title`, `takeaways[]`, `nextUrl`
- `inspiration[]`
- `iterations[]`
- `selfCritique`
- `finalOutput`

---

## 6) Website-facing Convex read model (pruned)

Keep only:
- `artists` (profile + evolving identity snapshot)
- `artworks` (final outputs that are shown)
- `artistUpdates` (daily evolution write-up)
- `exhibits` (optional next phase)

Everything else should be considered non-essential for public display and may be archived/removed after migration.

---

## 7) Operational guardrails

- Fully autonomous by default
- Human override always available
- On external fetch failure: degrade gracefully, log error, continue run
- On image failure: fallback image allowed, never abort full day pipeline

---

## 8) Execution plan (next)

1. Spawn persistent sub-agents:
   - `iamfranz-riker`
   - `iamfranz-bill`
   - `iamfranz-milo`
   - `iamfranz-bob`
2. Move current monolithic runner to orchestrator script that delegates work to these agents.
3. Preserve existing `runs/` + Convex sync as output contracts.
4. Prune Convex schema once agent pipeline is stable for 2-3 days.
