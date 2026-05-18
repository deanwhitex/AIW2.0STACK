# 10-4d-perf (template-approach branch)

Stage 10.4d executor. Runs Lighthouse against the per-client built site and
gates on LCP < 3 seconds. Quality-first image optimisation at Stage 10.1
should already get us comfortably under, but this gate enforces it.

## Inputs

- `clients/[Client Name]/[Client Name] Website/dist/` (the per-client build, Stage 10.1 output)

## Process

### Step 0, Read accumulated lessons (REQUIRED)

1. `.claude/lessons/by-agent/10-4d-perf.md`
2. `clients/[Client Name]/Pipeline Data/lessons/notes.md`

### Step 1, Confirm prerequisites

- Stage 10.1 has succeeded (`pipeline-state.json` shows `stage_10_1: complete`)
- `npm run preview` is runnable from `clients/[X]/[X] Website/`
- Local Lighthouse CLI is installed (`npx lighthouse --version`). If not, install via `npm install -g lighthouse@latest` or use `unlighthouse`.

### Step 2, Start a local preview server

```bash
cd "clients/[Client Name]/[Client Name] Website"
npm run preview &
PREVIEW_PID=$!
sleep 3
```

The Vite preview server listens on `http://localhost:4173/` by default.

### Step 3, Run Lighthouse against home page (desktop and mobile)

```bash
npx lighthouse http://localhost:4173/ \
    --output=json \
    --output-path=Pipeline\ Data/qa/lighthouse-desktop.json \
    --preset=desktop \
    --quiet \
    --chrome-flags="--headless --no-sandbox"

npx lighthouse http://localhost:4173/ \
    --output=json \
    --output-path=Pipeline\ Data/qa/lighthouse-mobile.json \
    --quiet \
    --chrome-flags="--headless --no-sandbox"
```

### Step 4, Read scores

For each report, extract:
- `audits['largest-contentful-paint'].numericValue` (in ms; convert to seconds)
- `categories.performance.score` (0-1; multiply by 100)

### Step 5, Apply gate

LCP < 3000 ms on both desktop and mobile = pass. Performance score should
typically be ≥ 0.85 on desktop, ≥ 0.75 on mobile.

If LCP ≥ 3000 ms on either device:
1. Identify the largest LCP element (look at `audits['largest-contentful-paint-element']`)
2. If it's a hero image, re-run Stage 10.1 with the hero image at the next quality step down (92 → 88) using `tools/optimise-image.py --quality 88`
3. Re-run this stage. Repeat once more (88 → 82) if still failing. NEVER below q=80.
4. If still failing after q=82, halt with `failed`. Likely needs a smaller hero image or a CDN.

### Step 6, Stop the preview server

```bash
kill $PREVIEW_PID 2>/dev/null
```

### Step 7, Update pipeline state and log

```
{ "stage_10_4d": "complete" }
```

Append:
```
## Stage 10.4d, perf
Status: complete | failed
Desktop LCP: {ms} ms (score: {x.xx})
Mobile LCP: {ms} ms (score: {x.xx})
Reports: Pipeline Data/qa/lighthouse-{desktop,mobile}.json
```

## Failure handling

| Failure | Action |
|---------|--------|
| Lighthouse CLI missing | Print install hint, halt |
| LCP > 3s after q=82 retry | Halt with `failed`, surface the report |
| Preview server failed to start | Halt, check `npm run preview` manually |

## Notes

The existing `tools/check-lcp.py` (carried over from the old branch) measures
LCP via Playwright without running full Lighthouse. It's a good faster
sanity check during iteration but the gate uses real Lighthouse for the
actual scoring (it's the standard for SEO / Vercel quality scoring).
