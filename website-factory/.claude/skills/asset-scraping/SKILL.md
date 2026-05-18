---
name: asset-scraping
description: "Use during Stage 4 (asset scraper) of the website factory pipeline to autonomously harvest the client's brand assets, logo, trust badges, project photos, owner/team photos, and any niche-specific asset categories, from their website, Google Business Profile, and linked social channels into the client Assets folder. Halts the entire pipeline if no logo is found. Uses tools/apify-scrape.py for reliable scraping; falls back to native WebFetch only on Apify failure. Never fabricates assets, only flags missing ones."
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - WebFetch
---

# Asset Scraping Skill

## How this skill is customised

This skill defines the **universal asset-harvest mechanism**: where to scrape, in what
priority order, how to validate, how to write the manifest, and what counts as a halt.

The **niche-specific specifics**, what asset categories to look for (a contractor needs
truck photos and a manufacturer badge wall; a boutique hotel needs golden-hour exteriors
and host portraits; an e-commerce brand needs product flat-lays), what alt-text patterns
to detect them by, what trust badges to match, what minimum counts to enforce, come from
the niche playbook written by **Module 2D**:

```
templates/{active-niche-slug}/niche-playbook/asset-patterns.json
templates/{active-niche-slug}/niche-playbook/photo-manifest.json
templates/{active-niche-slug}/niche-playbook/trust-signals.json
```

`asset-patterns.json` defines the alt-text and filename keywords that identify each
category. `photo-manifest.json` enumerates required categories with minimum counts and
lighting/composition notes. `trust-signals.json` lists the badges to detect with
match-keywords for fuzzy lookup.

If any of these files are missing, the agent halts with an error pointing at Module 2D.

---

## Purpose

Harvest the client's real brand assets from their owned channels so the build agent
(Stage 9) has real logos, real trust signals, real project/portfolio photos, and real
people photos to work with. Never fabricate. When something cannot be found, flag it for
manual drop.

## What gets harvested (universal categories, niche playbook can add more)

| Asset | Target folder | Required? |
|-------|--------------|-----------|
| Logo | `clients/[Client Name]/[Client Name] Assets/logo/` | YES, pipeline halts if missing |
| Trust / certification badges | `clients/[Client Name]/[Client Name] Assets/trust-badges/` | Minimum from `niche-playbook/trust-signals.json` |
| Portfolio / project / past-work photos | `clients/[Client Name]/[Client Name] Assets/project-images/` | Minimum from `niche-playbook/photo-manifest.json` |
| Owner / team / host photos | `clients/[Client Name]/[Client Name] Assets/founder-photos/` | At least 1 preferred |
| Niche-specific categories | `clients/[Client Name]/[Client Name] Assets/{category}/` | Defined per niche playbook |

## Sources to scrape (priority order)

