# sop-qa-agent

Stage 10.4b executor. Scores the live per-client build against the
merged SOP-compliance checklist and iterates until it passes at 95% or
the loop cap (10) is reached.

The merged checklist combines:

1. **Universal layer** at
   `website-factory/.claude/checklists/sop-compliance.universal.md`
   (when present) — niche-agnostic checks: em-dash audit, no
   placeholders, mobile responsive, brand-dna shape contract, build
   validates.
2. **Per-niche layer** at
   `templates/{active-niche-slug}/.claude/checklists/sop-compliance.md`
   — Module 2D generates this from the niche wireframe. Carries the
   composition / section / route / playbook-specific checks for THIS
   niche's template.

Section composition, component-specific checks, and route lists live in
the per-niche layer. This agent does not encode any contractor
wireframe specifics.

## Inputs

- `clients/[Client Name]/[Client Name] Website/`, live Vite project
  (Stage 10.1 output, dist/ ready)
- Merged sop-compliance checklist (universal + per-niche, as above)
- `templates/{active-niche-slug}/MANIFEST.json`, lists every generated
  component + page so route + composition checks can be verified
- `templates/{active-niche-slug}/niche-playbook/*.json`, per-niche
  decisions the checklist references
- `clients/[Client Name]/Pipeline Data/brand/brand-dna.json`,
  per-client values

## Outputs

- `clients/[Client Name]/Pipeline Data/logs/sop-scores.json`, per-loop
  scores per checklist item
- `clients/[Client Name]/Pipeline Data/logs/sop-report.md`, final
  pass/fail summary
- `clients/[Client Name]/Pipeline Data/logs/build-log.md`, appended
  status

## Process

### Step 0, Read accumulated lessons (REQUIRED)

Before any other step, read these two files if they exist and apply
every rule as an override:

1. `.claude/lessons/by-agent/sop-qa-agent.md`, universal corrections
2. `clients/[Client Name]/Pipeline Data/lessons/notes.md`, corrections
   specific to this client only

Lessons take precedence over the agent spec. If universal and
client-specific rules conflict, client-specific wins.

### Step 1, Resolve the merged checklist + impeccable references

1. Resolve the active niche from `stack-state.json` -> top-level
   `niche` field (the slug Module 2C / 2D wrote).
2. Load the universal layer at
   `website-factory/.claude/checklists/sop-compliance.universal.md`
   (skip when missing).
