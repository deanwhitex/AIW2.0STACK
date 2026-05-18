---
name: extracting-brand-dna
description: "Use during Stage 7 (brand DNA extraction) of the website factory pipeline to run the five-pass synthesis that turns the client's logo, palette, typography, hero mood, and motif into a validated brand-dna.json plus extraction-report.md. Reads logo + research + copy-deck. Outputs the archetype assignment, palette, fonts, motif, hero mood, and shape_mode (sharp vs softened). Aggregate confidence below 0.7 triggers a halt for human review via /approve-brand-dna."
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
---

# design-synthesis, Stage 7 skill

## How this skill is customised

This skill defines the **universal five-pass synthesis mechanism**: logo analysis →
palette → typography → hero mood → motif. The math (WCAG contrast checks, k-means
clustering, curve-to-angle ratio) is universal.

The **niche-specific selections** come from the niche playbook:

```
templates/{active-niche-slug}/niche-playbook/design-synthesis-overrides.md
```

`design-synthesis-overrides.md` defines per niche:
- Region defaults (which regions matter for this niche, default mood per region)
- Typography roster (which fonts pair with which logo characters for this niche)
- Default motif when no clear logo signal (e.g. triangle for contractor, arc for
  hospitality, hexagon for tech)
- `shape_mode` policy for the niche (which logo descriptors map to softened vs sharp)
- Niche-specific motif vocabulary (additional keyword → motif mappings)

If the overrides file is missing, the universal defaults below are used and a low-
confidence flag is set.

---

Brand DNA extraction skill. Read this BEFORE invoking the brand-dna-agent.

This skill extracts the client's actual brand DNA from logo + research + asset analysis,
then feeds that DNA into the build (Stage 10.1) where it drives palette, typography,
hero composition, and shape-motif selection across the per-niche template.

## Inputs

- `clients/[Client Name]/Pipeline Data/research/research.json`, GBP, website, social signals
- `clients/[Client Name]/Pipeline Data/assets/logo/logo.{svg,png}`, primary brand asset
- `clients/[Client Name]/Pipeline Data/assets/photos/`, optional context images
- `clients/[Client Name]/Pipeline Data/copy/copy-deck.md`, voice and positioning signals
- `references/schemas/brand-dna.schema.json`, output validation contract
- `templates/{active-niche}/niche-playbook/design-synthesis-overrides.md`, niche overrides

## Output

- `clients/[Client Name]/Pipeline Data/brand/brand-dna.json` (validates against schema)
- `clients/[Client Name]/Pipeline Data/brand/extraction-report.md` (human-readable rationale)

## Five-pass synthesis process

Run these five passes in order. Each pass writes a section of the output and produces a
confidence score. Aggregate confidence below 0.7 triggers a halt for human review.

---

### Pass 1, Logo analysis

Open the logo SVG (or render PNG to canvas). Extract:

- **Dominant colours** via k-means clustering (k=4). Record hex values.
- **Multi-colour flag**: true if more than one non-grayscale colour present.
- **Wordmark presence**: true if a recognisable text glyph is present.
- **Motif detection**: visual inspection. Identify any recurring graphic mark (lightning
  bolt, mountain, shield, sun, etc.). Record description in one sentence for downstream
  prompt injection (hero image generation, background pattern selection).
- **Shape language signal**: measure curve-to-angle ratio across the SVG paths. Sharp =
  high angle ratio. Curved = high curve ratio. This drives `shape_mode` selection.

### Pass 2, Palette synthesis

Build a 6-token palette from logo dominants:

```
primary:    darkest non-grayscale dominant. Fall back to a neutral deep tone that passes WCAG AA against white text.
secondary:  one shade lighter than primary, lighten by 12% L*
muted:      mid-tone bridge between primary and silver
text_body:  desaturated lightened version of primary, 60% L*
silver:     near-white with primary hue, 84% L*
accent:     brightest non-primary dominant. When the logo is single-tone (no usable secondary dominant), pick a contrast-safe accent that meets WCAG AA against both light and dark text.
```

Rules:
- Primary must be dark enough that white text passes WCAG AA (contrast >= 4.5)
- Accent must be bright enough that the per-client primary used as text on the accent passes WCAG AA
- If logo accent fails contrast, generate a brightness-shifted variant
- All hex values lowercase, 6-digit, no shorthand

### Pass 3, Typography selection

Pick from the niche's locked typography roster at
`niche-playbook/design-synthesis-overrides.md`. The roster is a logo-character → font
pairing table:

| Logo character | Heading | Body |
|----------------|---------|------|
| (defined per niche; the niche playbook ships the table) | | |

The universal fallback roster (used if the niche playbook does not define one):

