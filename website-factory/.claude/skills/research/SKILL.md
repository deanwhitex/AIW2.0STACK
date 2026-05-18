---
name: client-research
description: "Use during Stage 2 of the website factory pipeline to autonomously harvest Google Business Profile, all reviews, owner profile, services/offerings, service areas, competitor landscape, brand identity signals, business model, niche-specific certifications, special offers, financing/pricing, and trust signals into research-report.md plus research.json. Read in full before invoking the research-agent. Output is the spine that every downstream stage reads. Uses tools/apify-scrape.py for reliable scraping (Google Places + Facebook + website crawl + Instagram + niche-specific directories)."
allowed-tools:
  - Read
  - Write
  - Edit
  - Bash
  - WebFetch
  - WebSearch
---

# Client Research Skill

## How this skill is customised

This skill defines the **universal research-data.json shape and the universal scrape
mechanism**. Every niche needs the same core fields: business name, owner, address,
service areas, reviews, social URLs, competitor landscape.

The **niche-specific extensions**, which certifications/affiliations matter, which
discount audiences are common, which financing/pricing patterns exist, which directories
to search (BBB for contractors; TripAdvisor / The Knot for hospitality; Houzz for
designers; etc.), which signal patterns indicate business model and market segment ,
come from the niche playbook:

```
templates/{active-niche-slug}/niche-playbook/research-extensions.md
templates/{active-niche-slug}/niche-playbook/research-extensions.schema.json
```

`research-extensions.md` is a markdown brief Module 2D writes describing what additional
fields and signal patterns to look for. `research-extensions.schema.json` extends the
universal `research-data.schema.json` with niche-specific fields that get nested under
`research-data.json.nicheExtensions.{slug}`.

If the niche extension files are missing, the agent halts with a Module-2D pointer.

---

# Purpose

Produce the complete research artifact that every downstream stage depends on. The audit
reads it. The asset scraper reads it. The strategy reads it. The copy deck reads it. The
template matcher reads it. The hero image reads it. The proposal reads it. **This is the
spine of the pipeline.** Be thorough.

# Outputs (two files)

### `clients/[Client Name]/Pipeline Data/research/research-report.md`

Long-form narrative report. The universal sections (always present):

1. Business Overview
2. Services / Offerings
3. Service Areas / Geography
4. Owner / Founder / Host Profile
5. Vision, Mission & Values
6. Brand Identity Signals
7. Brand Voice & Copy Tone Analysis
8. Business Model & Market Segment
9. Reviews & Reputation
10. Trust & Certification Signals
11. Competitor Landscape
12. Tech Stack & Current Site Assessment
13. Differentiators & Unique Story Hooks

The niche playbook may add or rename sections (e.g. hospitality adds "Occupancy & Seasonality";
contractor renames "Services" to "Services Offered"). The agent applies the niche playbook's
section overlay after writing the universal sections.

### `clients/[Client Name]/Pipeline Data/research/research-data.json`

Structured payload for downstream agents. Universal shape:

