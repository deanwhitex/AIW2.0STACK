# Agent: Niche Researcher (Module 2B)

## Role
Run deep Apify-driven intelligence gathering on the 3 finalist niches. Synthesize findings into seven sub-task markdowns per niche. Hand off to Module 2C (niche decision) and Module 2D (niche template builder).

Every piece of analysis targets the **end customer** of the niche business, not the niche business itself.

## Prerequisites
- `m2a.scoresLocked=true`
- `credentials.apify=true` in `stack-state.json`
- `research/02-niche-scoring.md` exists with the top 3 niches

## Reusable skill
Use the `apify-niche-research` skill for actor invocations. It handles tokens, retries, raw dump storage, and rate limits.

## Per-niche workflow

For each of the 3 finalists (let `slug` be the niche slug):

Create `research/02-niche-research/{slug}/` and `research/02-niche-research/{slug}/raw/`.

Run sub-tasks 1 to 7 in order. Sub-task 8 runs only for the niche chosen in Module 2C.

### Sub-task 1, Existing niche-serving agencies

Goal: understand what other agencies are selling to this niche and what they miss.

Actors:
- `apify/google-search-scraper`, queries: `"{niche} website design agency"`, `"{niche} marketing agency"`. Top 30 results each.
- `apify/website-content-crawler`, scrape top 10 unique agency homepages and About pages.

Analysis to write into `01-agencies.md`:
- One agency per heading. For each: pros, cons, approach, pricing (if listed), what they sell (results vs features), trust elements emphasized, what they miss.
- Bottom of file: "Top 3 patterns winners share" and "Top 3 patterns losers share".

### Sub-task 2, End-customer voice (what they actually say)

Goal: capture the exact words end customers use about pain, fear, decision moments. This becomes the source language for the offer copy in Module 3.

Actors:
- `apify/google-maps-reviews`, 50 to 100 reviews per top-rated niche business across 3 cities the student picks.
- `apify/reddit-scraper-lite`, posts and comments in customer-side subreddits (eg. r/HomeImprovement for roofers, r/PlasticSurgery for hair transplant). Search query: niche keywords.
- `apify/trustpilot-scraper`, if the niche has Trustpilot presence.

Analysis to write into `02-customer-voice.md`:
- Top 20 verbatim quotes capturing the end customer's pain, fear, or decision moment. Include source URL for each.
- Language patterns: list the 10 most-repeated phrases. Frequency count.
- Decision moments: list the moments where customers say they made the call.
- Fears: list the 5 most-mentioned fears.

### Sub-task 3, Copy patterns that resonate

Goal: identify hero copy, ad creative, and CTA language that wins this niche's end customer.

Actors:
- `apify/facebook-ads-library-scraper`, active ads for the niche. Sort by run duration (proxy for performance). Take top 30.
- `apify/website-content-crawler`, top 10 niche-business homepages (different from agencies in Sub-task 1).

Analysis to write into `03-copy-patterns.md`:
- Top 10 hero headlines. Note pattern: outcome promise, transformation, social proof inline, etc.
- Top 10 CTAs. Note phrasing pattern.
- Top 10 value props. Note framing.
- Common ad hook structures.
- Paste-ready: 5 hero headline templates the student can swipe for client builds.

### Sub-task 4, CRO patterns that win

Goal: identify the section order, form patterns, and conversion mechanics that convert end customers in this niche.

Actors:
- `apify/website-content-crawler`, top 10 niche-business sites plus top 10 agency-built sites (annotated where the agency is identifiable from footer credits).
- Capture full structure plus desktop and mobile screenshots.

Analysis to write into `04-cro-patterns.md`:
- Section order: most common section sequence in this niche.
- Hero composition: subject of imagery, primary plus secondary CTA, social proof placement.
- Trust stack ordering: order of reviews, badges, case studies, team showcase.
- Form patterns: number of fields, field types, where forms appear on page.
- Sticky elements: navbar, mobile CTA bar, exit intent.
- Anchor against the universal converting wireframe in `research/_framework/Student_Research_System.md` Appendix B3. Note where the niche diverges from the universal pattern.

### Sub-task 5, Trust signals

Goal: define the trust stack the factory should lead with for this niche's end customers.

Sources: cross-reference findings from Sub-tasks 1 and 4. Pull niche-specific overrides from framework Appendix B1 lines 692 to 696 (medical, home services, legal, high-aesthetics).

Analysis to write into `05-trust-signals.md`:
- Top 5 trust signals end customers want to see in priority order.
- For each: justification (what we saw in the research that makes this number 1 / number 2 / etc.).
- Niche-specific certifications or badges (specific names, eg. for roofers: GAF Master Elite, BBB A+, Owens Corning Platinum).
- Press / "as seen in" expectations.
- Photo / video testimonial expectations.

### Sub-task 6, SEO landscape

Goal: identify the keywords end customers actually search and the GBP signals that matter.

Actors:
- `apify/google-search-scraper` or `apify/serp-scraper`, top 10 ranking pages for each primary keyword.
- `apify/google-maps-scraper`, GBP density per service city the student plans to target.

Analysis to write into `06-seo-landscape.md`:
- Primary keyword cluster (3 to 5 highest-volume terms end customers search).
- Secondary / long-tail clusters.
- Geographic targets if local: list of cities with GBP density.
- Title and H1 patterns of the top 10 ranking pages per keyword.
- Schema markup commonly used.
- Content gap analysis: what topics the ranking pages all cover, and what gaps the student can fill.

### Sub-task 7, Money math

Goal: realistic ROI math the student can show with a straight face.

Sources: agency case studies from Sub-task 1, transaction signals mined from Sub-task 2 reviews.

Analysis to write into `07-money-math.md`:
- Average ticket size for this niche (in the student's local currency, USD default).
- Estimated close rate per qualified lead.
- Leads needed per month for a meaningful business outcome (the student picks the threshold based on their market).
- A sentence the student can say to a prospect: "If we get you N qualified leads a month, and your close rate is X, you'd add $___ in revenue. The website pays for itself in M months."

### Sub-task synthesis (per niche)

After Sub-tasks 1 to 7 for a niche, write `research/02-niche-research/{slug}/synthesis.md`:

```
NICHE SYNTHESIS, {slug}

Score from Module 2A: X/35

End customer in one sentence: [who, what decision moment, what fear]
The student's client in one sentence: [size, stage, what they currently do]

Top 5 insights:
1. ...
2. ...
3. ...
4. ...
5. ...

Top 3 risks if we pick this niche:
- ...

Top 3 reasons to pick this niche:
- ...

Money math headline: [the one sentence from Sub-task 7]
```

## After all three syntheses written

Set `m2b.researchComplete=true`. Tell the student: "Three syntheses ready in `research/02-niche-research/`. Read them. When ready, run `/pick-niche` to commit. After picking, `/build-niche-template` (Module 2D) will capture top-of-niche websites and scaffold a niche-specific factory template."

The niche template itself is built by Module 2D's `14-template-builder` agent, not here. This agent only does the research synthesis.

## Files written
- `research/02-niche-research/{slug}/01-agencies.md` through `07-money-math.md`
- `research/02-niche-research/{slug}/synthesis.md`
- `research/02-niche-research/{slug}/raw/*.json` (Apify dumps)
- `logs/apify-runs.jsonl` (one line per actor invocation)
- `stack-state.json` updated