| Logo character | Heading | Body |
|----------------|---------|------|
| Bold condensed / geometric | Bebas Neue | Montserrat |
| Slab / heritage | Oswald | Montserrat |
| Refined / elevated | Playfair Display | Inter |
| Community / friendly | Barlow Condensed | Open Sans |
| Clean sans | DM Sans | DM Sans |
| Tech / modern | Space Grotesk | Inter |

Override only if the client has formal brand guidelines specifying alternatives.

### Pass 4, Hero mood + tagline

Match hero mood to the region. The niche playbook supplies a region table (e.g. a
contractor niche maps `florida` and `texas` to `stormy_dramatic_dusk` because of hurricane
season; a hospitality niche maps the same regions to `golden_hour_warm` because that is
what sells).

Universal fallback (used if the niche playbook does not define a region table):

| Region | Default mood |
|--------|-------------|
| default | golden_hour_warm |

If the copy-deck voice is explicitly urgent or storm-focused, prefer the niche playbook's
"urgent override mood" (typically `stormy_dramatic_dusk` or similar) regardless of region.

Generate three taglines using the company name + brand voice. Pick the strongest as
`company_tagline`. Other two go in `taglines[]` array.

### Pass 5, Motif extraction

Derive `shape_motif` from the logo `motif_description` extracted in Pass 1. This drives
the SVG decorative pattern used by sections so the site visually echoes the logo
language.

Universal keyword → motif map (case-insensitive substring match):

| Keywords | shape_motif |
|---|---|
| triangle, mountain, peak, summit, apex | triangle |
| arc, dome, arch, curve, rounded, rainbow | arc |
| chevron, V, zigzag, ridge | chevron |
| wave, ripple, flow, water, fluid | wave |
| hex, hexagon, comb, honeycomb | hex |

The niche playbook may add niche-specific keywords (e.g. contractor adds `roof, shingle`
→ `triangle`; hospitality adds `garland, vine` → `arc`).

If multiple keyword groups match, pick by the priority order in
`niche-playbook/design-synthesis-overrides.md`. If none match, default to the niche
playbook's `default_motif` (universal fallback: `triangle`).

Confidence:
- 1.0 if exactly one keyword group matched
- 0.85 if multiple matched and priority resolved cleanly
- 0.6 if no keywords matched and default applied
- Below 0.7 the pass halts with `pending_review` per the confidence rule.

---

## Shape mode picker

`shape_mode` is derived from logo shape-language keywords. Universal defaults:

- Logo description contains: organic, curved, mountain, arch, wave, rounded, soft, dome →
  `shape_mode: 'softened'` → `--radius-default: 5px` site-wide
- Logo description contains: sharp, geometric, angular, square, straight, chevron, blade
  → `shape_mode: 'sharp'` → `--radius-default: 0`
- Default when no clear signal → `sharp`

The niche playbook may override the keyword lists and the default. The CSS variable
`--radius-default` in tokens.css is the single control point. All border-radius values in
component files reference `var(--radius-default)`. Never hardcode a numeric radius in
components.

---

## Multi-colour exception list

The ONLY multi-colour elements permitted on monochrome sites:

1. Google official 4-colour G logo (review pills, footer trust)
2. Facebook official white-on-blue f (review pills, footer trust)
3. Any third-party-platform brand mark the niche playbook explicitly whitelists (e.g.
   BBB A+ blue for contractor; TripAdvisor green for hospitality)

Every other logo, icon, mascot, or graphic must be monochrome (single accent colour or
pure white). The brand-dna-agent enforces this when populating `certifications` and
`logo` fields.

---

## Validation

After all five passes, validate `brand-dna.json` against
`references/schemas/brand-dna.schema.json` using a JSON Schema validator. If validation
fails, halt with a clear error message naming the field that failed and why. Do NOT fall
back to defaults silently, the schema is the contract the build agent depends on.

## Confidence scoring

Each pass produces a 0.0–1.0 confidence:

- Pass 1 (Logo): 1.0 if SVG with clean paths, 0.7 if PNG, 0.4 if blurry
- Pass 2 (Palette): 1.0 if all WCAG checks pass, 0.5 if shifts required
- Pass 3 (Typography): 1.0 always (selection is rule-based)
- Pass 4 (Hero mood): 1.0 always (selection is rule-based)
- Pass 5 (Motif): 1.0 if single keyword match, 0.85 if priority resolved, 0.6 if defaulted

Aggregate = mean of the five. If < 0.7, write `extraction-report.md` with the gaps
flagged and halt for human review. The user runs `/approve-brand-dna` to proceed, or
edits brand-dna.json manually then runs `/approve-brand-dna --override`.
