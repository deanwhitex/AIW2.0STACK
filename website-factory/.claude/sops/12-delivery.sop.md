# SOP 12, Delivery (Stage 12)

## Purpose
Compose the internal delivery report that records what was built and what's ready for the prospect. Bridge between the deployed site and the proposal sales asset.

## Inputs
- `clients/[Client Name]/Pipeline Data/deploy/vercel-url.txt` (Stage 11)
- All Pipeline Data/* artifacts from upstream stages
- `clients/[Client Name]/Pipeline Data/logs/build-log.md`

## Outputs
- `clients/[Client Name]/Pipeline Data/delivery/delivery-report.md`, internal handoff doc
- `clients/[Client Name]/Pipeline Data/delivery/delivery-checklist.md`, what's verified, what needs human attention

## Process
1. **Pull the live URL** from vercel-url.txt.
2. **Compose delivery-report.md** with:
   - Client name + deployed URL (clickable)
   - Build summary: archetype, region, palette swatches, fonts, key counts (services, locations, blog posts)
   - QA scores: design-fidelity aggregate + per-region; sop-qa final score
   - Asset inventory: logo, badges, project photos, owner photo, hero image (counts + paths)
   - Outstanding flags: any MANUAL-DROP-NEEDED.md or REGENERATION-NEEDED.md still present
   - Apify cost: total spent for this client (from `apify-cost.json`)
3. **Compose delivery-checklist.md** with binary pass/fail items:
   - Hero loads, dimensions correct
   - All the niche-wireframe sections rendered
   - Forms submit (use Playwright to test the LeadForm)
   - Mobile CTABar visible at 375px
   - All locked phrases present (grep)
   - Schema markup present (grep for application/ld+json)
   - sitemap.xml accessible at /sitemap.xml
4. **Update pipeline state** with `stage_12: complete`.

## Pass gate
- `delivery-report.md` and `delivery-checklist.md` both written
- All checklist items pass OR are explicitly noted as expected exceptions
- Stage 13 (proposal) cannot start until this gate passes

## Failure handling
| Failure | Action |
|---|---|
| vercel-url.txt missing | Halt, restart Stage 11 |
| Live URL returns non-200 | Log, do NOT mark complete |
| Form submission test fails | Log as critical, do NOT mark complete (form is the conversion path) |
| Outstanding MANUAL-DROP-NEEDED flags | Mark `stage_12: complete_with_flags` and surface them prominently |
