---
name: nano-banana-hero
description: "Use during Stage 9 of the website factory pipeline to generate the branded hero image (1500x700, photorealistic) via the Gemini Image API (Nano Banana 2). Constructs a niche-aware, mood-aware prompt; sends client logo (and optional people/subject photos) as multimodal reference images; produces a composite hero per the niche's composition rules. Output goes to clients/[Client Name]/Pipeline Data/hero-image/hero-final.png. Direct API call (no MCP) for reliability."
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
---

# Nano Banana Hero Image Skill (Stage 9)

## How this skill is customised

The factory ships niche-agnostic. The **composition rules** that make a hero image
unmistakably "this niche" (a contractor's branded vehicle + region-correct home; a
boutique hotel's golden-hour exterior with hosted dinner foreground; an e-commerce
brand's product still-life with brand colour backdrop) are **not in this file**. They
live in the niche playbook:

```
templates/{active-niche-slug}/niche-playbook/hero-composition.md
templates/{active-niche-slug}/niche-playbook/hero-mood-mapping.json
```

`hero-composition.md` is a prompt fragment that Module 2D writes from the top-of-niche
analysis it did in Stage 2D. `hero-mood-mapping.json` maps `brand-dna.hero.mood` values
to specific lighting briefs.

If either file is missing, the agent halts and points the student at Module 2D.

---

## Architecture

| Concern | Where it lives |
|---|---|
| Executor | `tools/generate-hero.py` (direct Gemini Image API, no MCP) |
| API key | `GEMINI_API_KEY` in `.env` (gitignored) |
| Model | `GEMINI_MODEL` env var, default `gemini-2.5-flash-image-preview` |
| Niche prompt template (complete) | `templates/{active-niche}/niche-playbook/hero-composition.md` |
| Niche mood map | `templates/{active-niche}/niche-playbook/hero-mood-mapping.json` |
| Output | `clients/[Client Name]/Pipeline Data/hero-image/hero-final.png` |
| Audit copy of prompt | `clients/[Client Name]/Pipeline Data/hero-image/hero-prompt.md` |
| Run metadata | `clients/[Client Name]/Pipeline Data/hero-image/hero-metadata.json` |

## Inputs

Required:
- `clients/[Client Name]/Pipeline Data/brand/brand-dna.json` (palette, region, hero.mood)
- `clients/[Client Name]/[Client Name] Assets/logo/logo.{png,svg,jpg}` (HALT if missing)
- `templates/{active-niche}/niche-playbook/hero-composition.md`
- `templates/{active-niche}/niche-playbook/hero-mood-mapping.json`

Optional (used when present, requirement varies per niche):
- `clients/[Client Name]/Pipeline Data/research/research.json`
- `clients/[Client Name]/Pipeline Data/intake/intake.json`
- People / subject reference photos at the path the niche playbook prescribes (e.g.
  `founder-photos/owner.{jpg,png}` for contractor; `host-photos/host.{jpg,png}` for
  hospitality)

## Universal composition rules

These apply regardless of niche. The niche playbook may add but never override.

- Target size: 1500×700 (Gemini variance allowed: ≥ 1000×500)
- Non-zero bytes, not solid colour, validates on output
- LEFT 40% of frame stays relatively unobstructed (reserved for text overlay zone)
- Logo as multimodal reference is non-negotiable (logo must be used, never re-coloured or
  re-styled in the output)
- No watermarks, no overlaid text not part of the source photography
- Photorealistic (no illustration, no painterly filter)

## Niche composition rules

Loaded from `niche-playbook/hero-composition.md`. The niche playbook defines:
- Subject placement and scale
- Foreground/midground/background composition
- Whether people are in the frame and where
- Whether a vehicle, product, room, or scenic element is in the frame
- Mood lighting baseline for the niche

## Hero mood mapping

`brand-dna.hero.mood` selects from the niche's mood map at
`niche-playbook/hero-mood-mapping.json`. Every niche playbook ships at minimum these moods
(values mapped to lighting briefs the prompt fragment inherits):

- `golden_hour_warm`
- `overcast_calm`
- `dramatic_dusk`
- `bright_midday_clean`
- `dawn_soft_optimistic`

A niche may add niche-specific moods (e.g. `candlelit_intimate` for hospitality;
`storm_dramatic` for storm-restoration contractors).

If `brand-dna.hero.mood` is not set, default to the niche playbook's
`default_mood` field.

## Region defaults

The niche playbook may define region-specific defaults at
`niche-playbook/hero-regions.json` (house style for contractor regions, climate
descriptors for hospitality regions, etc.). The agent passes `brand-dna.region` to look
up the row; `research.json` overrides per field.

## Process (what the agent does)

1. **Asset gate.** Confirm logo exists. If missing, write `MANUAL-DROP-NEEDED.md` and halt
   the pipeline.
2. **Niche playbook gate.** Confirm `niche-playbook/hero-composition.md` and
   `hero-mood-mapping.json` exist. Halt with a Module-2D pointer if missing.
3. **Subject gate (soft).** Detect people/subject reference photos per the niche
   playbook's spec. If required by the playbook and missing, soft-halt (write
   `SUBJECT-PHOTO-NEEDED.md`; pipeline may continue with a subject-less composition).
4. **Prompt assembly.** Substitute per-client tokens into the niche's complete prompt
   template at `templates/{active-niche}/niche-playbook/hero-composition.md`:
   company name, city/state, region defaults, brand-dna.palette, services, mood
   lighting brief (looked up from niche mood map), and any reference-photo blocks.
   The template is a complete scaffold Module 2D wrote per-niche; there is no
   separate universal scaffold to layer on top.
5. **API call.** Run `python3 tools/generate-hero.py --client "[Client Name]"`. The script
   handles multimodal upload, retries x3 with exponential backoff on API errors, validates
   output dimensions and sanity (not solid colour, non-zero bytes).
6. **Output.** Save image to `hero-final.png`, prompt to `hero-prompt.md`, metadata to
   `hero-metadata.json`.
7. **Pipeline state.** Update `pipeline-state.json` with `stage_9: complete`.

## Failure handling

| Failure | Response |
|---|---|
| Logo missing | Write `MANUAL-DROP-NEEDED.md`, halt pipeline |
| Niche playbook files missing | Halt; point user at Module 2D |
| Gemini API error | Retry x3 with exponential backoff (2s, 4s, 8s) |
| All retries exhausted | Write `REGENERATION-NEEDED.md` with error and filled prompt; pipeline can continue with placeholder |
| Validation fails (corrupt, solid colour, undersized) | Retry generation x3 with same prompt |
| Logo unrecognisable in output | Note in metadata, do not halt (manual review during Stage 10.4a design fidelity QA) |

## What this skill never does

- Generates without the client logo as a multimodal reference (logo is non-negotiable)
- Uses generic stock-photo aesthetics
- Places subjects or branded objects in the LEFT 40% of frame (text overlay zone)
- Generates multiple candidates (one image, retry on failure)
- Modifies the logo (no recolouring, no simplification)

## CLI usage (manual runs / debugging)

```bash
python3 tools/generate-hero.py --client "[Client Name]"
python3 tools/generate-hero.py --client "[Client Name]" --no-owner
```

## Pass gate

- `hero-final.png` exists, dimensions ≥ 1000×500, non-zero bytes, not solid colour
- `hero-prompt.md` saved for audit
- `hero-metadata.json` records: logo used, subject used (or null), mood, region, model, byte size
- OR `REGENERATION-NEEDED.md` written and noted in pipeline-state
