# Agent: Strategy & Sitemap (Stage 5)

## Role
Generate the full sitemap with target keywords for every page.

## Prerequisites
- Stages 2-4 passed
- READ `.claude/skills/seo/SKILL.md`

## Steps

### Step 0, Read accumulated lessons (REQUIRED)

Before any other step, read these two files if they exist and apply every
rule listed as an override to this agent spec:

1. `.claude/lessons/by-agent/04-strategy.md`, universal corrections that apply to every run of this agent
2. `clients/[Client Name]/Pipeline Data/lessons/notes.md`, corrections specific to this client only

Lessons take precedence over the default behaviour in this spec because they
are corrections the student made for a reason. If the universal rule and the
client-specific rule conflict, the client-specific rule wins.

If neither file exists, proceed to Step 1.

### Step 1, Read upstream artifacts
- `clients/[Client Name]/Pipeline Data/research/research.json`
- `clients/[Client Name]/Pipeline Data/seo/audit-data.json`

### Step 2, Build sitemap.json
Write to `clients/[Client Name]/Pipeline Data/strategy/sitemap.json` with this structure:

```json
{
  "core_pages": [
    { "slug": "/", "page_title": "...", "h1": "...", "meta_description": "...", "target_keyword": "...", "est_monthly_searches": 0, "content_notes": "..." }
  ],
  "service_pages": [...],
  "location_pages": [...],
  "blog_posts": [...],
  "utility_pages": [
    { "slug": "/about" }, { "slug": "/contact" }, { "slug": "/gallery" }, { "slug": "/reviews" }, { "slug": "/financing" }
  ],
  "services": [...],
  "locations": [...],
  "page_count": 0,
  "seo_priorities": [...],
  "content_strategy": {
    "blog_frequency": "2 posts per month",
    "content_themes": [...],
    "schema_types": [...]
  },
  "internal_linking_strategy": "..."
}
```

### Step 3, Apply requirements
- Always include 5 utility pages (Home, About, Contact, Gallery, Reviews, Financing)
- Min 4 service pages, max 8
- Min 5 location pages, max 12
- Suggest 6 blog posts using the patterns from copywriting skill
- 5 specific SEO priorities ranked by impact

### Step 4, Write strategy summary
Write `clients/[Client Name]/Pipeline Data/strategy/strategy.json` with:
- target_market, positioning, differentiators
- primary_keywords, secondary_keywords
- competitor_gaps (from audit-data.json)

## Pass gate
- `sitemap.json` and `strategy.json` both written
- 5+ location pages
- 4+ service pages
- All slugs lowercase with hyphens
- Every meta description 150-160 chars
- Every page has a target keyword