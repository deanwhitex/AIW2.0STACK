---
name: local-seo
description: "Use during Stage 3 (SEO audit), Stage 5 (strategy), and Stage 10.2 (build personalisation) of the website factory pipeline to ensure every page is built to rank for local '[service/offering] in [city]' queries, Google Map Pack, and service-area domination. Defines keyword architecture for homepage, service/offering pages, and location pages plus schema markup, internal linking, citation strategy, and on-page SEO. Every page must be built to rank, not just look good."
allowed-tools:
  - Read
  - Write
  - Edit
  - WebFetch
  - WebSearch
---

# Local SEO Skill

## How this skill is customised

This skill defines the **universal local-SEO architecture**: keyword scaffolding,
on-page tags, schema patterns, location-page rules, internal linking, sitemap/robots.

The **niche-specific keyword themes, schema subtype, and average-job-value math** come
from the niche playbook:

```
templates/{active-niche-slug}/niche-playbook/seo-patterns.md
```

`seo-patterns.md` defines per niche:
- Primary keyword templates (e.g. `"[main service] [city]"` for contractor; `"boutique
  hotel [city]"` for hospitality)
- LSI keyword themes (materials/categories/sub-services that read as expertise)
- Schema subtype (`RoofingContractor`, `LodgingBusiness`, `ProfessionalService`,
  `LocalBusiness`, etc.)
- Average job/booking value for revenue-impact math in audits
- Conversion-rate baseline for the niche
- Common pitfalls or doorway-page risks specific to the niche

If `seo-patterns.md` is missing, the agent halts with a Module-2D pointer.

---

## Purpose

Ensure every website built by the factory is fully optimised for local search, targeting
"[service/offering] in [city]" queries, Google Map Pack rankings, and service-area
domination. Every page must be built to rank, not just look good.

---

## 1. Keyword architecture

### Homepage
- Primary keyword: from `niche-playbook/seo-patterns.md` template (e.g.
  `"[main service] [primary city]"`)
- Secondary keywords: niche-specific variations
- Long-tail in hero bullets: niche-specific benefit + location

### Service / offering pages
Each service from the strategy gets a dedicated page targeting:
- `[service] [primary city]` as H1
- `[service] near me` in body copy (1-2 natural mentions)
- `[service] [adjacent city]` in body copy
- LSI keywords from the niche playbook's theme list

### Location pages
Each area in `serviceAreas[]` gets a dedicated page targeting:
- `[main service] [city name]` as H1
- `[city name] [service variation]` as H2s
- **Unique content per page**, never duplicated with city name swapped (Google penalises
  thin/duplicate)

---

## 2. On-page SEO requirements

### Every page must have

```html
<title>[Primary Keyword] | [Business Name]</title>
<meta name="description" content="[Benefit-driven sentence]. [CTA]. Call [phone]." />
<link rel="canonical" href="[full URL]" />
```

### Title tag formula

| Page Type | Formula | Example pattern |
|-----------|---------|-----------------|
| Homepage | [Service] [City], [Trust Signal] \| [Business] | "[Service] [City], [Trust] \| [Brand]" |
| Service / offering | [Service] in [City], [Benefit] \| [Business] | "[Service] in [City], [Benefit] \| [Brand]" |
| Location | [Service] [City, State], [Differentiator] \| [Business] | "[Service] [City, State], [Diff] \| [Brand]" |
| Blog | [Topic], [Helpful Angle] \| [Business] | "[Topic], [Angle] \| [Brand]" |

### Meta description formula

120-155 characters. Include: primary keyword + benefit + CTA + phone.

```
"Need [service] in [city]? [Business] offers [benefit]. [Trust signal]. Call [phone] for a free [consultation/estimate/quote]."
```

### Heading hierarchy (every page)
- One H1 per page, contains primary keyword + location
- H2s for section headings with secondary keywords
- H3s for sub-sections, never skip levels

### Image SEO
- File names: kebab-case with keywords (e.g. `[service]-[primary-city].webp`)
- Alt text: descriptive, includes location naturally, NOT keyword-stuffed
- All images WebP format, compressed under 150KB
- `loading="lazy"` on everything below the fold
- Explicit `width` and `height` attributes to prevent CLS

---

## 3. Location pages (critical for service-area SEO)

### Generate one page per service area
For each city in `serviceAreas[]`, create `build/src/pages/locations/[city-slug].jsx`.

### Location page structure
```
H1: [Main Service/Offering] in [City, State]
├── Intro paragraph (UNIQUE, landmarks, neighbourhoods, local context)
├── H2: Our [Service] Services in [City]
│   └── List services available in this area
├── H2: Why [City] Locals Choose [Business Name]
│   └── Localised trust signals (projects/stays/clients completed in area, local reviews)
├── H2: Service Areas Near [City]
│   └── Internal links to adjacent location pages
├── Localised testimonial (if available)
├── CTA + inline form
├── Embedded Google Map centred on this city
└── LocalBusiness schema with this city's geo-coordinates
```

### Location page content rules
- **Minimum 400 words** of unique content per page
- Mention city name 3-5 times naturally (not stuffed)
- Reference at least one local landmark, neighbourhood, or geographic feature
- Include "near [adjacent cities]" for geo-relevance
- Link back to homepage and relevant service/offering pages
- Each page has its own unique meta title and description
- **NEVER find-and-replace city names in a template**, Google detects this instantly

### Internal linking from location pages
- Homepage (logo + breadcrumb)
- All relevant service/offering pages
- 3-5 adjacent location pages

---

## 4. Service / offering pages

