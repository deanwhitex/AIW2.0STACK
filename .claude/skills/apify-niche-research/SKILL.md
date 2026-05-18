---
name: apify-niche-research
description: Use when running Module 2B deep niche research. Six pre-built Apify actor recipes parameterized by niche slug. Handles tokens, retries, raw dump storage, rate limits, and cost logging.
---

# Apify Niche Research

The toolkit for Module 2B's Apify-driven intelligence gathering. Each recipe is a pre-built actor call with the right input shape, output paths, and post-processing hooks.

## Token

Reads `APIFY_TOKEN` from `.env.local`. Refuse to run if missing.

## Cost logging

Every actor run appends one JSON line to `logs/apify-runs.jsonl`:

```
{"timestamp":"ISO","actor":"apify/google-search-scraper","input":{...},"runId":"...","cost_usd":0.07,"duration_s":42,"output_path":"research/02-niche-research/{slug}/raw/agencies-search.json"}
```

Total cost per niche pass should land between $1 and $2. Stop and ask the student before continuing if the niche is approaching $5.

## Recipe 1: Niche-serving agencies

Actor: `apify/google-search-scraper`

Queries to run per niche:
- `"{niche} website design agency"`, top 30 results
- `"{niche} marketing agency"`, top 30 results
- `"best {niche} website examples"`, top 20 results

Output: `research/02-niche-research/{slug}/raw/agencies-search.json`

Follow-up actor: `apify/website-content-crawler` on the top 10 unique agency URLs:
- maxRequestsPerCrawl: 5 per domain (homepage, about, services, pricing, case studies)
- saveHtml: true
- removeElementsCssSelector: standard cookie/nav/footer cleanup

Output: `research/02-niche-research/{slug}/raw/agencies-crawl.json`

## Recipe 2: End-customer voice

Actor 1: `apify/google-maps-reviews`

Inputs:
- 3 to 5 of the top-rated niche businesses in 3 different cities (15 to 25 places total)
- maxReviewsPerPlace: 50
- reviewsSort: "newest"
- language: "en"

Output: `research/02-niche-research/{slug}/raw/maps-reviews.json`

Actor 2: `apify/reddit-scraper-lite`

Inputs:
- subreddits: niche-specific customer subreddits (eg. for roofers: r/HomeImprovement, r/InsuranceClaims, r/RealEstate; ask the student to confirm which apply)
- searches: niche keywords (eg. "roof replacement", "roof repair", "insurance claim roof")
- maxItems: 200 posts + comments

Output: `research/02-niche-research/{slug}/raw/reddit.json`

Actor 3: `apify/trustpilot-scraper` (optional, run if the niche has Trustpilot presence)

## Recipe 3: Copy patterns

Actor 1: `apify/facebook-ads-library-scraper`

Inputs:
- searchTerms: niche keywords + niche brand names from Recipe 1
- adType: "ALL"
- country: student's country
- maxItems: 100 active ads, sorted by run duration desc

Output: `research/02-niche-research/{slug}/raw/fb-ads.json`

Actor 2: `apify/website-content-crawler` on top 10 niche-business homepages (not agencies, the actual businesses)
- maxRequestsPerCrawl: 2 (homepage + one secondary page)
- saveHtml: true

Output: `research/02-niche-research/{slug}/raw/business-homepages.json`

## Recipe 4: CRO patterns

Same as Recipe 3 Actor 2, but extended:
- maxRequestsPerCrawl: 5 (homepage, services, about, contact, one service detail page)
- screenshots: enable both desktop and mobile

Output: `research/02-niche-research/{slug}/raw/cro-crawl.json` + screenshots in `raw/screenshots/`

## Recipe 5: Trust signals

No Apify actor. Pure synthesis: cross-references Recipes 1 and 4 outputs. The synthesis step looks for repeated certs, badges, association memberships, awards, press mentions.

## Recipe 6: SEO landscape

Actor 1: `apify/google-search-scraper`

Queries:
- Primary niche keywords (3 to 5 terms, eg. "roof replacement", "roofer near me", "best roofer {city}")
- For each: take top 10 ranking URLs

Output: `research/02-niche-research/{slug}/raw/serp-rankings.json`

Actor 2: `apify/google-maps-scraper`

Inputs:
- searches: "[niche] near me" in 3 target cities
- maxItems: 20 per city

Output: `research/02-niche-research/{slug}/raw/gbp-density.json`

Actor 3 (optional): `apify/google-keyword-planner-scraper` if available (requires Google Ads account). Falls back to SERP-only analysis if unavailable.

## Recipe 7: Money math (no Apify)

Pulls from Recipes 1 and 2 outputs. The Claude-side synthesis step reads case studies (Recipe 1 outputs) and review-mined transaction signals (Recipe 2 outputs) to compute ticket size and ROI math.

## Invocation pattern

```bash
# Run an actor via the apify CLI (preferred over raw HTTP if installed)
apify call apify/google-search-scraper --token "${APIFY_TOKEN}" --input-file /tmp/input.json --output-file research/02-niche-research/{slug}/raw/agencies-search.json
```

Or via HTTP:
```bash
curl -X POST "https://api.apify.com/v2/acts/apify~google-search-scraper/run-sync-get-dataset-items?token=${APIFY_TOKEN}" \
  -H "Content-Type: application/json" \
  -d @/tmp/input.json \
  > research/02-niche-research/{slug}/raw/agencies-search.json
```

After every successful run, append a line to `logs/apify-runs.jsonl` with timestamp, actor, input summary, output path, and cost.

## Retries and rate limits

- 3 retries with exponential backoff (10s, 30s, 90s) on 429 or 5xx.
- If an actor errors permanently, log it, skip to the next recipe, and report at the end: "Recipe N failed for {niche}. Reason: X. Re-run with `/research --retry-only {niche},{recipe}`."

## Stop conditions

Halt and ask the student if any of:
- Total cost for one niche exceeds $5.
- An actor returns zero results for a query (likely the niche term is too narrow).
- The student's Apify account hits its rate limit.
