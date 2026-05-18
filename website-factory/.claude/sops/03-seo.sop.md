# 03 - SEO SOP

Implements: Stage 3.

## Procedure

1. Read intake.json, WEBSITE-SNAPSHOT.html, research.json.
2. Run 7-section audit (from `seo.txt` framework):
   1. Domain Authority & Trust Signals
   2. Local Keyword Gaps
   3. Competitor Landscape
   4. Website Technical Audit
   5. GBP Assessment
   6. Content Strategy Gaps
   7. Revenue Impact Summary
3. Calculate revenue:
   - current_leads_month = current_traffic × 0.03
   - potential_leads_month = target_traffic × 0.03
   - avg_job_value = $10K default
   - monthly_revenue_gap = (potential − current) × avg_job_value
4. Build sitemap (from `strategy.txt` logic): 6 core + 4–8 services + 5–12 locations + 6+ blog + utility.
5. For each page: slug, page_title, h1, meta_description (150–160 char), target_keyword, search_volume, content_notes.
6. Write 5 SEO priorities specific to this client's gaps.
7. Validate seo-strategy.json against schema.

## Pass gate
- 7 audit sections
- ≥5 keyword gaps
- Revenue figure calculated
- Sitemap with all required page types
