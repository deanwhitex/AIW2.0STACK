# Agent: Delivery (Stage 12)

## Role
Compose the internal delivery report and pre-handoff checklist after Stage 11 deploys the site to Vercel. Bridge between the live URL and the Stage 13 proposal.

## Prerequisites
- Stage 11 passed (`pipeline-state.stage_11 === 'complete'`)
- `clients/[Client Name]/Pipeline Data/deploy/vercel-url.txt` exists with valid HTTPS URL
- All upstream artifacts present (research, brand-dna, copy, sitemap, hero, build cache)
- READ `.claude/sops/12-delivery.sop.md` end-to-end

## Outputs
- `clients/[Client Name]/Pipeline Data/delivery/delivery-report.md`
- `clients/[Client Name]/Pipeline Data/delivery/delivery-checklist.md`

## Steps

### Step 0, Read accumulated lessons (REQUIRED)

Before any other step, read these two files if they exist and apply every
rule listed as an override to this agent spec:

1. `.claude/lessons/by-agent/12-delivery.md`, universal corrections that apply to every run of this agent
2. `clients/[Client Name]/Pipeline Data/lessons/notes.md`, corrections specific to this client only

Lessons take precedence over the default behaviour in this spec because they
are corrections the student made for a reason. If the universal rule and the
client-specific rule conflict, the client-specific rule wins.

If neither file exists, proceed to Step 1.

### Step 1, Pull live URL + smoke check
```bash
URL=$(cat "clients/[Client Name]/Pipeline Data/deploy/vercel-url.txt")
curl -f -s -o /dev/null "$URL" || echo "WARN: live URL did not return 200"
```

### Step 2, Compose delivery-report.md
Include:
- Client name + live URL (clickable)
- Build summary: region, palette, fonts, theme_mode (light/dark), voice_register (commercial/family/premium), shape_motif (selected background pattern), key counts (services, locations, blog posts)
- QA scores: design-fidelity aggregate + per-region; sop-qa the niche template-composition + universal SOP scores; build-fidelity DOM diff result; perf LCP (desktop + mobile)
- Asset inventory: logo, badges, project photos, owner photo, hero images (desktop + mobile), team photos (counts + paths)
- Outstanding flags: any MANUAL-DROP-NEEDED.md or REGENERATION-NEEDED.md still present
- Apify spend: total spent (from `apify-cost.json`)
- Pipeline timing: per-stage wall-clock from build-log.md

### Step 3, Compose delivery-checklist.md
Binary pass/fail items:
- [ ] Hero loads on desktop AND mobile (both webp variants present, dimensions correct)
- [ ] All 13 the niche template sections rendered in canonical order
- [ ] LeadForm submits (Playwright smoke test the form on the live URL)
- [ ] the mobile CTA component (per the niche wireframe) visible + sticky at 375px viewport
- [ ] All universal SOP locked phrases present (grep against rendered HTML)
- [ ] Schema markup present (grep `application/ld+json`)
- [ ] sitemap.xml accessible at `/sitemap.xml`
- [ ] Click-to-call: every phone number wrapped in `tel:` link (grep)
- [ ] No em-dashes in rendered text
- [ ] Zero FORBIDDEN_STRINGS entries in dist (__REQUIRED__ sentinel + niche-playbook extensions)
- [ ] No `__REQUIRED__` sentinels surviving in shipped JS bundle
- [ ] Lighthouse LCP < 3s on desktop AND mobile

### Step 4, Update pipeline state
```json
{ "stage_12": "complete" }
```
Or `complete_with_flags` if any MANUAL-DROP-NEEDED files still present.

## Pass gate
- delivery-report.md and delivery-checklist.md both written
- All checklist items pass OR explicitly noted as expected exceptions
- Stage 13 (proposal) cannot start until this gate passes

## Failure handling

| Failure | Action |
|---|---|
| vercel-url.txt missing | Halt, restart Stage 11 |
| Live URL returns non-200 | Log, do NOT mark complete |
| Form submission test fails | Log as critical, do NOT mark complete (form is the conversion path) |
| Outstanding MANUAL-DROP-NEEDED | Mark `stage_12: complete_with_flags` and surface them prominently |
