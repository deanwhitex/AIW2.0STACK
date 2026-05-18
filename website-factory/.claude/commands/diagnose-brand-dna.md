# /diagnose-brand-dna

Inspects a client's brand-dna.json and reports confidence scores,
missing fields, schema violations, and downstream risks before
Stage 9 or Stage 10.1 run.

## Usage

```
/diagnose-brand-dna
/diagnose-brand-dna --client=example-roofing
```

## What this command does

1. Reads `clients/[Client Name]/Pipeline Data/brand/brand-dna.json`
2. Validates against `references/schemas/brand-dna.schema.json`
3. For each field, reports:
   - Present / missing
   - Confidence signal (inferred vs confirmed)
   - Downstream stage that depends on it
4. Checks for known risk patterns:
   - Palette extracted from PNG logo (lower confidence than SVG)
   - Google review count set to 0 (build-agent will render 0 stars in ReviewPill)
   - Empty founder bio (Stage 6 copy will have no personal story)
   - Financing enabled = false when a financing page exists on the site
   - Certifications all false despite badge assets being present
5. Prints a prioritised fix list

## Output format

```
BRAND DNA DIAGNOSIS: [client_slug]
Schema valid: YES / NO (list violations)

Field                   Status      Confidence  Downstream risk
---------------------------------------------------------------
palette.primary         PRESENT     HIGH        Stage 10.1 tokens
palette.accent          PRESENT     HIGH        Stage 10.1 tokens
google_rating           MISSING     -           ReviewPill renders 0.0
founder.photo_path      PRESENT     -           Stage 10.1 Founder section
founder.story_para_1    EMPTY       -           Stage 6 copy will be generic
...

PRIORITY FIXES BEFORE PROCEEDING:
1. Confirm google_rating + google_review_count from GBP
2. Supply founder story before Stage 6
```

## Does not modify any files.