1. **Client's own website**, homepage, about, services/offerings, portfolio/gallery, reviews
2. **Google Business Profile**, photos tab (often has people/site shots the website doesn't)
3. **Facebook Business Page**, profile/cover, photo albums
4. **Instagram** (if linked), recent grid, highlights, profile picture
5. **LinkedIn** (for owner photo specifically), if found in research
6. **Yelp / TripAdvisor / Houzz / niche-specific directories**, last resort

The agent matches each `<img>` against the alt-text and filename patterns in
`niche-playbook/asset-patterns.json` to categorise candidates.

## Image quality requirements

### Logo
- Prefer SVG → PNG → WebP → JPG
- Minimum 200×200px or 200px in any single dimension
- Save the highest-quality version found

### Trust badges
- PNG or SVG with transparent background preferred
- Filename: lowercase kebab-case (`{badge-id}.png`)
- Match against `niche-playbook/trust-signals.json` for badge identity; never invent or
  alter manufacturer/association marks

### Portfolio / project photos
- Minimum 1200×800px
- WebP or JPG
- Compress under 300KB per file but maintain visual quality
- Skip images smaller than 800×600
- Filename: descriptive kebab-case

### Owner / team / host photos
- Minimum 600×600px
- Prefer documentary-style (on-site, in-context) over chamber-of-commerce headshots when
  both available
- Filename: `owner-{firstname}-{lastname}.webp` or `team-{role}-{firstname}.webp`

The niche playbook may set stricter requirements (e.g. boutique hospitality requires
1920×1080 hero photos at golden hour; contractor requires truck photos).

## Scraping execution

### Step 1, Read research + niche patterns
- `clients/[Client Name]/Pipeline Data/research/research-data.json`, URLs, social links
- `templates/{active-niche}/niche-playbook/asset-patterns.json`, what to look for
- `templates/{active-niche}/niche-playbook/photo-manifest.json`, required counts/types
- `templates/{active-niche}/niche-playbook/trust-signals.json`, badge lookup table

Halt if any niche playbook file is missing.

### Step 2, Scrape client's website
Use Playwright to visit homepage, about, services, gallery, contact, reviews. Extract every
`<img>` with `src`, `alt`, and dimensions. Categorise per `asset-patterns.json`.

### Step 3, Hit GBP / social channels
Playwright with stealth settings. Respect rate limits (1 request per 2 seconds for social).
Scroll loops where needed to load all photos.

### Step 4, Categorise, validate, save
- Move accepted images to their target folders
- Rename per the niche playbook's filename convention
- Generate `manifest.json` in each folder

```json
{
  "logo": [
    {
      "filename": "logo.svg",
      "source": "https://example.com/wp-content/uploads/logo.svg",
      "dimensions": "240x80",
      "format": "svg"
    }
  ]
}
```

### Step 5, Trust badge library lookup (when applicable)
If the niche playbook ships a curated badge library at `niche-playbook/trust-badges/` with
a `registry.json` of `match_keywords`, fuzzy-match the client's detected certifications
against the registry. First match wins. Copy the library badge into the client's badges
folder. Record matches in the per-client `assets/badges/manifest.json`.

Niches that don't have a curated library scrape badges directly from the client's website
and manufacturer/association brand kits.

### Step 6, Flag gaps
For each category below minimum count from `photo-manifest.json`, create
`MANUAL-DROP-NEEDED.md` in that folder with explicit instructions and source suggestions.

### Step 7, Logo absence = HALT
If no logo found:
- Write `MANUAL-DROP-NEEDED.md` in `logo/`
- Update `pipeline-state.json` → `stages.asset_scraping.passed = false`
- Halt the pipeline

Stage 9 (hero generation) and Stage 10 (build) require a logo.

### Step 8, Pipeline state
Update `logs/pipeline-state.json`:

```json
{
  "stages": {
    "asset_scraping": {
      "passed": true,
      "timestamp": "ISO",
      "found": {
        "logo": 1,
        "trustBadges": 4,
        "projectImages": 12,
        "founderPhotos": 2
      },
      "manualDropNeeded": []
    }
  }
}
```

## Failure modes

| Scenario | Action |
|----------|--------|
| Niche playbook files missing | Halt; point user at Module 2D |
| Robots.txt blocks scraping | Fall back to public sources (GBP, social). Log the block. |
| Site is JavaScript-heavy SPA | Use Playwright with full render + wait for network idle |
| Image hot-link protection | Try direct URL fetch with referer header; if still blocked, screenshot the page region and crop |
| Captcha on social sites | Skip that source; flag in manifest |
| Logo found but low-res only | Save what you have; note in manifest "low-res, recommend manual upgrade" |
| No portfolio photos anywhere | Write `MANUAL-DROP-NEEDED.md`; allow pipeline to proceed (gallery falls back to placeholders that get flagged in QA) |

## Ethical considerations

- Respect copyright. Only scrape from the client's owned channels (their site, their
  social, their GBP).
- Manufacturer / association certification badges are explicitly authorised for use by
  certified members, those are safe.
- Stock photos from third-party sites are NOT okay to scrape, use only client-owned
  content.

## What this skill is NOT

- Not the hero image generator (that's Stage 9 with `nano-banana`)
- Not the design synthesiser (Stage 7)
- Not responsible for image editing, pipeline takes assets as-is
