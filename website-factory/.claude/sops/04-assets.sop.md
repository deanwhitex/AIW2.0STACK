# 04 - Asset Scraping SOP

Implements: Stage 4.

## Niche customisation

The procedure below is the **universal mechanism** every niche follows. The
**niche-specific shot list, badge library, and category counts** come from the niche
playbook written by Module 2D:

- `templates/{active-niche-slug}/niche-playbook/asset-patterns.json`, which alt-text and
  filename patterns identify each asset category
- `templates/{active-niche-slug}/niche-playbook/photo-manifest.json`, required categories
  with minimum counts and lighting/composition notes
- `templates/{active-niche-slug}/niche-playbook/trust-signals.json`, curated badge
  library with `match_keywords` for fuzzy lookup

If any of these are missing, the agent halts with a Module-2D pointer.

## Procedure

1. Scrape `WEBSITE-SNAPSHOT.html` for the asset categories declared in
   `asset-patterns.json` (logo, portfolio/project photos, owner/host photo, hero context,
   plus any niche-specific categories). **Trust badges and people-cutouts are handled
   per the niche playbook's rules, not auto-scraped from the open web.**
2. Scrape GBP photos for additional category candidates.
3. Scrape Facebook for fallback photos.
4. **Logo handling:**
   - SVG → save directly to `assets/logo/logo.svg`
   - PNG → save to `assets/logo/logo.png` + flag for white-knockout variant
   - Missing → HALT (logo is REQUIRED)
5. **Portfolio / project photos:** target count from `photo-manifest.json`. If under
   target, write `MANUAL-DROP-NEEDED.md`.
6. **Trust badges, library lookup (NOT scraping):**
   - Load the niche playbook's badge library at
     `templates/{active-niche}/niche-playbook/trust-badges/registry.json`
   - For each cert/affiliation in `research.json.certifications`:
     - Fuzzy match against every badge's `match_keywords` (case-insensitive substring)
     - First match wins. Copy library file to `clients/[slug]/assets/badges/<badge-id>.<ext>`
     - Record match in per-client `assets/badges/manifest.json`
     - No match → log to `MANUAL-DROP-NEEDED.md` with both options (add to library OR
       drop client-only)
   - Verify the count meets `niche-playbook/trust-signals.json` → `trustStripCount`. If
     fewer, log warning.
7. **People photos** (owner / founder / host / team, categories defined by niche playbook):
   - Default people photo: scrape from website/GBP/Facebook. Save to the path the niche
     playbook prescribes (e.g. `assets/founder-photos/owner.jpg` for service businesses;
     `assets/host-photos/host.jpg` for hospitality).
   - **Subject cutout (transparent PNG)**: ALWAYS write to `MANUAL-DROP-NEEDED.md` asking
     the user to manually create a transparent-background PNG cutout. PNG required for
     alpha channel. The build does not halt on missing cutout, the hero composition
     falls back per the niche playbook's `hero-composition.md`.
8. **Hero context:** save what's found, log what's missing.
9. Write `assets/manifest.json` cataloguing every asset (filename, source, dimensions,
   alt text).

## Pass gate
- Logo present (SVG or PNG)
- Portfolio/project photos meet `photo-manifest.json` minimum OR `MANUAL-DROP-NEEDED.md` written
- All research certifications either matched against the niche's badge library or logged
- Badge count meets `trustStripCount` OR warning logged
- Subject cutout (.png) always logged in `MANUAL-DROP-NEEDED.md` (never auto-scraped)
- `assets/manifest.json` complete

## Library lookup vs. scraping rationale

Scraping manufacturer / association / affiliation brand assets from the open web is
unreliable:
- Brand owners move kits behind login walls
- Clients embed badges as decorative images in random formats
- Many badges are baked into hero images, navbars, or footer collages

The frozen library at `templates/{active-niche}/niche-playbook/trust-badges/` solves this.
New badges added through the documented flow (drop file + update registry.json).

## Why subject cutout is always manual

Cutouts require:
- Clean transparent background (alpha channel)
- Subject isolation (chest-up, no other people)
- Sufficient resolution for high-DPI displays

Almost no client websites host a cleanly-cut PNG of the subject. The closest is usually
a JPG portrait with busy background. Manual is the only reliable path until a
background-removal tool is wired into the pipeline.

## What this stage never does

- Scrape the open web for trust badges (use the niche playbook's library)
- Scrape the open web for subject cutouts
- Modify files in `templates/{active-niche}/niche-playbook/trust-badges/` (the library is
  FROZEN during client runs)
- Use stock photos for missing portfolio/project photos
- Skip the per-client manifest