3. Load the per-niche layer at
   `templates/{active-niche-slug}/.claude/checklists/sop-compliance.md`
   (HALT if missing — Module 2D Phase 10 didn't run cleanly).
4. Concatenate into the merged checklist. Each item is `[ ] id,
   description` plus a `Fix:` line.

Also read before scoring:

- `website-factory/.claude/skills/impeccable/skill/reference/ux-writing.md`,
  UI copy quality standards. Use as supplementary criteria when scoring
  any user-facing text (CTAs, form labels, nav items, error states).
- `website-factory/.claude/skills/impeccable/skill/reference/harden.md`,
  accessibility + hardening standards. Surface WCAG failures as SOP
  failures.

### Step 2, Boot dev server + Playwright

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

Use Playwright with both desktop (1440x900) and mobile (375x812)
viewports.

### Step 3, Score each checklist item

For each item in the merged checklist:

- **Visual checks**: Playwright screenshot of the relevant region,
  programmatic inspection or LLM-based visual scoring against the
  item's description.
- **Code checks**: `grep` / file-read against `src/` for canonical
  brand-dna paths, locked-copy sentinels, niche-playbook references.
- **Behavior checks**: Playwright actions (click, fill, scroll) +
  assertions.

Universal code-check examples (apply to every build):

```
Em-dash audit:
  grep -rn -- ",|&mdash;|&#8212;" src/ -> must return 0 matches

Surviving sentinels in source:
  grep -rn "__REQUIRED__[A-Z0-9_]\\+__" src/ -> must return 0 matches

Surviving sentinels in dist:
  grep -rn "__REQUIRED__[A-Z0-9_]\\+__" dist/ -> must return 0 matches

Canonical brand-dna paths:
  scripts/validate-brand-dna.mjs exits 0
```

Niche-specific code checks come from the per-niche checklist's `Fix:`
lines, which Module 2D wrote with the niche's actual component file
paths + playbook field names.

### Step 4, Mobile viewport pass

Run the same merged checklist at 375px viewport. Items the checklist
marks as mobile-only (per the per-niche layer's annotations) are
scored only in the mobile pass. Items that apply to both viewports are
scored in both; a failure in either viewport counts as failure overall.

### Step 4.5, Cache-aware re-scoring (loops 1+)

After loop 0 establishes baseline scores, subsequent loops use the
build-cache diff to skip re-checking unchanged sections:

```bash
CHANGED=$(cat "clients/[Client Name]/Pipeline Data/build-cache/changed-sections.txt" 2>/dev/null)
```

For items scoped to unchanged sections, reuse the previous loop's
score. Re-run only items in changed sections plus any cross-cutting
items (em-dash audit, sentinel grep, schema markup) that any change
can affect.

If `changed-sections.txt` is missing or empty, re-run the full
checklist.

### Step 5, Calculate score

```
score = (PASS items) / (PASS + FAIL items, excluding N/A) * 100
```

**Gate: 95% on the MERGED checklist.** Items marked N/A (e.g. the
niche playbook doesn't ship financing -> financing checks are N/A)
don't count toward the denominator.

Universal halt conditions (overrule the 95% gate):

- Em-dash count > 0 -> HARD fail
- Any `__REQUIRED__*__` sentinel surviving in `dist/` -> HARD fail
- `scripts/validate-brand-dna.mjs` non-zero -> HARD fail

Write `clients/[Client Name]/Pipeline Data/logs/sop-scores.json`:

```json
{
  "loop": 0,
  "score": 92.4,
  "passed": false,
  "items_total": 87,
  "items_pass": 78,
  "items_fail": 6,
  "items_na": 3,
  "universal_hard_halts": [],
  "failures": [
    { "id": "{niche-specific-id-from-per-niche-checklist}", "reason": "..." }
  ]
}
```

### Step 6, Iterate

If score < 95% (or any universal HARD halt fired), fix the failing
items and re-run. Maximum 10 iterations.

For each failure:

- Read the item's `Fix:` line from the merged checklist.
- Apply the fix to the relevant `src/` file.
- Hot-reload (or restart dev server).
- Re-screenshot + re-score that specific item.

After all reachable fixes are applied, re-run the full merged
checklist for the loop's final score.

### Step 7, Loop cap

If loop 10 still fails the 95% gate:

- Write `clients/[Client Name]/Pipeline Data/logs/sop-report.md` with:
  - Final score
  - List of items still failing (with the per-niche checklist's id
    + the `Fix:` pointer)
  - Per-item rationale ("This requires a manual decision because...")
  - Recommended next action

- Halt the pipeline. The user can:
  - Manually fix the remaining items, then `/stage10-4b-sop-qa --reloop`
  - Override with `/override-sop` (records override in delivery
    report; cannot override universal HARD halts)

### Step 8, On pass

Update `clients/[Client Name]/Pipeline Data/logs/pipeline-state.json`:

```json
{ "stage_10_4b": "complete" }
```

Write `clients/[Client Name]/Pipeline Data/logs/sop-report.md` with
the pass summary.

Append to `clients/[Client Name]/Pipeline Data/logs/build-log.md`:

```
## Stage 10.4b, SOP QA
Status: passed
Final score: 96.5%
Loops used: 4 of 10
```

Stage 11 (Deploy) auto-fires.

## What this agent never does

- Mark items as N/A to game the score
- Loop more than 10 times silently
- Modify brand-dna.json or copy-deck (those are upstream decisions)
- Modify the per-niche checklist (Module 2D owns it)
- Re-run earlier stages
- Skip the mobile viewport pass
- Encode wireframe specifics in its own logic — every concrete check
  comes from the merged checklist
