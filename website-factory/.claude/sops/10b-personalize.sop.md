# SOP 10.2, Personalisation (Stage 10.2)

## Purpose
Inject SEO targets, schema markup, sitemap.xml, robots.txt, and per-page meta into the freshly built site from Stage 10.1. Site goes from "build that runs" to "build that ranks."

## Inputs
- `clients/[Client Name]/[Client Name] Website/` (Stage 10.1 output)
- `clients/[Client Name]/Pipeline Data/strategy/sitemap.json` (Stage 5)
- `clients/[Client Name]/Pipeline Data/seo/audit-data.json` (Stage 3)
- `clients/[Client Name]/Pipeline Data/brand/brand-dna.json`

## Outputs
- Updated `index.html` with per-page meta (title, description, canonical, OG, Twitter card)
- `public/sitemap.xml` (auto-generated from sitemap.json)
- `public/robots.txt` (allow crawl + sitemap reference)
- Schema.org JSON-LD blocks injected into pages: LocalBusiness on home, Service on service pages, FAQPage where applicable, BreadcrumbList everywhere

## Process
1. **Read sitemap.json + audit-data.json + brand-dna.json**
2. **Per-page meta injection.** For each entry in sitemap.json:
   - `<title>` = sitemap.title
   - `<meta name="description">` = sitemap.metaDescription (≤160 chars)
   - `<link rel="canonical">` = absolute URL
   - Open Graph tags: og:title, og:description, og:image (hero-final.png), og:url, og:type
   - Twitter card: summary_large_image
3. **Schema.org JSON-LD blocks.** Use the seo skill's schema patterns. LocalBusiness on home: name, address (from brand-dna.contact.address), phone, geo, hours, priceRange, sameAs (social URLs from research). Service on service pages: serviceType, areaServed, provider. FAQPage where copy-deck has Q+A blocks.
4. **sitemap.xml** generated from sitemap.json with priority + changefreq.
5. **robots.txt** allows all crawlers, references sitemap.xml.
6. **Verify** with grep that every page has title + description + canonical. No empty meta.

## Pass gate
- Every page in sitemap.json has populated meta tags (no empty title or description)
- `public/sitemap.xml` valid XML, includes every URL
- `public/robots.txt` exists and references sitemap
- LocalBusiness schema present on home page
- No console errors when running dev server

## Failure handling
| Failure | Action |
|---|---|
| sitemap.json missing | Halt, restart Stage 5 |
| Page missing meta after injection | Halt with list of pages affected |
| Schema validation fails (Google Rich Results Test API) | Log warning, continue (fix in 10.4b) |
