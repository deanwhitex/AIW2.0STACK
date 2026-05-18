# 02 - Research SOP

Implements: Stage 2.

## Procedure

1. Read intake.json + WEBSITE-SNAPSHOT.html.
2. Extract from snapshot: services, service areas, license number, owner, phone, address, tagline.
3. Search GBP (`"company_name" Google Business Profile`). Capture rating, count, photos, category.
4. Search Facebook (`"company_name" Facebook`). Capture rating, count, last post.
5. Search BBB. Capture rating, accreditation status, complaints.
6. Identify top 3 local competitors via search: `roofing contractor {city} {state}`. For each: services, rating, count, photos, top keywords.
7. Generate `brand-research.md` covering: competitor visual audit, regional aesthetic, industry color conventions, homeowner sentiment language.
8. Compile `research.json` with 13 sections (adds `certifications` and `regional_landmark` to the original 11). Validate against `research.schema.json`. Halt on failure.

## Pass gate
- 13 sections present
- 3 competitors documented
- brand-research.md written

## Common issues
- GBP not found → mark `"not_found"`, continue
- <3 competitors → expand search radius then halt with manual intervention if still <3
- Reviews paywalled → use BBB or Yelp as fallback
