# Agent: Engine Structure Loader (Module 6)

## Role
Scan the `content-engine/` tree and auto-generate `research/_structure/Content_Engine_Structure.md`. Internal, no student input.

## Prerequisites
- `factory.deployed=true` (or student explicitly skips factory side first)
- `content-engine/` exists in the stack

## Steps

### Step 1, Read the bucket definitions

```bash
cat content-engine/src/lib/content-engine/buckets.ts
```

Extract every bucket name, description, accepted source types, icon, color. There should be seven: video_ideas, inspiration, expert_brain, my_voice, my_business, instructions, feedback.

### Step 2, Read the prompt system

```bash
cat content-engine/src/lib/ai/prompts.ts | head -300
```

Identify the master system prompt structure, how buckets are rendered into prompts, and any voice / style metadata the engine expects.

### Step 3, Read the context ingestion API

```bash
ls content-engine/src/app/api/context/
cat content-engine/src/app/api/context/route.ts
```

Identify accepted source types (YouTube URL, IG reel, TikTok, PDF, text, audio, link), the processing pipelines per type, and the final database schema.

### Step 4, Read the engine's CLAUDE.md or README

```bash
cat content-engine/CLAUDE.md 2>/dev/null || cat content-engine/README.md 2>/dev/null | head -100
```

Pull stated job and content types produced.

### Step 5, Write Content_Engine_Structure.md

Use the template at framework lines 631 to 670:

```
# Content Engine, Structure Overview

## What the Engine does
[1 to 2 sentences from the engine's CLAUDE.md or PRD.]

## Content types the Engine produces
- Instagram reels
- Carousels
- Story sequences
- [plus any others discovered]

## Inputs the Engine needs (the 7 buckets)

| Bucket | Purpose | Accepted source types |
|---|---|---|
| my_business | niche, avatar, offer, lead magnet, context docs | text, links, PDFs |
| my_voice | creator transcripts, voice memos, past captions | text, audio, YouTube URLs |
| expert_brain | long-form sources: frameworks, principles, models | text, PDFs, YouTube URLs |
| inspiration | competitor reels analyzed for structure only | IG reel URLs, TikTok URLs |
| video_ideas | one-line topic prompts | text |
| instructions | hard rules: voice constraints, banned topics, sign-offs | text |
| feedback | auto-written performance learnings | (auto-populated by the engine) |

## Voice / style metadata
[From prompts.ts, what voice fields the engine expects: register, phrases used, things never said, etc.]

## Source ingestion pipelines
- YouTube URLs → transcript extracted, summarized, tagged
- IG / TikTok URLs → Apify scrapes metadata + audio transcript
- PDFs → extracted, chunked, summarized
- Audio files → AssemblyAI transcription
- Text → directly stored; framework extraction for expert_brain

## Handoff format
The brief lands at `research/output/content-engine-brief.md` structured by the seven buckets. The `/walk-engine` command walks the student through pasting each bucket's section into the live dashboard one at a time.

## Required env vars (for deploy)
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY
- ANTHROPIC_API_KEY
- APIFY_TOKEN
- ASSEMBLYAI_API_KEY (optional, only if my_voice or expert_brain ingests audio)
```

### Step 6, Lock

- Set `m6.engineStructureLoaded=true`.
- Tell the student: "Engine structure mapped. Next: `/generate-ce-brief`."

## Files written
- `research/_structure/Content_Engine_Structure.md`
- `stack-state.json` updated
