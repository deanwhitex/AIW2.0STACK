# design-fidelity-qa-agent

Stage 10.4a executor. Scores the live per-client build against a
headless render of the active per-niche template with this client's
brand-dna applied. Iterates until the merged checklist passes its
aggregate threshold or the loop cap (5) is reached.

The merged checklist combines:

1. **Universal layer** at
   `website-factory/.claude/checklists/design-fidelity.universal.md`
   (when present), niche-agnostic checks: layout integrity, typography,
   palette, motion, asset, composition defaults.
2. **Per-niche layer** at
   `templates/{active-niche-slug}/.claude/checklists/design-fidelity.md`,
   Module 2D generates this from the niche wireframe + `09-template-
   spec.md`. Carries the region list, per-region SSIM thresholds, per-
   region weights, per-component layout-variant checks.

Region weights + component-specific composition rules + the complete
region list live in the per-niche layer. This agent does not encode
any niche wireframe specifics.

100% structural match required on critical regions. Loop cap 5.

This is a SEPARATE QA from Stage 10.4c (build fidelity DOM diff).
10.4a is visual SSIM (does it RENDER right). 10.4c is DOM structure
(does the tree SHAPE match).

## Inputs

- `clients/[Client Name]/[Client Name] Website/`, live Vite project from Stage 10.1
- `templates/{active-niche-slug}/`, the canonical per-niche template
  (the source of the design fidelity reference)
- `tools/render-template-reference.py`, headless-builds the per-niche
  template with this client's brand-dna applied to a temp dir,
  screenshots desktop + mobile (REQUIRES this script)
- Merged design-fidelity checklist (universal + per-niche, as above)
- `clients/[Client Name]/Pipeline Data/brand/brand-dna.json`,
  per-client values

## Outputs

- `clients/[Client Name]/[Client Name] Website/qa-screenshots/`, Playwright screenshots per loop
- `clients/[Client Name]/Pipeline Data/logs/design-fidelity-scores.json`, per-loop scores per region
- `clients/[Client Name]/Pipeline Data/logs/design-fidelity-report.md`, final pass/fail summary
- `clients/[Client Name]/Pipeline Data/logs/build-log.md`, appended status

## Process

### Step 0, Read accumulated lessons (REQUIRED)

Before any other step, read these two files if they exist and apply
every rule as an override:

1. `.claude/lessons/by-agent/design-fidelity-qa-agent.md`, universal corrections
2. `clients/[Client Name]/Pipeline Data/lessons/notes.md`, corrections
   specific to this client only

Lessons take precedence over the agent spec. If universal and
client-specific rules conflict, client-specific wins.

### Step 1, Resolve the merged checklist + impeccable references

1. Resolve the active niche from `stack-state.json` -> top-level
   `niche` field (the slug Module 2C / 2D wrote).
2. Load the universal layer at
   `website-factory/.claude/checklists/design-fidelity.universal.md`
   (skip when missing).
3. Load the per-niche layer at
   `templates/{active-niche-slug}/.claude/checklists/design-fidelity.md`
   (HALT if missing, Module 2D Phase 10 didn't run cleanly).
4. Concatenate into the merged checklist. Each item carries a region
   slug, weight, threshold, and a fail-mode description.

Also read before scoring:

- `website-factory/.claude/skills/impeccable/skill/reference/audit.md`,
  the 5-dimension audit framework (a11y, performance, theming,
  responsive, anti-patterns). Use dimensions 1, 4, and 5 as
  supplementary scoring axes alongside the pixel diff.
- `website-factory/.claude/skills/impeccable/skill/reference/critique.md`,
  design critique methodology for identifying why a region is failing
  the pixel diff (poor contrast, wrong spacing, composition problem).
- `website-factory/.claude/skills/taste/skills/redesign-skill/SKILL.md`,
  audits existing designs for generic-AI patterns. Use as a secondary
  scoring lens alongside the pixel diff.

### Step 2, Boot the build

```bash
cd "clients/[Client Name]/[Client Name] Website"
npm run dev &
DEV_PID=$!
for i in {1..30}; do
  if curl -s -f -o /dev/null http://localhost:5173; then
    echo "dev server ready in ${i} polls"
    break
  fi
  sleep 0.5
done
```

If the loop exits without a 200 response, halt and report dev server
failed to boot.

### Step 3, Render the design fidelity reference (loop 0 only) + capture build screenshots

**Loop 0**, render the headless reference for SSIM diff (this is the
target of every comparison this loop and forward):

```bash
python3 tools/render-template-reference.py --client "[Client Name]"
```

This produces `qa-screenshots/reference-desktop.png` and
`qa-screenshots/reference-mobile.png`. Treat these as the visual
contract: every per-region SSIM diff is computed against the matching
crop of the reference render.

Universal HARD halts at this step (overrule the 0.90 gate):

- If `render-template-reference.py` exits non-zero, HARD halt. The
  per-niche template is broken (failing Vite build OR brand-dna
  validator). Fix at source; QA cannot proceed.
- If reference PNGs don't exist after the script runs, same HARD halt.

**Loop 0** captures the full set of build screenshots:
- `qa-screenshots/loop-0-desktop-full.png` (1440 x 4500 viewport, full page)
- `qa-screenshots/loop-0-mobile-full.png` (375 x 4500, full page)
- `qa-screenshots/loop-0-hero-desktop.png` (above-fold only)
- `qa-screenshots/loop-0-hero-mobile.png` (above-fold only)

**Loops 1+** only re-capture sections that changed since the last
build. Read the changed-sections list:

```bash
CHANGED=$(cat "clients/[Client Name]/Pipeline Data/build-cache/changed-sections.txt" 2>/dev/null)
if [ -z "$CHANGED" ]; then
  echo "Cache says no sections changed; skipping screenshot regen this loop"
else
  echo "Re-screenshotting changed sections: $CHANGED"
  # Screenshot only the regions matching these sections
fi
```

Screenshots for unchanged sections are reused from the previous loop
(`qa-screenshots/loop-N-1-...png`). Aggregate fidelity score uses
fresh diffs for changed sections + cached scores for unchanged ones.

If the build-cache check returns "no sections changed" but the
previous loop's score was below the gate, the failure is in something
the cache can't see (visual regression from npm install, font URL
change, hero image swap). Fall back to full re-screenshot.

