# Agent: Personalisation + SEO Injection (Stage 10.2)

## Role
Inject all client-specific data, schema, location pages, sitemap, robots.txt, the SEO layer.

## Prerequisites
- Stage 10.1 (Build) passed
- READ `.claude/skills/seo/SKILL.md`

## Steps

### Step 0, Read accumulated lessons (REQUIRED)

Before any other step, read these two files if they exist and apply every
rule listed as an override to this agent spec:

1. `.claude/lessons/by-agent/10-personalize.md`, universal corrections that apply to every run of this agent
2. `clients/[Client Name]/Pipeline Data/lessons/notes.md`, corrections specific to this client only

Lessons take precedence over the default behaviour in this spec because they
are corrections the student made for a reason. If the universal rule and the
client-specific rule conflict, the client-specific rule wins.

If neither file exists, proceed to Step 1.

### Step 1, Inject meta tags on every page
Per the SEO skill's title and description formulas. Use React Helmet Async.

### Step 2, Inject schema markup
- Homepage: RoofingContractor + AggregateRating + areaServed
- Service pages: Service + FAQPage
- Location pages: LocalBusiness + GeoCoordinates
- All pages: BreadcrumbList
- Footer: Organization

### Step 3, Generate sitemap.xml + robots.txt
Per the SEO skill's specifications.

### Step 4, Image SEO
Rename all images to keyword-rich kebab-case. Add descriptive alt text with location.
WebP format, lazy loading, explicit dimensions.

### Step 5, Internal linking pass
- Service pages link to relevant locations
- Location pages link to all services + 3-5 adjacent locations
- Footer links to all top-level service and location pages
- Nav has dropdowns for Services and Locations

### Step 6, Verify zero placeholders
Search the build output for any unfilled `[BRACKET]`, `{placeholder}`, or "Lorem ipsum" patterns.

### Step 7, Sub-2s LCP guard (SOP 14)

Boot the dev server (or use the one already running from earlier), then run:

```bash
cd "clients/[Client Name]/[Client Name] Website"
npm run dev > /tmp/dev.log 2>&1 &
DEV_PID=$!
# wait for ready
for i in {1..30}; do
  if curl -s -f -o /dev/null http://localhost:5173; then break; fi
  sleep 0.5
done

cd "$REPO_ROOT"
python3 tools/check-lcp.py --client "[Client Name]" --target 2000 --max-retries 3

# stop dev server when done
kill $DEV_PID 2>/dev/null
```

The script:
1. Runs Lighthouse mobile against `http://localhost:5173`
2. If LCP > 2000 ms, downgrades the hero image quality (90 → 78 → 66) and retries
3. Writes `clients/[Client Name]/Pipeline Data/logs/lcp-report.json` with the history

Exits 0 if LCP ≤ 2000 ms, exits 1 if budget still missed after 3 attempts. Stage 10.2 fails the gate if exit 1 (unless overridden via `/override-stage --stage=10.2 --reason=...`).

## Pass gate
- Zero placeholders remaining
- Every page has unique meta title + description
- Schema markup validates (use schema.org validator)
- sitemap.xml + robots.txt generated
- Internal links audited
- **Mobile LCP ≤ 2000 ms** (per SOP 14)