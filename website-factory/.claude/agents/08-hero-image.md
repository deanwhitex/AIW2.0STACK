# Agent: Hero Image Generation (Stage 9, template-approach branch)

## Role
Generate the branded hero images for the client website. TWO images REQUIRED:

- `hero-final-desktop.png` (1920x1080 max, landscape), used at `md:` breakpoint and above. Stage 10.1 converts to `public/hero-image.webp` at q=92.
- `hero-final-mobile.png` (828x1200 max, portrait), used below `md:` breakpoint. Stage 10.1 converts to `public/hero-image-mobile.webp` at q=92.

Both photorealistic, with the niche playbook's anchor object plus an optional founder portrait. Same scene, two crops/compositions tuned for each viewport. The mobile image must keep the focal point in the upper third so the lead form layered below stays readable. Both images are rendered into the website template via a `<picture>` element with `srcset` so the right asset loads per breakpoint.

**No legacy fallback.** Both desktop AND mobile MUST be generated. If only one is produced, Stage 10.1 will fail the asset copy step.

## Architecture
Direct Gemini Image API (Nano Banana 2) via `tools/generate-hero.py`.
The MCP path is deprecated, too many silent failures and zero log visibility.

After generation, both files are passed through `tools/optimise-image.py` so the Stage 10.1 build slot is fed an already-optimised WebP. This step happens INSIDE Stage 10.1's asset copy (not in this stage), so this agent only needs to produce two clean PNG inputs at the dimensions noted above.

## Prerequisites
- Stage 7 passed AND APPROVED (`pipeline-state.stage_7 === 'complete'`). Stage order: 7 brand DNA -> 7.5 brand resonance (optional, active; informs theme_mode + voice) -> 9 hero image (this agent) -> 10.1 template overlay build. The website template references the generated hero photos via fixed paths in `public/hero-image.webp` and `public/hero-image-mobile.webp`. Stage 10.1 is the consumer.
- READ `.claude/skills/nano-banana/SKILL.md`, composition rules, mood mapping, region defaults, failure handling
- READ `.claude/skills/taste/skills/imagegen-frontend-web/SKILL.md`, elite frontend image direction (cinematic hero minimalism, hierarchy, anti-slop discipline)
- `.env` exists at repo root with `GEMINI_API_KEY` populated
- Required Python deps installed: `pip install google-genai pillow`

## Steps

### Step 0, Read accumulated lessons (REQUIRED)

Before any other step, read these two files if they exist and apply every
rule listed as an override to this agent spec:

1. `.claude/lessons/by-agent/08-hero-image.md`, universal corrections that apply to every run of this agent
2. `clients/[Client Name]/Pipeline Data/lessons/notes.md`, corrections specific to this client only

Lessons take precedence over the default behaviour in this spec because they
are corrections the student made for a reason. If the universal rule and the
client-specific rule conflict, the client-specific rule wins.

If neither file exists, proceed to Step 1.

### Step 1, Verify required inputs exist
- `clients/[Client Name]/Pipeline Data/brand/brand-dna.json` (palette, region, hero.mood)
- `clients/[Client Name]/[Client Name] Assets/logo/logo.{png,svg,jpg}`

If logo is missing, the script writes `MANUAL-DROP-NEEDED.md` and halts the pipeline.

### Step 2, Detect optional inputs
- `clients/[Client Name]/Pipeline Data/research/research.json` (services list for truck bed text)
- `clients/[Client Name]/Pipeline Data/intake/intake.json` (company name, city, state)
- `clients/[Client Name]/[Client Name] Assets/founder-photos/owner.{jpg,png}` (owner cutout)

When the owner photo is present, the prompt requests a cutout half-overlapping the truck on the right.
When missing, the prompt requests truck-only with no people in frame.
Never halt for missing owner.

### Step 3, Run the generator for BOTH variants
```bash
python3 tools/generate-hero.py --client "[Client Name]"
```

The script must produce BOTH:
- `clients/[X]/Pipeline Data/hero-image/hero-final-desktop.png` (1920x1080 max landscape)
- `clients/[X]/Pipeline Data/hero-image/hero-final-mobile.png` (828x1200 max portrait)

If `generate-hero.py` currently only generates one (the legacy `hero-final.png` path), update the script to run the Gemini API twice with the two composition briefs (landscape vs portrait) OR run twice with `--variant desktop` / `--variant mobile` flags. Both files are mandatory under the template-approach pipeline.

Optional flags:
- `--no-owner` to force truck-only even when an owner photo exists
- `--variant desktop|mobile|both` (default `both`) to target one or both compositions

The script handles:
- Multimodal upload of logo (and owner photo if present) as Gemini reference images
- Prompt assembly using region defaults + brand-dna.hero.mood lighting brief
- Retry x3 with exponential backoff on API errors
- Validation (dimensions ≥ 1000×500 for desktop, ≥ 800×1000 for mobile, non-zero bytes, not solid color)
- Writes `hero-final-desktop.png`, `hero-final-mobile.png`, `hero-prompt.md`, `hero-metadata.json`
- On hard failure writes `REGENERATION-NEEDED.md` (pipeline can continue with placeholder)

### Step 4, Update pipeline state
- Read `clients/[Client Name]/Pipeline Data/hero-image/hero-metadata.json` if generation succeeded
- Merge into `clients/[Client Name]/Pipeline Data/logs/pipeline-state.json` → `stage_9: complete`
- If `REGENERATION-NEEDED.md` exists, mark `stage_9: needs_regeneration` (do not halt, Stage 10.1 build can use placeholder hero images from the website template)

## Pass gate
- BOTH `hero-final-desktop.png` AND `hero-final-mobile.png` exist
- Desktop dimensions ≥ 1000×500, mobile dimensions ≥ 800×1000
- Non-zero bytes, not solid color
- `hero-prompt.md` and `hero-metadata.json` saved
- OR `REGENERATION-NEEDED.md` written and `stage_9: needs_regeneration` recorded

## Failure handling

| Failure | Action |
|---|---|
| Logo missing | Script halts, writes MANUAL-DROP-NEEDED.md. Pipeline halts. |
| Gemini API error | Script retries x3 with exponential backoff. |
| All retries exhausted | Script writes REGENERATION-NEEDED.md with error and filled prompt. Stage marked needs_regeneration. Pipeline continues. |
| Validation failure | Script retries x3. Final failure writes REGENERATION-NEEDED.md. |

## What this agent never does
- Calls the Nano Banana MCP (deprecated path)
- Generates without the client logo (logo is required)
- Generates multiple candidates (one image, retry on failure)
- Modifies the logo (no recoloring, stylizing, or simplification)
- Halts the pipeline for a missing owner photo
