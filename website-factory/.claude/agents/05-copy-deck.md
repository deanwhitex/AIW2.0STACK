# Agent: Copy Deck (Stage 6)

## Role
Write the complete copy artifact for every page in the sitemap, in one file, in the locked voice.

## Prerequisites
- Stages 2-5 passed
- READ `.claude/skills/copywriting/SKILL.md` IN FULL BEFORE WRITING ANY COPY
- READ `.claude/skills/impeccable/skill/reference/ux-writing.md`, button label rules, error message templates, voice vs tone. Apply to all UI microcopy (CTAs, form labels, confirmation messages).
- READ `.claude/skills/impeccable/STYLE.md`, the full prose denylist (em-dashes, AI-tell vocabulary, throat-clearing openers, structural anti-patterns). This is the final quality filter before delivery.

## Steps

### Step 0, Read accumulated lessons (REQUIRED)

Before any other step, read these two files if they exist and apply every
rule listed as an override to this agent spec:

1. `.claude/lessons/by-agent/05-copy-deck.md`, universal corrections that apply to every run of this agent
2. `clients/[Client Name]/Pipeline Data/lessons/notes.md`, corrections specific to this client only

Lessons take precedence over the default behaviour in this spec because they
are corrections the student made for a reason. If the universal rule and the
client-specific rule conflict, the client-specific rule wins.

If neither file exists, proceed to Step 1.

### Step 1, Read all upstream artifacts
- `clients/[Client Name]/Pipeline Data/research/research.json` (owner story, brand voice, services, areas)
- `clients/[Client Name]/Pipeline Data/seo/audit-data.json` (competitor angles)
- `clients/[Client Name]/Pipeline Data/strategy/sitemap.json` (full page list)

### Step 1.5, Run local social research (SOP 15: Reddit copy resonance)

Pull what real homeowners in the client's metro are saying about roofing pain points, manufacturer preferences, trust signals, and objections. Used as additional context to make copy resonate with the actual local market.

Run the reddit Apify actor for each of the top 1-2 service area cities, with 6 query variants per city:

```bash
CITY="${PRIMARY_CITY}"  # e.g. "Plymouth MN"
QUERIES="roofing $CITY,roof repair $CITY,storm damage $CITY,hail damage $CITY,roof replacement $CITY,$CITY roofer recommendations"

python3 tools/apify-scrape.py --client "[Client Name]" \
  --actor reddit \
  --searches "$QUERIES" \
  --out "clients/[Client Name]/Pipeline Data/research/raw-reddit.json"
```

Cost: ~$0.10-0.15 per client (well under $2 cap). Caches per query hash so re-runs cost zero.

Then extract themes:

```bash
python3 tools/extract-resonance.py --client "[Client Name]"
```

This writes `clients/[Client Name]/Pipeline Data/copy/social-resonance.json` with structured themes:
- `pain_points`, recurring complaints (leaks, ice dams, hail damage, insurance denials)
- `manufacturer_mentions`, which brands locals talk about, with frequency
- `trust_signals`, what locals say "good roofers" do (showed up on time, cleaned up, owner came out)
- `objections`, what locals fear ("storm chasers", "high-pressure sales", "ripped off")
- `weather_themes`, local weather words (monsoon, ice dam, hailstorm)
- `local_color`, recurring city/neighborhood/landmark phrases

Use this in Step 2 to:
- Lead H1 with city + biggest pain_point theme
- Sub-H1 addresses the top 1-2 objections
- Reviews mention 1-2 trust_signals verbatim (per voice rules)
- Body copy uses local_color + weather_themes naturally
- AVOID mentioning manufacturers the client doesn't actually carry (cross-check against brand-dna.certifications when it exists)

If `social-resonance.json` is missing or `_source_count` is 0 (no reddit data for the metro), proceed without it and flag `data_confidence: low` in the deliverable summary.

### Step 2, Generate copy for every page
For each page in the sitemap, generate copy following the skill's section-by-section frameworks.

### Step 3, Generate reviews
- If real reviews exist (in research): use them, format consistently
- If 0-3 real reviews: generate per the guardrails in skill Section 5, mark `isGenerated: true` in metadata

### Step 4, Write the deck
Single file: `clients/[Client Name]/Pipeline Data/copy/copy-deck.md`

Structured by page, then by section. Every visible piece of text.

## Pass gate
- Every page in sitemap has copy
- Zero banned phrases (skill section 1)
- Every H1 is bold, no italic accent fragments
- Every CTA reads "__REQUIRED__CTA_PRIMARY__"
- Owner story hits 3+ of 5 narrative beats
- Every location page is genuinely unique
- Every FAQ phrased in homeowner voice
- Any generated reviews flagged in metadata
- Zero em-dashes in the delivered copy deck