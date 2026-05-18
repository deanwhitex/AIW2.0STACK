# Agent: Build From Template (Stage 10.1, template-approach branch)

## Role
Clone `templates/{niche-slug}/` to `clients/[Client Name]/[Client Name] Website/`, overlay a per-client `src/config/brand-dna.js` composed from upstream pipeline data, copy + optimise per-client assets, run `npm install && npm run build`, then validate the dist for sentinels and forbidden strings.

The default template is the canonical per-client base. Per-client variance is locked to: paint (palette CSS variables), copy (every visible string), photos (logo + hero + owner + projects + team + per-section), trust badges (looked up from `templates/{niche-slug}/niche-playbook/trust-signals.json`), theme mode (`light` | `dark`, single mode), and background SVG pattern (selected from a 13-pattern library by `brand-dna.shape_motif`). NOTHING ELSE varies.

## Architecture

`tools/build-from-template.py` is the orchestrator. This agent invokes the script, monitors the output, and updates pipeline state on success / failure.

The script does five things in order:
1. Clone `templates/{niche-slug}/` (no `.git`, `node_modules`, `dist`)
2. Compose `src/config/brand-dna.js` from intake / research / strategy / brand-dna.json / brand-resonance / copy-deck
3. Copy + optimise per-client assets to `public/` via `tools/optimise-image.py`
4. `cd` into the site dir, `npm install` + `npm run build` (the vite `prebuild` hook runs `scripts/inject-theme.mjs` which rewrites `:root` palette + Google Fonts imports + `<html data-theme-mode="...">` from `brand-dna.js`)
5. Validate `dist/` (no `__REQUIRED__SOMETHING__` sentinels in `brand-dna.js`, no forbidden strings in `dist/index.html` / `dist/assets/*.css/*.js`). Stage 10.1 also runs `scripts/validate-brand-dna.mjs` as a prebuild step, which walks the canonical shape in `templates/{niche-slug}/src/config/brand-dna.example.js` and halts on any missing field or wrong type before Vite even loads the modules.

## Prerequisites

- Stage 7 (brand DNA) complete with `pipeline-state.stage_7 === 'complete'`
- Stage 9 (hero image) complete with BOTH `hero-final-desktop.png` AND `hero-final-mobile.png` saved
- Optional: Stage 7.5 (brand resonance) complete with `Pipeline Data/brand-resonance/resonance.json`
- Required Python: Pillow installed (`pip install Pillow beautifulsoup4`)
- Required system: Node.js + npm in PATH

## Steps

### Step 0, Read accumulated lessons (REQUIRED)

Before any other step, read these two files if they exist:

1. `.claude/lessons/by-agent/09-build.md`, universal corrections. As of 2026-05-13 this file holds 62 rules covering: available-now dot rendering (always present, green inside hours, grey outside, every nav surface), nav logo no-bleed, hero subheading white + shadow, manufacturer cert badge minimum sizes, per-client corner overlays via brand-dna.corner_overlay, review avatar + process step number white-on-gradient, mobile sticky dual-CTA two-color split, nav CTA white-on-accent at every breakpoint, plus existing rules for review pill no-filler, image quality, forbidden strings, sentinel validator, static rendering, theme overrides, and 47 others. Read the file in full, every rule is a hard constraint.
2. `clients/[Client Name]/Pipeline Data/lessons/notes.md`, corrections specific to this client only

Lessons take precedence over the default behaviour. If universal and client-specific conflict, client-specific wins.

### Step 1, Run the build orchestrator

```bash
python3 tools/build-from-template.py --client "[Client Name]"
```

For faster iteration on subsequent re-runs (when `node_modules` is already populated):

```bash
python3 tools/build-from-template.py --client "[Client Name]" --skip-install
```

For composing brand-dna.js + copying assets WITHOUT building:

```bash
python3 tools/build-from-template.py --client "[Client Name]" --dry-run
```

The script prints progress per step and prints the final validator result. It updates `pipeline-state.json` (`stage_10_1: complete | failed`) and appends to `build-log.md`.

### Step 2, On failure, diagnose

Common failure modes:

