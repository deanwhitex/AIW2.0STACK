# Proposal Template Variables

Complete list of `{{VAR}}` placeholders in [proposal-template.html](proposal-template.html). The proposal generator (skills/06-proposal/SKILL.md) substitutes these per client during Stage 6, every var must resolve, otherwise the rendered proposal will leak `{{VAR}}` strings to the lead.

**Source pipeline:** brief.md (Stage 1) → research/ (Stage 2) → seo/ (Stage 3) → design-profile.json (Stage 3.5) → build/ (Stage 4) → these vars resolved (Stage 6).

Sections that use vars: every section. Two categories of vars:
- `{{CLIENT_*}}` and `{{COMPANY_*}}` etc.: per-lead (client) data, filled by build-proposal.py from pipeline outputs
- `{{AGENCY_*}}`: per-agency data, filled by build-proposal.py from `clients/_agency/agency-brand.json` (the student's own agency profile, populated once during onboarding via `/setup-agency`)

Sections §1 (Founder Intro), §3 (Winning Formula), §4 (Proof), §11 (AI Infrastructure), §12 (Timeline), and the review/case-study/client-build carousels are agency-side. They never change per client.

---

## Identity (always required)

| Var | Example | Source | Notes |
|---|---|---|---|
| `{{CLIENT_SLUG}}` | `acmeroofing` | `clients/{slug}/` folder name | Used for the localStorage key on the setup-fee modal so each client's "edit fee" persists separately. Slug-safe (lowercase, no spaces). |
| `{{COMPANY_NAME}}` | `Acme Roofing` | brief.md → `company.legal_name` | Full marketing name. Used in headers, body copy, title tag. |
| `{{COMPANY_BRAND}}` | `Acme` | brief.md → `company.brand` | Short brand mark, no "Roofing" suffix. Used where the full name would be redundant. |
| `{{COMPANY_FULL_NAME}}` | `Acme Roofing & Siding` | brief.md → `company.full_legal_name` | Only emitted where the full legal entity is required. Falls back to `{{COMPANY_NAME}}`. |
| `{{COMPANY_DOMAIN}}` | `acmeroofing.com` | brief.md → `company.domain` | Used in audit copy, SERP mockup, footer. |
| `{{COMPANY_LOGO_HTML}}` | `<img src="agency-assets/client-logo.webp" alt="Acme Roofing">` | derived: `clients/{slug}/assets/logo/primary.{webp,png,svg,jpg}` if present | **Topbar right-side client mark** (added 2026-05-09 per agency content brief, replaced "Need a hand? Call {{AGENCY_PRIMARY_CONTACT}}" + "Approve & Get Started" buttons). Proposal generator MUST emit this as a complete HTML fragment. **If logo asset exists:** `<img src="agency-assets/client-logo.{ext}" alt="{{COMPANY_NAME}}">`, copy logo into `clients/{slug}/proposal/agency-assets/` at gen time. **If no logo:** fall back to `<span class="topbar-client-text">{{COMPANY_NAME}}</span>`. |
| `{{COMPANY_BRAND_SHORT}}` | `ACME` | derived: `{{COMPANY_BRAND}}.toUpperCase()` truncated to ~10 chars | **Mock-mobile-bar logo text** in the day/night dynamic CTA mockup (Conversion accordion → Mobile-first card). Tight 11px Montserrat letter-spaced display. Use the brand alone, dropped any trailing "Roofing" / "Roofs" / "Exteriors" suffix, then UPPERCASE. If still > 10 chars, truncate. |

## ~~Traffic-audit numbers~~, DEPRECATED 2026-05-11

The three vars below (`{{ORG_TRAFFIC_LOSS}}`, `{{KEYWORDS_MISSED}}`, `{{DOMAIN_AUTHORITY_GAP}}`) and the "Where {domain} falls short today" card they fed were **removed from the proposal template on 2026-05-11**. Every value the build agent emitted for them was fabricated, the pipeline has no real DA/traffic/keyword data source (no Ahrefs/Moz/DataForSEO integration). The proposal's §6 SEO Audit now shows only the "10 things we do on your SEO" card on the left + the mini-SERP + mini-GMB on the right.

**Do not re-add these vars** until a real data feed exists (Stage 2.7 SEO Audit subagent reading from DataForSEO or equivalent). Gate 4.5.38 (evidence-backed claims, per the 2026-05-10 retrospective) will fail any build that emits `"DA \d+"`, `"\d+ monthly organic visits"`, or `"\d+ page-1 keywords"` without a backing evidence file (`research/seo-audit.json`).

~~| `{{ORG_TRAFFIC_LOSS}}` | `~840` | derived | Was: monthly organic visits lost to competitors. Source `seo/audit.md` never existed → fabricated. |~~
~~| `{{KEYWORDS_MISSED}}` | `62` | derived | Was: high-intent keywords lead doesn't rank top-3 for. Source `seo/keyword-research.md` never had this. |~~
~~| `{{DOMAIN_AUTHORITY_GAP}}` | `14 pts` | derived | Was: `top_competitor_DA − lead_current_DA`. Source `research/existing-site.md` doesn't carry DA. |~~

## Owner (single person at the company)

| Var | Example | Source | Notes |
|---|---|---|---|
| `{{OWNER_FIRST_NAME}}` | `{first name}` | brief.md → `owner.first_name` | Form preview, About section, PAGE_DATA strings. |
| `{{OWNER_FULL_NAME}}` | `{full name}` | brief.md → `owner.full_name` | Signature blocks and "Owner-led" trust pills. |
| `{{OWNER_PHONE}}` | `(770) 370-7663` | brief.md → `owner.phone` | Display format with parens + dash. |
| `{{OWNER_PHONE_TEL}}` | `7703707663` | derived: digits-only of `{{OWNER_PHONE}}` | `tel:` href value. |

## Geography

| Var | Example | Source | Notes |
|---|---|---|---|
| `{{REGION_FULL}}` | `North Metro Atlanta` | brief.md → `geo.region_full` | Full marketing region. Appears 12+ times. |
| `{{METRO}}` | `Atlanta` | brief.md → `geo.metro` | Short metro name. |
| `{{STATE_FULL}}` | `Georgia` | brief.md → `geo.state_full` | Full state name in body copy. |
| `{{STATE_CODE}}` | `GA` | brief.md → `geo.state_code` | Two-letter abbreviation. Used in keyword strings. |
| `{{CITY_PRIMARY}}` | `Marietta` | brief.md → `geo.cities[0].name` | Highest-priority city. Appears 24×. |
| `{{CITY_PRIMARY_SLUG}}` | `marietta` | brief.md → `geo.cities[0].slug` | Lowercased version for URL fragments. |
| `{{CITY_2}}` | `Roswell` | brief.md → `geo.cities[1].name` | 2nd-tier city. |
| `{{CITY_3}}` | `Alpharetta` | brief.md → `geo.cities[2].name` | 3rd-tier city. |
| `{{CITY_LIST_SECONDARY}}` | `Sandy Springs, Smyrna` | derived: cities[3..4] joined | Shorter mentions. |
| `{{CITY_LIST_ADDITIONAL}}` | `Sandy Springs, Smyrna, Kennesaw, plus 12 more` | derived | Fuller list with "plus N more" tail. |
| `{{CITY_COUNT}}` | `18` | brief.md → `geo.cities.length` | Total location pages we'll build. |
| `{{CITY_COUNT_MORE_SHORT}}` | `13` | derived: `cities.length - cities_listed_inline` | "And N more" in the SERP mockup. |

## Trust signals

| Var | Example | Source | Notes |
|---|---|---|---|
| `{{REVIEW_COUNT}}` | `310` | research/existing-site → reviews.count | Aggregate Google review count. |
| `{{REVIEW_RATING}}` | `4.9` | research/existing-site → reviews.average | Average star rating, 1 decimal. |
| `{{PROJECTS_COMPLETED}}` | `525` | brand-dna → `company.projects_completed` (or `trust.projects_completed`) | Niche-agnostic completed-projects count for proof-section copy. Legacy alias `{{ROOFS_COMPLETED}}` still renders the same value for proposal templates that haven't migrated. |
| `{{YEARS_IN_BUSINESS}}` | `25` | brief.md → `company.years_in_business` | Calculated from `{{FOUNDING_YEAR}}` if missing. |
| `{{FOUNDING_YEAR}}` | `2000` | brief.md → `company.founding_year` | Used in PAGE_DATA story timeline. |
| `{{BBB_RATING}}` | `A+` | brief.md → `company.certifications.bbb_rating` | Always uppercase. |
| `{{BBB_NUMBER}}` | `0443-91844064` | brief.md → `company.certifications.bbb_number` | Numeric BBB business ID. |

## Pricing

| Var | Example | Source | Notes |
|---|---|---|---|
| `{{SETUP_FEE_DEFAULT}}` | `(agency-set)` | brief.md → `pricing.setup_fee_default` (fallback `(agency-set)`) | Default opening number for the editable setup-fee modal. Stored without `$` so the JS can pre-format. agency rep overrides per-call via the modal, value persists in localStorage under `agency-one-time-offer-{{CLIENT_SLUG}}`. |

## Sitemap pyramid (niche-aware)

The sitemap pyramid + silo chips below the equation row are rendered by `build-proposal.py` from `templates/{niche-slug}/niche-playbook/proposal-pages.json` plus the active client's strategy. The proposal HTML template carries placeholders the renderer fills.

| Var | Example | Source | Notes |
|---|---|---|---|
| `{{PYRAMID_HTML}}` | (rendered HTML block, ~2-4kb) | `proposal-pages.json` + client strategy | The complete `<div class="sitemap-pyramid">` block. Each page entry's `tier` field (root / core / pillar) drives placement. Each pillar with `hasSilos` renders a `+N` count badge. Counts ("Core Pages", "Pillars") derive from the actual page list, NOT hardcoded. |
| `{{PYRAMID_CORE_COUNT}}` | `4` | derived: count of `pages[].tier == "core"` | Currently unused by the template (the renderer bakes the count into `{{PYRAMID_HTML}}`). Available as a fallback placeholder if a future template carries a separate display. |
| `{{PYRAMID_PILLAR_COUNT}}` | `6` | derived: count of `pages[].tier == "pillar"` plus pillar aliases | Same as above. |
| `{{SERVICE_COUNT}}` | `8` | client's `strategy.services.length` | Total services pages count, rendered in the silo chip section and on the pillar's `data-count` badge. |
| `{{CITY_COUNT}}` | `12` | client's `strategy.service_areas.length` | Total location pages count, rendered in the silo chip section and on the pillar's `data-count` badge. |
| `{{SERVICE_CHIPS_HTML}}` | `<span class="silo-chip">Full Detail</span>...` | client's `strategy.services[]` (top 6) | Silo chips shown under the Services pillar. |
| `{{LOCATION_CHIPS_HTML}}` | `<span class="silo-chip">Pretoria</span>...` | client's `strategy.service_areas[]` (top 3) | Silo chips shown under the Locations pillar. |
| `{{SILO_PAGE_COUNT}}` | `20` | actual_service_pages + actual_location_pages | "Silo Pages" stat in the pyramid. |
| `{{TOTAL_PAGE_COUNT}}` | `45` | `sitemap.json -> page_count` (or derived sum) | "Total Pages" stat in the pyramid. |

---

## Sections that do NOT use `{{VARS}}` (regenerated per client)

Some chunks of the proposal aren't string-substituted, they're regenerated entirely per lead from research data. The template ships with a sample client's content; the build step replaces these blocks:

| Block | Driven by | Notes |
|---|---|---|
| ~~§6 SEO Audit + §7 You-at-#1 + §8 Proven Blueprint + §10 Deliverables + §11 AI Infrastructure~~ | DEPRECATED 2026-05-10 | All five sections REMOVED from the canonical template. Their content has been folded into:<br>• Winning Formula → Traffic accordion (SEO + AEO card + sitemap pyramid + 10/5 audit bullets + mini-SERP + mini GMB)<br>• Winning Formula → Trust accordion (3 cards + Reputation Manager card 04)<br>• Winning Formula → Conversion accordion (Frictionless form + Mobile-first w/ day-night mockup + Smart Chatbot + Instant Callback)<br>• Dedicated AI Infrastructure section (3 GHL-style alternating rows: Chat Agent / Voice Agent / Reputation Agent)<br>The proposal generator no longer needs to generate per-lead competitor cards. |
| Mini-SERP result list inside Traffic accordion | NONE, generic placeholders only | Lead's domain as #1 (uses `{{COMPANY_NAME}}` / `{{COMPANY_DOMAIN}}` / `{{CITY_PRIMARY_SLUG}}` / `{{YEARS_IN_BUSINESS}}` / `{{REVIEW_RATING}}` / `{{REVIEW_COUNT}}` / `{{CITY_COUNT}}` / `{{REGION_FULL}}`). Below #1, 2 dimmed generic placeholder rows ("Local Roofing Competitor / Regional player..."), NO real competitor data needed. |
| Mini-GMB knowledge panel inside Traffic accordion | mostly vars + per-lead asset copy | Address, phone, hours, photos. Cover image at `agency-assets/gmb-cover.webp` is per-lead, see "Per-lead asset copy" below. |
| PAGE_DATA object in `<script>` | `clients/{slug}/seo/sitemap.md` + `seo/page-briefs/` | The 17 page entries with section lists for the click-to-expand sitemap modal. |
| Mobile + desktop iframe `src` | `clients/{slug}/build/index.html` | Relative path `../build/index.html` from the proposal folder, no var. **Local-preview gotcha:** an http-server rooted at `clients/{slug}/proposal/` will 404 on the iframe (can't escape to sibling `build/`). Always root the local preview at `clients/{slug}/` and navigate to `/proposal/proposal.html`. |

---

## Per-lead asset copy (Stage 6, proposal generator MUST do this every run)

The proposal references several per-lead assets via known paths inside `clients/{slug}/proposal/agency-assets/`. The generator is responsible for copying these in before substitution. Missing files = visible 404s in the rendered proposal.

| Asset path (inside `clients/{slug}/proposal/agency-assets/`) | Source | Purpose |
|---|---|---|
| `client-logo.{webp\|png\|jpg\|svg}` | `clients/{slug}/assets/logo/primary.{ext}` (highest-resolution variant from Stage 2 asset scrape) | Topbar right-side mark + mini-GMB logo. Wired via `{{COMPANY_LOGO_HTML}}`. **REQUIRED.** Fall back to `<span class="topbar-client-text">{{COMPANY_NAME}}</span>` only if the logo asset truly doesn't exist on disk. |
| `gmb-cover.webp` | `clients/{slug}/assets/photos/{first-drone-or-banner}.{ext}`, then convert to `.webp` | Mini-GMB knowledge-panel cover photo (Traffic accordion). 90px tall, gradient-overlaid. Generator should pick the most "GMB-cover-shaped" photo: **drone aerial > project banner > truck/team photo > stock fallback**. Re-encode to webp at ~1200px wide for crisp display + small file. |
| `agency-blueprint.pdf` | `templates/agency-assets/agency-blueprint.pdf` (agency-static) | Password-gated SOP PDF that opens from the Winning Formula's "View the {{AGENCY_BLUEPRINT_NAME}}" button. Same file every run, copy from templates dir. |
| `case-studies/*.mp4` (4 files) | `templates/agency-assets/case-studies/{case-study-1,case-study-2,case-study-3,owner-testimonial}.mp4` | The 4 testimonial videos in the case-studies grid below the agency proof video. agency-static, copy from templates dir each run. |
| `client-builds/*.webp` (6 files) | `templates/agency-assets/client-builds/{portfolio-1,portfolio-2,portfolio-3,portfolio-4,portfolio-5,portfolio-6}-imgs1.webp` | The 6 mockup tiles in the "Setting Industry Standards" parallax section. agency-portfolio, same per lead. Copy from templates dir each run. |

---

## Required-anchor contract for the build

The proposal's §8 "Proven Blueprint" cards have `<a class="blueprint-see-live">` links with these hash targets. The build (`clients/{slug}/build/index.html`) **must emit these IDs** or the link does nothing:

| Anchor | Lands on | Build section that needs the ID |
|---|---|---|
| `#hero` | Hero / form section | `<section class="section hero" id="hero">` |
| `#about` | About / owner section (also serves the "See it in your owner section" link) | `<section class="section about-section" id="about">` |
| `#service-area` | Service-area grid | `<section class="section service-area-section" id="service-area">` |

If you rename build anchors, update the proposal links in §8 to match.

---

## Operator overrides (visible to the proposal indirectly)

The proposal does NOT use `{{VAR}}` substitution for operator-controlled design decisions (button tier, card variant, accent color, hero pattern, typography). Those decisions live in `clients/{slug}/design/design-profile.json` under `operator_overrides`, and they shape what the §8 "See it live in your build" iframes render, so an operator override of `accent_color_override: "#F4B41A"` will appear in the iframe preview as a gold CTA, and the proposal still pulls the same iframe.

Why this matters for proposal-vars: when the operator sets an override, the build at `clients/{slug}/build/index.html` must be regenerated for the iframe to reflect it. The proposal HTML itself doesn't need a re-render, only the iframe target does.

| What the operator can pin | Where they set it | Where it surfaces in the proposal |
|---|---|---|
| `hero_pattern` (H1/H2/H3/H4 from the niche template's hero patterns library) | `design-profile.json` → `operator_overrides.hero_pattern` | §8 iframe (hero anchor) |
| `accent_color_override` (counter-color hex) | `operator_overrides.accent_color_override` | §8 iframe (CTA + decoration accents) |
| `card_variant` / `card_variants_extra` | `operator_overrides.card_variant*` | §8 iframe (services / why-us / process) |
| `button_tier` / `button_sun_kiss` | `operator_overrides.button_tier`, `_sun_kiss` | §8 iframe (every CTA pill) |
| `typography_display_override` / `_body_override` | `operator_overrides.typography_*_override` | §8 iframe (all type) |

See [`sops/design-intelligence.md`](../sops/design-intelligence.md) §`operator_overrides` block for the full schema. Stage 5 QA writes every override that fired to `clients/{slug}/qa/iteration-N-overrides.md`.

---

## Validation checklist (run before sending the proposal)

1. `grep '{{' clients/{slug}/proposal/proposal.html`, should return **0 matches** (all vars resolved).
2. ~~`ls clients/{slug}/proposal/agency-assets/competitors/*.png | wc -l`, should be 8~~ DEPRECATED 2026-05-09. Competitor PNG check no longer applies; the §7 grid was removed and Stage 2 competitor research is skipped. The `agency-assets/competitors/` directory may not exist on new builds.
3. `grep -c 'id="hero"\|id="about"\|id="service-area"' clients/{slug}/build/index.html`, should be **3**.
4. Open the proposal locally, click each "See it in..." link → confirm the build scrolls to the right section.
5. Click each Tier-1 + Tier-2 page card in the §10 sitemap → confirm the modal opens with rendered sections.
6. Open the §16 Investment section → confirm the setup-fee modal shows `${{SETUP_FEE_DEFAULT}}` formatted on first load (clear localStorage if testing).
