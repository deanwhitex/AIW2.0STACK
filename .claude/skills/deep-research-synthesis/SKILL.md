---
name: deep-research-synthesis
description: Use to synthesize raw Apify dumps into the seven (eight including starter template) sub-task markdowns per niche. The Claude-side post-processing layer for Module 2B.
---

# Deep Research Synthesis

Takes raw Apify JSON dumps from `research/02-niche-research/{slug}/raw/` and produces the analyst-grade markdowns in the niche folder.

## Inputs

- `raw/agencies-search.json` and `raw/agencies-crawl.json` → produces `01-agencies.md`
- `raw/maps-reviews.json` + `raw/reddit.json` + `raw/trustpilot.json` (optional) → produces `02-customer-voice.md`
- `raw/fb-ads.json` + `raw/business-homepages.json` → produces `03-copy-patterns.md`
- `raw/cro-crawl.json` + screenshots → produces `04-cro-patterns.md`
- Cross-references all of above → produces `05-trust-signals.md`
- `raw/serp-rankings.json` + `raw/gbp-density.json` → produces `06-seo-landscape.md`
- Recipes 1 + 2 outputs → produces `07-money-math.md`
- After `/pick-niche`, synthesizes all of above → produces `08-starter-template.md`

## Synthesis rules

### Lens: end customer first

Every output answers a question about the **end customer** (the niche business's customer, not the niche business itself or the student's agency).

- Customer voice extracts verbatim phrases the end customer uses about their pain or decision.
- Copy patterns identifies what hero language gets end customers to convert.
- CRO patterns identifies what wins end-customer trust and clicks.
- Trust signals identifies what end customers want to see to feel safe.

### Verbatim over paraphrase

When pulling customer language from reviews or forum posts, quote verbatim. Include the source URL or post ID. Paraphrases lose the niche's actual voice.

### Frequency × intensity × addressability

When ranking pains, hooks, or trust signals, score on:
- Frequency: how often it appears across sources
- Intensity: how strong the language is when it does appear
- Addressability: how much a website can move the needle on it

Top items in each output need high scores on all three.

### Pattern over outlier

When analyzing competitor sites or ads, prefer the patterns that repeat across multiple winners. A single outlier hero or CTA copy line is interesting but not foundational.

## Output discipline

- Every markdown ends with a "Source traceback" section listing which raw files were used.
- Every claim cites the source. Don't say "competitors all do X" without naming which ones and pointing to the raw file.
- Mark anything inferred (vs directly observed) with `[inferred]`.

## Use of LLM judgment

The agent uses Claude itself to analyze the raw JSON. Workflow:

1. Read raw JSON (in chunks if large).
2. Generate the analysis section by section, one section at a time.
3. After each section, validate against the rules above.
4. Write the final markdown.
