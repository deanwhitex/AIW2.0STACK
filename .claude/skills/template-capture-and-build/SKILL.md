---
name: template-capture-and-build
description: Use during Module 2D to capture screenshots and DOM data via Apify, score sites with Claude Vision, and scaffold a fresh Vite + React template that the factory can build against.
---

# Template Capture and Build

The toolkit for Module 2D. Three responsibilities:

1. **Capture** websites via Apify playwright-scraper (desktop + mobile screenshots, DOM, CSS, fonts, colors).
2. **Analyze** captures with Claude Vision against an end-customer conversion rubric.
3. **Scaffold** a fresh Vite + React template that mirrors the website template's shape, with content adapted to the niche.

## Apify capture recipe

Use the `apify/playwright-scraper` actor.

### Input shape (desktop)

```json
{
  "startUrls": [{ "url": "<URL>" }],
  "linkSelector": "",
  "pageFunction": "async function pageFunction(context) { const { page, request, log } = context; await page.waitForLoadState('networkidle', { timeout: 15000 }).catch(() => {}); const html = await page.content(); const colors = await page.evaluate(() => { const counts = {}; document.querySelectorAll('*').forEach(el => { const s = getComputedStyle(el); [s.color, s.backgroundColor, s.borderColor].forEach(c => { if (c && c !== 'rgba(0, 0, 0, 0)' && c !== 'transparent') counts[c] = (counts[c]||0)+1; }); }); return Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,20); }); const fonts = await page.evaluate(() => Array.from(document.fonts).map(f => ({ family: f.family, weight: f.weight, style: f.style }))); return { html, colors, fonts, url: request.url }; }",
  "launchContext": { "useChrome": true, "stealth": true },
  "preNavigationHooks": "[async ({ page }) => { await page.setViewportSize({ width: 1440, height: 900 }); }]",
  "saveSnapshots": true,
  "snapshotterOptions": { "fullPageScreenshot": true }
}
```

### Input shape (mobile)

Same as desktop but viewport: `{ width: 390, height: 844 }`.

### Invocation

Via the apify CLI:
```bash
apify call apify/playwright-scraper \
  --token "${APIFY_TOKEN}" \
  --input-file /tmp/scraper-input-desktop.json \
  --output-dir research/02-niche-research/{slug}/templates/raw/{site-slug}/desktop
```

Or via HTTP for synchronous runs (preferred for screenshots since we want to know when it's done):
```bash
curl -X POST "https://api.apify.com/v2/acts/apify~playwright-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}" \
  -H "Content-Type: application/json" \
  -d @/tmp/scraper-input-desktop.json \
  > research/02-niche-research/{slug}/templates/raw/{site-slug}/desktop/result.json
```

The result.json contains the page function output (DOM, colors, fonts). Screenshots come back as separate KeyValueStore records; fetch them via:
```bash
curl "https://api.apify.com/v2/key-value-stores/{storeId}/records/{recordKey}?token=${APIFY_TOKEN}" \
  > research/02-niche-research/{slug}/templates/raw/{site-slug}/desktop/screenshot.png
```

The storeId comes back in the run metadata.

### Output organization per site

```
research/02-niche-research/{slug}/templates/raw/{site-slug}/
  desktop/
    screenshot.png
    dom.html
    css.json
    fonts.json
    colors.json
  mobile/
    screenshot.png
    dom.html
    css.json
    fonts.json
    colors.json
```

### Rate limiting and retries

- Sequential per site (don't parallelize 10 sites at once, Apify throttles).
- 3 retries on timeout or 5xx with backoff 10s, 30s, 90s.
- If a single site fails 3 times, skip it and report at the end. Don't halt the whole phase.

## Claude Vision scoring

The agent reads both `desktop/screenshot.png` and `mobile/screenshot.png` plus the supporting DOM/CSS data and scores against the 8-category rubric (see Module 2D agent spec for full rubric).

For each category, the score is justified by something specific visible in the screenshot or extractable from the DOM. Example:

> CTA visibility above fold: 13/15. Primary "Get a Free Quote" button is the only saturated color on the hero, top-right with click-to-call mirror in navbar. Loses 2 points because the button is bottom-of-hero on mobile, not visible without one scroll.

The agent doesn't just slap on a number. The note is the audit trail.

## Scaffolding contract

See `scaffold-blueprint.md` for the full file-by-file contract — what every niche template at `templates/{niche-slug}/` must contain after Module 2D's 12 phases finish, with per-file specs (which phase writes it, where its content comes from, what it drives downstream).

Complementary references:
- `.claude/agents/14-template-builder.md` documents the **process** (12 phases)
- `website-factory/references/factory-blueprint/README.md` documents the **universal scaffold** (what Phase 1-3 stamps in)
- `website-factory/references/niche-playbook/README.md` documents the **per-niche data contracts** (what Phase 8 writes)

`scaffold-blueprint.md` is the **product** view: the union of all phases' outputs, showing how the universal blueprint + per-niche generation compose into a completed niche template.

Core principles:
- Mirror the website template's shape exactly so the factory's existing tooling works (build-from-template, sentinel validation, brand-dna overlay).
- Component shells are working React, not pseudocode. They render correctly with the brand-dna defaults.
- Every visible string is sourced from `brandDna.copy.*`. No hardcoded copy in components.
- Every image is sourced from `brandDna.images.*`. PHOTO-MANIFEST.md documents every required image slot.
- Every `__REQUIRED__` sentinel comment marks a field the factory must populate at build time.
- The CSS uses CSS variables on `:root` so `inject-theme.mjs` can rewrite them per-client.

## Validation after scaffold

After all files are written, run:
```bash
cd website-factory/templates/{niche-slug}
npm install --no-audit --no-fund
npm run build
```

Check `dist/index.html`:
- Contains every `__REQUIRED__` sentinel (proof that placeholders survived to build output, so the factory's overlay step has the right hook points)
- Contains no the website template strings (search for known the website template phrases from `website-factory/.claude/sops/10b-sop-qa.sop.md`)

If validation fails, debug and re-run.