| Symptom | Fix |
|---------|-----|
| `__REQUIRED__` sentinel survived | An upstream stage didn't populate the corresponding field. Inspect the listed `brand-dna.js` line, find the upstream output that should source it, fix the upstream stage, re-run from there. |
| Forbidden string in dist/ (__REQUIRED__ sentinel survived, or a niche-playbook forbidden term) | Some component wasn't fully refactored to consume `brandDNA.*`. Check the failing file, replace the literal with the matching `brandDNA.*` reference. |
| `npm install` fails | Network or registry issue. Retry. |
| `vite build` fails with module error | Likely a syntax error in the per-client `brand-dna.js` or in a refactored component. Read the error trace. |
| Hero image missing | Stage 9 did not produce both desktop + mobile. Re-run Stage 9 with `--variant both`. |

### Step 3, On success, hand off to downstream stages

- Stage 10.2 (SEO injection) reads `dist/` and patches sitemap.xml + robots.txt + Schema.org JSON-LD
- Stage 10.3 (uplift, scoped down) optionally adds extras not in the niche template
- Stage 10.4a (design fidelity SSIM), runs `tools/render-template-reference.py` to render the default template with this client's brand-dna applied to a temp dir, screenshots, SSIM-diffs the production build
- Stage 10.4b (SOP-QA), checks BOTH default-template composition AND universal SOP locked phrases
- Stage 10.4c (build fidelity), `tools/build-fidelity-diff.py` compares DOM structure
- Stage 10.4d (perf), Lighthouse LCP < 3s gate

## Output gate

Stage 10.2 (and downstream stages) cannot proceed until:
- `clients/[X]/[X] Website/dist/index.html` exists and is non-zero
- `pipeline-state.stage_10_1 === 'complete'`
- The validator inside `tools/build-from-template.py` reported PASS

## Asset path contract (fixed across all per-client builds)

See `templates/{niche-slug}/PHOTO-MANIFEST.md` for the full list. Stage 10.1 enforces this contract, every per-client build writes assets at the same paths so the templated component code never changes:

- `public/logo.svg` (or `.png`)
- `public/hero-image.webp` (desktop, max 1920x1080, q=92)
- `public/hero-image-mobile.webp` (mobile, max 828x1200, q=92)
- `public/owner.webp` (max 640x800, q=88)
- `public/badges/{filename}.{png,svg}` (looked up from `templates/{niche-slug}/niche-playbook/trust-signals.json`)
- `public/work/project{n}.webp` (max 1200x800, q=92)
- `public/team/{slug}.webp` (max 480x600, q=88)
- `public/platforms/{google,facebook,bbb}-logo.svg` (verbatim from `references/assets/platforms/`)
- `public/patterns/{shape_motif}.svg` (one of 13, selected by `brandDNA.shape_motif`)

## Failure handling

| Failure | Action |
|---------|--------|
| Template directory missing | Halt, point to `templates/{niche-slug}/`, do not retry |
| Client folder not found | Halt, request Stage 1 (intake) be re-run |
| `__REQUIRED__` sentinel survived | Halt with `failed`, surface the failing field path so the student can fix the upstream source |
| Forbidden string in dist | Halt with `failed`, surface the file + string so the student can fix the component refactor |
| npm install or build fails | Halt with `failed`, surface the error verbatim |
| Asset copy fails (e.g. logo missing) | Halt with `failed`, point to the missing asset path |

## What this agent REPLACES (template-approach pivot)

The prior `09-build.md` (design-human-in-the-loop approach) generated a fresh Next.js project per client using a Claude-designed component library. This is gone. The pivot:

- **Old**: 17 stage agents + Stage 8 Claude design system manual paste + per-client React generation + per-client visual variance via SectionDivider + PlatformLogos + per-client lessons
- **New**: clone default template + overlay brand-dna.js + asset swap. Layout, composition, components LOCKED. Per-client variance only in paint, copy, photos, badges, theme mode, and background SVG pattern.

The 68 build-agent lessons from the prior approach are archived at `.claude/_archive/lessons-superseded/09-build-pre-template-approach.md`. The current `.claude/lessons/by-agent/09-build.md` contains only the 7 universal rules that survived the slim-down.
