# Publishable Artifact Contract

This repo ingests **selected** IAMFRANZ outputs from the canonical agent workspace and publishes them into the public site / Convex backend.

## Direction of travel

Publishing is one-way:

`IAMFRANZ agent workspace -> importer -> Convex -> public site`

The public site is not the artist runtime.

## Artifact bundle shape

A publishable artifact should live in its own directory and contain at minimum:

```text
artifact-dir/
  metadata.json
  image.png            # or .jpg / .jpeg / .webp
  prompt.md            # optional but recommended
  process.md           # optional; can also be reaction.md / notes.md
```

## Required file

### `metadata.json`

Required minimum fields:

```json
{
  "schemaVersion": 1,
  "title": "The Prepared Room",
  "description": "A short public description of the work.",
  "image": "image.png"
}
```

## Recommended metadata shape

```json
{
  "schemaVersion": 1,
  "title": "The Prepared Room",
  "pieceTitle": "The Prepared Room",
  "description": "A short public description of the work.",
  "image": "image.png",
  "promptFile": "prompt.md",
  "processNoteFile": "process.md",
  "createdAt": "2026-03-13",
  "publishedAt": "2026-03-13",
  "year": 2026,
  "medium": "Digital image",
  "dimensions": "1024x1024",
  "featured": false,
  "isAvailable": false,
  "runId": "2026-03-13_13-22-00",
  "series": "First Exploratory Set",
  "tags": ["study", "interior", "constructed-selfhood"],
  "sourcePath": "/Users/skippy/.openclaw/agents/IAMFRANZ/...",
  "research": {
    "title": "Optional source title",
    "url": "https://example.com"
  },
  "learning": {
    "technique": "Optional technique note",
    "concept": "Optional concept note",
    "visual": "Optional visual note"
  },
  "artistUpdate": {
    "date": "2026-03-13",
    "summary": "Optional public process/update summary",
    "interests": ["interior atmosphere"],
    "inspiration": ["ritualized composition"],
    "score": 7.4
  }
}
```

## Importer behavior

The first importer version:
- ensures there is a canonical `IAMFRANZ` artist row
- uploads the image to Convex storage
- creates or updates an artwork row
- optionally upserts an `artistUpdates` entry when `artistUpdate` is provided

## Mapping to current Convex schema

Because the current schema is transitional, the importer maps fields pragmatically:

- `title` -> `artworks.title`
- `pieceTitle` -> `artworks.pieceTitle`
- `description` -> `artworks.description`
- `promptFile` contents -> `artworks.prompt`
- `processNoteFile` contents -> `artworks.artistThinking`
- `research.title/url` -> `artworks.researchSourceTitle` / `artworks.researchSourceUrl`
- `learning.technique/concept/visual` -> `artworks.learningTechnique` / `learningConcept` / `learningVisual`
- `medium`, `year`, `dimensions`, `featured`, `isAvailable` -> same-named current fields

## Caveats

- `slug`, `series`, `tags`, and `sourcePath` are not yet first-class Convex fields in the current schema. Keep them in `metadata.json` for future migrations.
- The importer uses artwork title as the current upsert identity unless a better schema is introduced later.
- Not every study should be imported. This contract is for **selected/publishable** artifacts.
