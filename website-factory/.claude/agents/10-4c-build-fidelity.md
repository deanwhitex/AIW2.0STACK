# 10-4c-build-fidelity (template-approach branch)

Stage 10.4c executor. Compares the per-client build against the canonical
`templates/{niche-slug}/` build and confirms structural fidelity: same DOM tree
shape, same component class taxonomy, same section order. Per-client deltas
allowed: text content, image src, palette CSS variable values. Anything else
fails the gate.

This is a SEPARATE QA from Stage 10.4a (design fidelity SSIM). 10.4a checks
visual rendering; 10.4c checks DOM structure.

## Inputs

- `clients/[Client Name]/[Client Name] Website/dist/` (the per-client build, output of Stage 10.1)
- `templates/{niche-slug}/dist/` (the reference build; created on first run via `--build-reference`)

## Process

### Step 0, Read accumulated lessons (REQUIRED)

Before any other step, read these two files if they exist:

1. `.claude/lessons/by-agent/10-4c-build-fidelity.md`
2. `clients/[Client Name]/Pipeline Data/lessons/notes.md`

### Step 1, Confirm prerequisites

- Stage 10.1 has succeeded for this client (`pipeline-state.json` shows `stage_10_1: complete`)
- `clients/[X]/[X] Website/dist/index.html` exists and is non-zero
- `templates/{niche-slug}/` exists

### Step 2, Run the diff tool

If the reference build is missing or stale (older than the latest commit on `templates/{niche-slug}/`), build it first:

```bash
python3 tools/build-fidelity-diff.py --client "[Client Name]" --build-reference
```

Otherwise, faster path:

```bash
python3 tools/build-fidelity-diff.py --client "[Client Name]"
```

### Step 3, Interpret the report

`tools/build-fidelity-diff.py` writes
`clients/[X]/Pipeline Data/qa/build-fidelity.json` with:
- `client_node_count`, `reference_node_count`, `node_count_delta`
- `mismatches` (up to 50 per-position structural deltas)
- `passed: true/false` (boolean gate)

Pass criteria (default `--tolerance 0`):
- `node_count_delta == 0` (no element added/removed)
- `len(mismatches) == 0` (no structural mismatch)

What the diff IGNORES (per-client variance allowed):
- text content (no `text` field in the signature)
- image `src` (only `has_alt` is checked for `<img>`)
- exact href URL (only the link kind: tel / mailto / internal / external)
- inline style values (palette swaps live here)
- color hex codes anywhere

What the diff CHECKS:
- HTML tag name per node
- `class` set (sorted, dedup)
- `id` attribute
- `data-*` attribute names (values not compared)
- DOM tree depth + ordering

### Step 4, Update pipeline state and log

If `passed: true`:
```
{ "stage_10_4c": "complete" }
```

Append to `clients/[Client Name]/Pipeline Data/logs/build-log.md`:
```
## Stage 10.4c, build fidelity
Status: complete
Node count delta: {value}
Structural mismatches: 0
Report: Pipeline Data/qa/build-fidelity.json
```

If `passed: false`:
```
{ "stage_10_4c": "failed" }
```

Halt the pipeline. The build deviated from the template structure, needs
investigation. Most likely causes:
- A component file in `clients/[X]/[X] Website/src/components/` was edited
  outside of brand-dna substitution
- A new section was added to one of the page files
- the niche template itself changed (the reference is stale; rebuild with
  `--build-reference`)

## Failure handling

| Failure | Action |
|---------|--------|
| Client `dist/` missing | Halt, request Stage 10.1 re-run |
| Reference `dist/` missing | Re-run with `--build-reference` |
| Tolerance exceeded | Halt with `failed`, surface report path to the student |
| BeautifulSoup parse error | Halt, log the malformed HTML, do not retry |

## Override

If a structural delta is intentional (e.g. a per-client OPTIONAL Team section
rendered because the client has team photos), the override is to bump
`--tolerance` accordingly OR to update the templates/{niche-slug}/ Team rendering
guard so the reference renders the same conditional. Always prefer the latter.
