# Agent: Brand Resonance (Stage 7.5, template-approach branch)

## Role

OPTIONAL stage. Enriches `brand-dna.json` with signals from the client's
existing website + GBP + Facebook presence. Specifically extracts:

- Dominant colors observed on the live site (Pillow color quantization)
- Computed heading + body fonts (Playwright `page.evaluate(getComputedStyle)`)
- Hero photo style hint (largest above-the-fold image: dimensions, aspect)
- Section vocabulary (h1/h2 text + landmark roles)
- Apify GBP scrape (hours, rating, review count, photos, posts)
- Apify Facebook scrape (page intro, recent posts)
- Optional Claude Vision API call on the desktop screenshot, returns a
  voice_description, photo_style_note, and `theme_mode_recommendation`
  ("light" | "dark")

Output: `clients/[X]/Pipeline Data/brand-resonance/resonance.json`. Stage 7
brand-dna-agent reads `theme_mode_recommendation` to set `brand-dna.theme_mode`.
Defaults to "light" if Stage 7.5 was skipped or the field is missing.

This stage is OPTIONAL. The pipeline runs cleanly without it. Stage 10.1's
`compose_brand_dna()` reads `resonance.json` if present and ignores it if not.

## Prerequisites

- Stage 1 (intake) complete with `intake-form.json` containing the client's existing website URL (and optionally GBP / Facebook URLs)
- `.env` at repo root with `APIFY_API_TOKEN` set (optional; without it the Apify scrapers skip and only the Playwright + Pillow analysis runs)
- `.env` at repo root with `ANTHROPIC_API_KEY` set (optional; without it the Claude Vision call skips and `theme_mode_recommendation` is derived from dominant color brightness)
- Required Python: Pillow + playwright + anthropic (`pip install Pillow playwright anthropic && playwright install chromium`)

## Steps

### Step 0, Read accumulated lessons (REQUIRED)

Before any other step, read these two files if they exist:

1. `.claude/lessons/by-agent/07-5-brand-resonance.md`
2. `clients/[Client Name]/Pipeline Data/lessons/notes.md`

### Step 1, Run the resonance tool

```bash
python3 tools/old-site-resonance.py --client "[Client Name]"
```

Optional flags:
- `--no-apify`, skip Apify scrapers (faster iteration, useful when API key is unavailable)
- `--no-vision`, skip Claude Vision call (still derives `theme_mode_recommendation` from dominant color brightness)
- `--url-override URL`, analyse a specific URL instead of the intake-form.json website field

The script:
1. Reads `intake-form.json` for the website URL. If missing, writes
   `resonance.json` with `skipped: true` and exits 0.
2. Runs Apify actors (google-places, facebook, website) via `tools/apify-scrape.py`
3. Runs Playwright headless: full-page screenshots at 1440x900 + 375x812,
   computed body/h1 fonts, hero image dimensions, h1/h2 vocabulary,
   landmark sections
4. Runs Pillow color quantization on the desktop screenshot, top 8 colors
5. (Optional) Sends the desktop screenshot + extracted signals to Claude
   Vision (claude-sonnet-4-6), parses the JSON reply, extracts
   voice_description + photo_style_note + theme_mode_recommendation
6. Writes `clients/[X]/Pipeline Data/brand-resonance/resonance.json`
7. Updates `pipeline-state.json` (`stage_7_5: complete`)

### Step 2, Verify output

The agent confirms:
- `clients/[X]/Pipeline Data/brand-resonance/resonance.json` exists and is non-zero
- The `theme_mode_recommendation` field is set to "light" or "dark" (or absent if `skipped: true`)

### Step 3, Update pipeline state and log

Append to `clients/[X]/Pipeline Data/logs/build-log.md`:

```
## Stage 7.5, brand resonance
Status: complete | skipped
Theme mode recommendation: {value}
Voice description: {value}
Photo style note: {value}
Output: clients/[X]/Pipeline Data/brand-resonance/resonance.json
```

## Output structure

```json
{
  "captured_at": "2026-05-11T12:34:56+00:00",
  "client": "Acme Roofing",
  "url": "https://www.acmeroofing.com",
  "skipped": false,
  "apify_gbp": { /* compass~crawler-google-places result */ },
  "apify_facebook": { /* apify~facebook-pages-scraper result */ },
  "apify_website": { /* apify~website-content-crawler result */ },
  "visual": {
    "url": "...",
    "fonts": { "body": "Inter, sans-serif", "heading": "Oswald, Impact, sans-serif" },
    "vocabulary": {
      "headings": ["WELCOME TO ACME", "OUR SERVICES", ...],
      "sections": ["main", "footer", ...]
    },
    "hero_style": { "src": "...", "width": 1920, "height": 1080, "aspect_ratio": 1.78 },
    "screenshot_desktop": "clients/Acme Roofing/Pipeline Data/brand-resonance/screenshots/old-site-desktop.png",
    "screenshot_mobile": "clients/Acme Roofing/Pipeline Data/brand-resonance/screenshots/old-site-mobile.png",
    "dominant_colors": [
      { "hex": "#0F172A", "rgb": [15, 23, 42], "weight": 0.32 },
      { "hex": "#FFFFFF", "rgb": [255, 255, 255], "weight": 0.28 },
      ...
    ]
  },
  "voice_description": "Direct, family-led, confident without being aggressive. ...",
  "photo_style_note": "Warm, daylight, suburban project photos with clean composition.",
  "theme_mode_recommendation": "light"
}
```

## Failure handling

| Failure | Action |
|---------|--------|
| No website URL in intake | Write `skipped: true`, exit 0, do not block downstream stages |
| Playwright not installed | Write partial resonance with `visual.skipped: true`, continue |
| Apify token missing | Skip Apify scrapers, continue with Playwright + Pillow only |
| Anthropic key missing | Skip Claude Vision, derive `theme_mode_recommendation` from dominant color brightness (avg RGB < 128 = dark, else light) |
| Old site is paywalled / 403 | Playwright nav fails, partial resonance written, do not block |
| Claude Vision returns non-JSON | Log the response, continue without voice/photo/theme fields |

## Output gate

Stage 7 brand-dna-agent reads `resonance.json` (if present) at its Step 3.5
to set `brandDNA.theme_mode`. Stage 10.1's `compose_brand_dna()` also reads
it for additional voice + photo style context.

## What this agent unlocks

Without Stage 7.5, brand-dna.theme_mode defaults to "light" and the pipeline
runs fine. With Stage 7.5, the theme_mode is informed by what the client's
current site actually looks like, and Stage 6 copy generation can be tuned
to match the observed brand voice (when copy-deck-agent reads the
voice_description).
