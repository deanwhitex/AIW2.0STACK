# SOP, Copy Resonance via Local Social Research

## Purpose

Generate hero and body copy that resonates with the client's actual local market, what
real customers in the city are saying about pain points, brand preferences, trust signals,
and objections specific to the niche. Layer on top of Stage 6 base copy generation.

## Niche customisation

The Reddit/social query templates, the subreddit list, and the resonance extraction
schema all come from the niche playbook:

- `templates/{active-niche-slug}/niche-playbook/resonance-queries.json`, query
  templates parametrized with `{city}`, `{state}`, `{primaryService}`
- `templates/{active-niche-slug}/niche-playbook/resonance-extraction.schema.json` ,
  what fields the niche cares about (pain points, manufacturer/brand mentions, trust
  signals, objections, weather/season themes, local colour, plus niche-specific
  extensions)
- `templates/{active-niche-slug}/niche-playbook/quantified-trust-templates.md`, the
  pattern set used to derive the hero's quantified trust line

If any file is missing, the agent halts with a Module-2D pointer.

## Implementation status: SHIPPED (Phase 3+)

- `apify/reddit-scraper-lite` actor wired into `tools/apify-scrape.py` as `--actor reddit`
- `tools/extract-resonance.py` analyses raw reddit cache and emits structured
  `social-resonance.json`
- `.claude/agents/05-copy-deck.md` Step 1.5 invokes both
- `.claude/skills/copywriting/SKILL.md` documents how to consume the file

## Trigger

Runs as Step 1.5 in Stage 6 (copy-deck), after research.json is loaded but before copy
generation.

## Inputs

- `clients/[Client Name]/Pipeline Data/research/research.json`
- `clients/[Client Name]/Pipeline Data/intake/intake-form.json` (city, services/offerings, owner story)
- `clients/[Client Name]/Pipeline Data/brand/brand-dna.json` (optional, may not exist if
  Stage 6 runs before Stage 7)
- `templates/{active-niche}/niche-playbook/resonance-queries.json`
- `templates/{active-niche}/niche-playbook/resonance-extraction.schema.json`
- `templates/{active-niche}/niche-playbook/quantified-trust-templates.md`

## Outputs

- `clients/[Client Name]/Pipeline Data/copy/social-resonance.json`, extracted patterns
- Used as additional context to copy-deck-agent at Stage 6

## Process

### Step 1, Build search query set

For each `service_area` city in `research.json`, fill the query templates from
`niche-playbook/resonance-queries.json` with `{city}`, `{state}`, `{primaryService}`. The
niche playbook ships 4-8 templates per niche (e.g. service-related queries, "near me"
queries, "best in city" queries, niche-specific concern queries).

### Step 2, Run Apify Reddit scraper

For each query, target the subreddits the niche playbook lists in `resonance-queries.json`:
- City + state metro subreddits (`r/[city]`, `r/[state]`)
- Niche-relevant subreddits (defined per niche)
- General-audience subreddits the niche playbook whitelists

Limit: 50 posts + 100 comments per query (cost ~$0.10-0.15 per client, well under $2 cap).

### Step 3, Extract resonance patterns

Output JSON conforming to `niche-playbook/resonance-extraction.schema.json`. The universal
shape (every niche extends):

```json
{
  "pain_points": [],
  "brand_mentions": {},
  "trust_signals": [],
  "objections": [],
  "season_themes": [],
  "local_color": [],
  "nicheExtensions": {}
}
```

The niche playbook's schema specifies what each field means for the niche. For example,
a trade-services niche may map `brand_mentions` to manufacturer or supplier brand
frequencies; a hospitality niche may map `brand_mentions` to OTA / booking-platform
frequencies. The niche playbook defines the mapping.

### Step 4, Feed into copy-deck-agent

Pass `social-resonance.json` as additional context to Stage 6 copy generation. The
copywriting skill's niche-playbook framework defines exactly how each resonance signal
shapes which section (typically: top pain point → hero H1; top objections → sub-H1; top
trust signals → review highlights; local colour + season themes → body copy; brand
mentions filtered to those the client actually carries).

## Quantified trust line generation

The hero's quantified trust line is derived from the niche playbook's
`quantified-trust-templates.md`. The niche playbook ships 3-6 patterns ranked by
qualifying conditions on `research.json` fields (years in business, review count, job
count, etc.). The agent walks the patterns top-to-bottom and uses the first whose
conditions match.

Fall-through pattern + override path lives in the niche template's Hero component
(`deriveTrustLine()`). Override via `siteData.quantifiedTrust` if Stage 6 generates a
better one based on `social-resonance.json`.

## Pass gate
- `social-resonance.json` exists and validates against `niche-playbook/resonance-extraction.schema.json`
- Hero copy includes city in H1 OR sub-H1
- Hero `quantifiedTrust` is populated (auto-derived OR copy-deck override)
- Reviews reference at least 2 distinct trust signals
- Zero mentions of brand names the client doesn't actually carry

## Caveats

- Reddit data is biased toward complaint-heavy posts. Balance with positive-trust
  signals from Google reviews scrape (already in Stage 2).
- Don't quote Reddit posts verbatim (PII risk). Extract themes, paraphrase.
- Run only when `research.json` exists; otherwise skip with `data_confidence: low` flag.
