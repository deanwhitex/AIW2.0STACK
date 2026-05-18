# /stage9

Invokes the hero-image-agent (`.claude/agents/08-hero-image.md`) to
generate the per-client hero images via the Gemini Nano Banana API. Both
desktop AND mobile variants are generated.

Stage order is 7 → 9 (this command) → 10.1 (template-overlay build).
Hero images live at fixed paths the website template expects:
`public/hero-image.webp` (desktop) and `public/hero-image-mobile.webp` (mobile).

## Usage

```
/stage9
/stage9 --client="Acme Roofing"
```

## Prerequisites

| Input | Location | Required |
|-------|----------|---------|
| brand-dna.json | `clients/[Client Name]/Pipeline Data/brand/` | Yes |
| Logo file (path in brand-dna) | `clients/[Client Name]/[Client Name] Assets/logo/` | Yes |
| pipeline-state stage_7: complete | `logs/pipeline-state.json` | Yes |

## What this command does

1. Reads `.claude/agents/08-hero-image.md` end-to-end
2. Reads `.claude/skills/nano-banana/SKILL.md`
3. Runs the hero image process via `tools/generate-hero.py` for BOTH variants:
   - Desktop landscape (1920x1080 max)
   - Mobile portrait (828x1200 max)
   - Multimodal upload of logo (and owner photo if present) as Gemini reference images
   - Prompt assembly using region defaults + brand-dna.hero.mood lighting brief
   - Retry x3 with exponential backoff on API errors
   - Validation (desktop ≥ 1000×500, mobile ≥ 800×1000, non-zero bytes, not solid colour)
4. Saves to:
   - `clients/[Client Name]/Pipeline Data/hero-image/hero-final-desktop.png`
   - `clients/[Client Name]/Pipeline Data/hero-image/hero-final-mobile.png`
5. Updates `logs/pipeline-state.json` to `stage_9: complete`

## Region defaults (from brand-dna.region)

| Region | House style |
|--------|------------|
| florida | Stucco + barrel tile |
| texas | Brick ranch |
| northeast_us | Colonial |
| midwest_us | Vinyl siding |
| southeast_us | Craftsman |
| pacific_northwest | Mixed siding + evergreens |
| southwest_us | Adobe stucco |
| mountain_west | Log accents |
| default | Generic suburban |

## Failure modes

| Condition | Response |
|-----------|----------|
| Stage 7 not complete | Halt: "Run Stage 7 (brand DNA) and approve before Stage 9." |
| Logo missing | Halt: "Logo not found. Check brand-dna.logo.path." |
| Gemini API error | Script retries x3 with exponential backoff. |
| All retries exhausted | Script writes `REGENERATION-NEEDED.md` with error and filled prompt. Stage marked `needs_regeneration`. Pipeline can continue with placeholder hero images from the website template. |
| Only one variant generated | Halt with `failed`. Both desktop AND mobile are mandatory. Re-run with `--variant both`. |

## After completion

The build-all orchestrator fires Stage 10.1 (`/stage-10-1-build`) next.
`tools/build-from-template.py` reads the two hero PNGs from
`Pipeline Data/hero-image/`, optimises them via `tools/optimise-image.py`
(WebP q=92, dimension-capped), and writes them to the per-client
`public/hero-image.webp` + `public/hero-image-mobile.webp` slots before
running `vite build`.
