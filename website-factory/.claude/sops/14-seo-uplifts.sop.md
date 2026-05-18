# SOP, SEO Uplifts (Phase 3)

## Purpose
Bring SEO output to the top-tier standard the niche playbook defines. Phase 3 adds 4 enforced gates beyond Stage 10.2's existing schema/sitemap injection.

## Gate 1, Click-to-call audit (added to Stage 10.4b SOP QA)

Every phone number rendered on every page must be wrapped in `<a href="tel:+1XXX...">`. Check via grep + Playwright:

```bash
# Static check
grep -r "tel:" src/sections/ src/components/ | wc -l   # must be >= count of (612) ... patterns

# Runtime check (Playwright)
const phones = await page.locator('text=/(\\d{3}\\) \\d{3}-\\d{4}/').count();
const telLinks = await page.locator('a[href^="tel:"]').count();
expect(telLinks).toBeGreaterThanOrEqual(phones);
```

Fail at Stage 10.4b if any phone number is plaintext.

## Gate 2, Mobile headline 2-line guard (added to Stage 10.4a Design QA)

At 375x812 viewport, `<h1>` must render in 2 lines or fewer. Check via Playwright bounding rect line-count:

```js
const h1 = page.locator('h1').first();
const box = await h1.boundingBox();
const computedLineHeight = parseFloat(await h1.evaluate(el => getComputedStyle(el).lineHeight));
const lines = Math.round(box.height / computedLineHeight);
expect(lines).toBeLessThanOrEqual(2);
```

If H1 wraps past 2 lines, fail. Fix via copy shortening (Stage 6 follow-up) or `text-wrap: balance` on mobile breakpoint (already in tokens.css mobile block).

## Gate 3, Sub-2s LCP target (added to Stage 10.2 Personalize)

After Stage 10.2 finishes, run Lighthouse mobile against the local dev server. If LCP > 2.0s, auto-downgrade hero image:

```bash
npx lighthouse http://localhost:5173 --only-categories=performance --form-factor=mobile --output=json > /tmp/lh.json
LCP=$(jq '.audits["largest-contentful-paint"].numericValue' /tmp/lh.json)
if (( $(echo "$LCP > 2000" | bc) )); then
  # Re-export hero at lower quality / smaller dimensions
  python3 -c "from PIL import Image; img = Image.open('public/hero-final.png'); img.save('public/hero-final.png', quality=78, optimize=True)"
  # Loop until under 2000ms or 3 attempts exhausted
fi
```

## Gate 4, Per-city unique copy enforcement (added to Stage 6 SOP)

Each location page (`/locations/[city]-mn`, etc.) must have at least 10 sentences of unique copy not present on any other location page. Check via:

```bash
for city_md in clients/*/Pipeline\ Data/copy/locations/*.md; do
  unique=$(diff <(sort "$city_md") <(cat clients/*/Pipeline\ Data/copy/locations/*.md | sort | uniq -d) | grep "^<" | wc -l)
  [ "$unique" -lt 10 ] && echo "FAIL: $city_md has $unique unique sentences"
done
```

Fail at Stage 6 SOP if any location page has fewer than 10 unique sentences.

## Pass gate
- Stage 10.4b: 0 plaintext phone numbers
- Stage 10.4a: H1 ≤ 2 lines on 375px viewport
- Stage 10.2: Lighthouse mobile LCP < 2000ms
- Stage 6: every location page has ≥ 10 unique sentences