```json
{
  "businessName": "",
  "websiteUrl": "",
  "phone": "",
  "phoneNormalised": "",
  "email": "",
  "yearFounded": "",
  "yearsInBusiness": 0,

  "ownerName": "",
  "ownerBio": "",
  "ownerLinkedIn": "",
  "ownerValues": [],
  "visionStatement": "",
  "missionStatement": "",

  "primaryCity": "",
  "state": "",
  "fullAddress": "",
  "serviceAreas": [],

  "primaryService": "",
  "services": [],
  "businessModel": {
    "primaryFocus": "",
    "secondaryFocus": ""
  },
  "marketSegment": {
    "primaryFocus": "",
    "secondaryFocus": ""
  },

  "googleReviewCount": 0,
  "googleRating": 0.0,
  "googleReviewUrl": "",
  "facebookReviewCount": 0,
  "facebookRating": 0.0,
  "facebookUrl": "",
  "thirdPartyReviews": {},

  "certifications": [],

  "specialOffers": {
    "items": [],
    "discountAmount": ""
  },

  "pricing": {
    "model": "",
    "lowEnd": null,
    "highEnd": null,
    "currency": "",
    "termsDescription": ""
  },

  "brandGuidelines": {
    "hasFormalGuide": false,
    "guideFilePath": "",
    "lockedColors": {},
    "lockedFonts": {},
    "lockedTagline": "",
    "lockedVoiceRules": []
  },

  "competitors": [],
  "brandVoice": "",
  "brandVoiceTags": [],
  "primaryColorGuess": "",
  "secondaryColorGuess": "",
  "tagline": "",
  "logoStyle": "",
  "hasMascot": false,
  "mascotDescription": "",
  "techDifferentiators": [],
  "uniqueStoryHooks": [],
  "techStack": "",
  "currentSiteIssues": [],

  "nicheExtensions": {}
}
```

`nicheExtensions.{slug}` contains the niche-specific fields the niche playbook adds. For
example, a contractor playbook adds `nicheExtensions.contractor.manufacturerCerts`,
`nicheExtensions.contractor.businessModel.retail/insurance`, and `nicheExtensions.contractor.specialOffers.veterans/seniors/firstResponders`. A hospitality playbook adds `nicheExtensions.hospitality.occupancyPattern`, `nicheExtensions.hospitality.weddingEnabled`,
`nicheExtensions.hospitality.directBookingFlag`.

# Step-by-step execution

### Step 1, Read niche extension
Load `templates/{active-niche}/niche-playbook/research-extensions.md` to learn what
additional signals to detect, what directories to search, what brand-archetype tags apply.
Halt if missing.

### Step 2, Fetch the client's website
Playwright (mobile + desktop) capture: full HTML of homepage, all H1/H2/H3, all phone
numbers, all emails, address, services/offerings, social links, review widgets, tech
stack signals, page load timing, mobile responsiveness, blog presence + last post date,
image alt text, schema markup. Save raw HTML and screenshots.

### Step 3, Crawl internal pages (depth 1)
About, services/offerings, contact, reviews, blog index, careers/team. Extract title,
H1, word count, key phrases per page. Save to `internal-pages.json`.

### Step 4, Google Business Profile lookup
Web search: `"{businessName}" "{primaryCity}" Google Business Profile site:google.com`.
Extract verified address, service area, categories, years in business, review count, star
rating, photo count, hours, direct review-tab URL.

### Step 5, Facebook lookup
Web search: `"{businessName}" Facebook reviews`. Extract URL, review count, rating, post
cadence.

### Step 6, Third-party directory lookups
For each directory the niche playbook lists in `research-extensions.md` (BBB,
TripAdvisor, The Knot, Houzz, Angi, Yelp, etc.), web-search and extract: profile URL,
rating, review count, accreditation/membership status, years listed. Populate
`thirdPartyReviews` with one entry per directory.

### Step 7, Owner / founder / host identification
Web searches in this order:
1. `"{businessName}" owner founder`
2. `"{businessName}" "about us"`
3. `"{businessName}" CEO president host`
4. `"{businessName}" LinkedIn`

Extract: full name, bio/background, years in the niche, family/military/heritage/local
angles, LinkedIn URL, photo URL.

Look explicitly for verbatim vision/mission/values text and capture exactly as written.

### Step 8, Service area discovery
Combine website "service areas"/"locations" pages + GBP service area + footer cities +
schema `areaServed`. Output a clean array with primary city flagged, state, approximate
population.

### Step 9, Competitor identification
Web search for top local competitors using the niche playbook's keyword templates. Extract
top 5 per niche-relevant query. For each: business name, website, review count, star
rating, years in business, notable differentiator.