### Structure
```
H1: [Service/Offering] in [Primary City]
├── Hero paragraph (problem-aware, visitor with this need lands here)
├── H2: Our [Service] Process
│   └── 3-6 step explanation
├── H2: Why Choose [Business] for [Service] in [City]
│   └── 3-5 benefit bullets
├── H2: [Service] Materials/Categories We Use (if applicable)
├── H2: [Service] Cost in [City] (visitors search this, answer it)
├── H2: Frequently Asked Questions (5-8 Q&As with FAQPage schema)
├── Before/after gallery or portfolio (if assets exist)
├── CTA + inline form
└── Service schema markup
```

### Content rules
- Minimum 600 words
- Include cost/pricing transparency (range, not exact)
- Include warranty / guarantee specifics if relevant
- FAQ section with FAQPage schema mandatory
- Internal links to relevant location pages

---

## 5. Schema markup

Inject into each page's `<head>` via React Helmet Async.

### Homepage
- Niche-appropriate `LocalBusiness` subtype (from `seo-patterns.md`) with all NAP details
- `AggregateRating` from Google review count + rating
- `areaServed` listing all service areas
- `sameAs` linking to GBP, Facebook, BBB/TripAdvisor/Houzz/etc. as the niche playbook prescribes

### Service / offering pages
- `Service` schema with `serviceType` + `provider` linking back to the homepage subtype
- `FAQPage` schema for the FAQ section

### Location pages
- `LocalBusiness` (or niche subtype) with `GeoCoordinates` for the specific city
- `areaServed` for this single city

### Blog posts
- `Article` schema with author, datePublished, image
- `BreadcrumbList` for navigation context

### All pages
- `BreadcrumbList` for nav hierarchy
- `Organization` schema in footer

---

## 6. Sitemap & robots

### sitemap.xml
Generated at build time. Lists every page with:
- `lastmod` date
- `priority`: homepage = 1.0, service/offering = 0.9, location = 0.8, blog = 0.6
- `changefreq`: homepage = weekly, services = monthly, blog = weekly

### robots.txt
```
User-agent: *
Allow: /
Sitemap: https://{domain}/sitemap.xml
```

Disallow only build artifacts and admin paths.

---

## 7. Internal linking architecture

### Link patterns (mandatory)
- Every service/offering page links to all relevant location pages
- Every location page links to all service/offering pages
- Footer links to all top-level pages
- Nav has dropdown menus for Services/Offerings and Locations

### Link anchor text
- Varied anchor text, never "click here" or "learn more"
- Include keywords naturally
- Never link multiple times to the same URL with the same anchor on one page

---

## 8. Audit framework (Stage 3, auditing the client's CURRENT site)

Score across these 7 dimensions:

### Section 1: Domain authority & trust signals
Domain rank/authority, organic keywords ranked for, estimated monthly organic traffic,
traffic trend. Plain-language 2-3 sentence summary.

### Section 2: Local keyword gaps
Identify the most valuable niche keywords they are NOT ranking for, per the niche
playbook's keyword templates. Estimate leads/bookings per month each keyword represents.

### Section 3: Competitor landscape
From research's competitor list: who is ranking above, what they have that the prospect
doesn't (reviews, backlinks, content), specific keywords where prospect is outranked.

### Section 4: Website technical audit
Title tag quality, H1 optimisation, content depth (under 300 words = thin), blog
active/stale, mobile-friendly, page speed, schema markup, internal linking structure.

### Section 5: Google Business Profile assessment
Review count vs competitors, review velocity, star rating, GBP photo count, local pack
ranking potential.

### Section 6: Content strategy gaps
Service/offering pages, location landing pages, FAQ content, before/after/portfolio
galleries, blog content.

### Section 7: Revenue impact summary
Translate everything into currency:
- Current organic leads/bookings per month
- Potential with proper SEO
- Average job/booking value (**from `niche-playbook/seo-patterns.md`**, never invent)
- Monthly revenue left on the table
- Annual revenue left on the table

Format: "You currently rank for X keywords and get approximately Y visitors/month. With
proper local SEO, businesses in your niche typically reach Z visitors/month. At a {niche-
specific conversion rate}% conversion rate, that's [N] additional leads/bookings per
month. At your average value of {currency amount}, that's {monthly amount}/month in
additional revenue."

Keep math conservative and explainable. Show the work.

---

## 9. Output formats per stage

### Stage 3 (Audit)
- `clients/[Client Name]/Pipeline Data/seo/audit-report.md`, 400-600 word professional report
- `clients/[Client Name]/Pipeline Data/seo/audit-data.json`, structured for proposal injection:
```json
{
  "domainAuthority": 0,
  "monthlyTraffic": 0,
  "page1Keywords": 0,
  "keywordGaps": 0,
  "missingKeywords": [],
  "topCompetitors": [],
  "technicalIssues": [],
  "contentGaps": [],
  "potentialLeadsPerMonth": 0,
  "currentLeadsPerMonth": 0,
  "averageJobValue": 0,
  "currency": "",
  "monthlyRevenueGap": 0,
  "annualRevenueGap": 0,
  "topPriorities": []
}
```

### Stage 5 (Strategy)
- `clients/[Client Name]/Pipeline Data/strategy/sitemap.json`, full sitemap with target
  keywords per page

### Stage 10 (Build)
- All meta tags, schema markup, location pages, service/offering pages, sitemap.xml,
  robots.txt rendered into the build

---

## 10. Forbidden patterns

- **Keyword stuffing**, natural language always
- **Doorway pages**, every page must offer real value, not just rank
- **Cloaking**, Google sees what users see
- **Duplicate content across location pages**, must be unique
- **Hidden text** for keywords
- **Buying backlinks** or PBN tactics
- **Schema on pages it doesn't apply to**, the niche subtype schema goes on the homepage,
  not on a blog post