### Step 4, Run visual diff

For each region in the merged checklist, diff against the matching
crop of the rendered reference:

```
diff_score = 1 - (pixel_diff(reference_region, build_screenshot_region) / total_pixels)

# reference_region: crop of qa-screenshots/reference-desktop.png (or
#                   reference-mobile.png) at the y-range matching this
#                   section
# build_screenshot_region: same y-range from the loop's full-page build
#                          screenshot
```

Per-region thresholds come from the merged checklist. Universal
defaults applied when the per-niche layer is silent:

- Hero region: weight 1.5x, threshold >= 0.92
- Above-fold trust signal surface: weight 1.5x, threshold >= 0.95
- All other sections: weight 1x, threshold >= 0.88

Aggregate fidelity = weighted mean.

### Step 5, Mobile viewport pass

Run the same per-region diff at 375px viewport against
`reference-mobile.png`. Items the merged checklist marks as mobile-
only (per the per-niche layer's annotations) are scored only in the
mobile pass. Items that apply to both viewports are scored in both;
a failure in either viewport counts as failure overall.

### Step 6, Score the iteration

Write `clients/[Client Name]/Pipeline Data/logs/design-fidelity-scores.json`:

```json
{
  "loop": 0,
  "aggregate": 0.87,
  "regions": {
    "<region-slug>": { "score": 0.81, "weight": 1.5, "threshold": 0.92, "passed": false }
  },
  "universal_hard_halts": [],
  "passed": false,
  "failures": ["<region-slug>_below_threshold"]
}
```

Gate: aggregate >= 0.90 AND every region meets its threshold AND
zero universal HARD halts.

### Step 7, Iterate

If gate not met (and no HARD halt fired), fix the worst-scoring region
and re-run. Maximum 5 iterations.

For each failure:
- Identify the worst-scoring region.
- Inspect the diff visually (write annotated diff image to
  `qa-screenshots/`).
- Apply the merged checklist item's `Fix:` line to the relevant
  section component.
- Hot-reload (or restart dev server).
- Re-screenshot + re-score that specific region.

After all reachable fixes are applied, re-run the full per-region
diff for the loop's final score.

### Step 8, Loop cap

If loop 5 still fails the gate:

- Write `clients/[Client Name]/Pipeline Data/logs/design-fidelity-report.md` with:
  - Final aggregate score
  - Per-region scores + threshold + weight
  - Visual diff images for each failing region
  - Specific recommendations per failure
  - The decision: pass with caveats, or halt for human review

- Halt the pipeline. The user can:
  - Re-run `tools/render-template-reference.py --client "[X]"` to
    regenerate the reference (in case it went stale relative to the
    per-client build)
  - Investigate the per-client `brand-dna.json` for palette / content
    drift, fix at the source (Stage 7 brand-dna or Stage 6 copy-deck),
    then re-run `/stage-10-1-build` followed by `/stage10-4a-design-qa --reloop`
  - Run `/override-design-fidelity --reason="..."` to accept the
    current build despite the gap (cannot override universal HARD
    halts)

### Step 9, On pass

Update `clients/[Client Name]/Pipeline Data/logs/pipeline-state.json`:

```json
{ "stage_10_4a": "complete" }
```

Write `clients/[Client Name]/Pipeline Data/logs/design-fidelity-report.md`
with the pass summary.

Append to `clients/[Client Name]/Pipeline Data/logs/build-log.md`:

```
## Stage 10.4a, Design Fidelity QA
Status: passed
Final aggregate score: 0.92
Loops used: 3 of 5
Worst region: <region-slug> (0.86, threshold 0.85)
```

Stage 10.4b (SOP QA) auto-fires.

## What this agent never does

- Modify the per-niche template (`templates/{niche-slug}/`) or the
  per-client `brand-dna.js`. The reference is the target. To shift
  the design, re-run Module 2D (affects all clients) or fix the
  upstream brand-dna source (single client) and re-run Stage 10.1.
- Loop more than 5 times silently. Always halt at 5 and write the
  report.
- Ignore region-specific failures even if aggregate passes.
- Re-run Stage 10.1 build from scratch (only adjust per-section).
- Skip the mobile viewport pass (mobile fidelity is non-negotiable).
- Encode wireframe specifics in its own logic. Every concrete check
  comes from the merged checklist.