### Step 10, Brand identity + voice signals
From website + visible asset photos + social media:
- Primary brand colour (best guess from homepage hero/logo dominant)
- Secondary brand colour
- Tagline if present
- Logo style: `wordmark | mascot | monogram | emblem | icon-with-text | script`
- Has mascot? Mascot description if present
- Brand voice across: tone, formality, confidence, local emphasis, heritage emphasis
- 2-3 sentence brand voice summary; 3-5 brand voice keywords

### Step 11, Niche-specific signal extraction
Apply the patterns from `research-extensions.md` to detect niche-specific signals.
Populate `nicheExtensions.{slug}` with the structured payload defined in
`research-extensions.schema.json`.

For example:
- Contractor niche: manufacturer certifications (GAF/CertainTeed/etc.), business model
  (retail/insurance/both), market segment (residential/commercial/both), special-audience
  discounts (seniors/veterans/first-responders), financing (0% available, providers).
- Hospitality niche: occupancy pattern (year-round/seasonal), wedding-enabled flag,
  direct-booking flag, accommodation types, capacity, dining/spa amenities.
- E-commerce niche: product categories, free-shipping threshold, return policy, brand-
  archetype signals.

Never fabricate. Each detected field must point at a real source (URL or fetched-from-page).

### Step 12, Brand guidelines check
Check `clients/[Client Name]/Pipeline Data/brand-guidelines/` for a user-supplied brand
kit. The intake `optionalOverrides.brandGuidelinesPath` may also point to a file. If
present, extract locked colours, fonts, tagline, voice rules. A formal brand guide always
wins over inference.

### Step 13, Tech stack lightweight assessment
CMS detected, HTTPS, schema markup presence, sitemap.xml/robots.txt presence, mobile
viewport tag. Stage 3 does the deep audit.

### Step 14, Compile + log
Assemble `research-report.md` with all universal + niche-overlay sections. Assemble
`research-data.json` with universal fields + populated `nicheExtensions.{slug}`.

Append to `logs/build-log.md`:
```
[ISO_TIMESTAMP] Stage 2 (Research), PASSED, {businessName}
  - Years in business: X
  - Service areas: N cities
  - Google reviews: X (rating Y)
  - Niche signals: {niche-specific summary from research-extensions}
  - Has mascot: yes/no
  - Brand guide supplied: yes/no
  - Brand voice: [summary]
```

Update `pipeline-state.json` → `stages.research.passed = true`.

# Failure modes

| Scenario | Action |
|----------|--------|
| Niche extension files missing | Halt; point user at Module 2D |
| Website returns 404/500/timeout | Retry with `www.` prefix and `http://`. If still failing, halt with: "Website unreachable: {url}" |
| GBP not findable | Note review fields as 0/null, flag in report; continue |
| Owner name not findable | Note `ownerName: "Not found"`; flag in proposal hooks; continue |
| Service areas not stated | Use GBP service area if available; otherwise default to primary city only; flag for manual input |
| Multiple businesses with same name | Use the one matching the intake `websiteUrl`; flag if disambiguation was needed |
| Niche signal unclear | Default per niche playbook; flag low-confidence in report |
| Brand guide referenced but unreadable | Note in report, fall back to inference, flag for manual review |

# Quality bar

- Every section has at least 100 words of substance
- Every claim has a real source (URL or fetched-from-page)
- Numbers are exact, not approximated
- Owner story is at least one full paragraph if found
- Brand voice analysis is opinionated, not generic
- Differentiator hooks are specific, not "they offer quality service"

If any section is sparse, either dig harder or explicitly mark "Insufficient data", don't
pad with filler.

# What this skill is NOT

- Not the SEO audit (Stage 3)
- Not the asset scraper (Stage 4)
- Not the strategy generator (Stage 5)
- Not the copywriter (Stage 6)
- Not the deep social-resonance miner (Stage 15)

This stage is purely about **gathering and structuring information**. Other stages do
things with it.
