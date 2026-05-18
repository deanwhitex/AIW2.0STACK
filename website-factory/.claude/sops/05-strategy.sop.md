# SOP 05, Strategy (Stage 5)

## Purpose
Translate research + SEO audit into the build-time contract: sitemap.json, page hierarchy, on-page targets, and the strategy.json that downstream copy + build agents read.

## Inputs
- `clients/[Client Name]/Pipeline Data/research/research.json` (Stage 2)
- `clients/[Client Name]/Pipeline Data/seo/audit-data.json` (Stage 3)

## Outputs
- `clients/[Client Name]/Pipeline Data/strategy/strategy.json`, business strategy + positioning summary
- `clients/[Client Name]/Pipeline Data/strategy/sitemap.json`, page list with title, slug, primary keyword, meta description, priority, schema type

## Process
1. **Read upstream artifacts.** Both research.json and audit-data.json must exist and validate. Halt if either is missing.
2. **Build sitemap.** Required pages: home, about, contact, gallery, financing, blog (index + at least 3 stub posts). Conditional: one service page per top-5 service from research.services, one location page per service area in research.serviceAreas. Each entry carries title, slug, primaryKeyword, metaDescription (≤160 chars), priority (0.5-1.0), schemaType (LocalBusiness for home, Service for service pages, FAQPage for faq blocks).
3. **Compose strategy.json.** Captures: positioning statement, primary differentiator, target buyer profile (from research.serviceAreas + segment), competitive frame, top 3 content hooks (from research.differentiators).
4. **Write outputs.** Validate sitemap covers every URL the build will produce. No orphan URLs.

## Pass gate
- `strategy.json` and `sitemap.json` both written and parse as valid JSON
- Sitemap includes home + at least 3 service pages + at least 2 location pages
- Every entry has all required fields (no nulls)
- Stage 6 (copywriting) cannot start until this gate passes

## Failure handling
| Failure | Action |
|---|---|
| research.json missing/invalid | Halt, request Stage 2 re-run |
| audit-data.json missing/invalid | Halt, request Stage 3 re-run |
| Sitemap < 3 service pages | Halt with reason; research.services may be too short |
