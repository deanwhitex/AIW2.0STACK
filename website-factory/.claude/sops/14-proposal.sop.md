# Proposal SOP, Stage 13: Sales Proposal

**Added:** 2026-05-02 (agency proposal generator, May 1 meeting pivot)
**Last canonical sync:** 2026-05-08 (trust intros §1-§4 added, sitemap modal + setup-fee modal + bundled competitor PNGs canonised)
**Authority:** [`sops/00-master-blueprint.md`](00-master-blueprint.md) (Layer 0) + the agency-brand.json structure
**Canonical template:** [`templates/proposal-template.html`](../templates/proposal-template.html), every `{{VAR}}` documented in [`templates/proposal-template-vars.md`](../templates/proposal-template-vars.md).
**Output:** `clients/{slug}/proposal/proposal.html`, single-file static HTML, agency-branded, with embedded live device mockups of the just-built site

## Purpose

After the website is built (Stages 0-11), produce a sales proposal that's **branded as {{AGENCY_NAME}} ({{AGENCY_NAME}})**, personalized for the lead, and embeds a live preview of their just-built site in laptop + phone device mockups. The proposal is presented in the sales call, sign + pay during the call.

## When this stage runs

After Stage 11 (QA) is clean. The proposal pulls from artifacts produced in Stages 0-11; it does NOT modify them.

## Inputs (per-client)

```
clients/{slug}/brief.md                               business + owner + service area
clients/{slug}/research/existing-site.md              what's broken on their current site (becomes audit findings)
clients/{slug}/research/review-evidence.json          real Google + FB + BBB numerals
clients/{slug}/seo/keywords.md                        SEO opportunity (optional, for ROI section)
clients/{slug}/seo/sitemap-plan.md                    deliverables sitemap
clients/{slug}/build/index.html                       LIVE preview embedded in mockups
clients/{slug}/assets/logo/                           client logo (in cover or section)
```

## Inputs (agency-side, shared across all proposals)

```
clients/_agency/agency-brand.json                                 the agency brand profile (populated via /setup-agency, read at every Stage 13 run)
clients/_agency/assets/                                           agency assets: portrait, signature, blueprint PDF, review avatars, client-build screenshots, case-study MP4s, proof video
clients/{slug}/proposal/agency-assets/                            destination — build-proposal.py copies clients/_agency/assets/ here
```


## Palette override (per-student branding)

The proposal template ships with a working default palette (primary red + gold accent) baked into `proposal-template.html` CSS. To restyle the proposal to the student's own agency brand:

1. The student fills `agency-brand.json` palette fields (or extends with `palette.{primary, primary_deep, accent, dark, light, grey}`)
2. `tools/build-proposal.py` injects those values as `:root` CSS variables in the rendered proposal
3. Every component referenced in this SOP uses `var(--agency-primary)`, `var(--agency-accent)`, etc.

The default hex values in `proposal-template.html` are the fallback when the agency hasn't set a palette. The student should restyle by populating `agency-brand.json` palette before running Stage 13.

## Pre-flight requirements (run BEFORE substitution)

These are the three things that have historically broken proposals at runtime. Verify each before generating.

### 1. Competitor screenshots, captured locally, not via thum.io

~~The §3 "Who's Taking Your Traffic" grid shows 8 competitor websites as screenshot cards.~~ **DEPRECATED 2026-05-09**, the 8-card competitor grid was removed from §7 per operator direction (was costing 5-8 minutes of Stage 2 runtime + the new "You. At #1." simplification doesn't need competitor screenshots). The local-PNG bundling discipline below remains documented for reference in case the grid is re-enabled.

(Original guidance, preserved for reference, not currently active):

The §7 grid showed 8 competitor websites as screenshot cards. The proposal referenced **local PNGs** bundled into `clients/{slug}/proposal/agency-assets/competitors/{domain-slug}.png`, NOT a live screenshot API. Reasons: a proposal is a one-shot artifact for one lead, refetching on every pageview wastes API quota, breaks if the API has referer restrictions, fails on localhost, and adds 5–15s of cold-fetch lag the first time the section is viewed.

```bash
SLUG=acme-roofing

# 1. List the 8 competitor URLs (one per line), bare domains OK
cat > clients/$SLUG/research/competitors.txt <<'EOF'
acme-roofing.com
example-roofing.com
... etc, 8 total ...
EOF

# 2. Capture all 8 as 1280x800 PNGs into clients/$SLUG/proposal/agency-assets/competitors/
agentic/tools/capture-competitor-screenshots.sh $SLUG

# 3. Each <img class="competitor-screenshot"> in the proposal references agency-assets/competitors/{domain-slug}.png
#    where domain-slug = lowercase, dots replaced with dashes (acme-roofing.com -> acme-roofing-com)
```

If a screenshot fails (Cloudflare-blocked, site down) the `onerror` handler adds `.error` to the `<img>` and the colored gradient `.competitor-fallback` shows through. No manual handling required.

### 2. Build anchor-ID contract

The §4 "Proven Blueprint" cards include "See it in your X →" links that target anchor IDs in `../build/index.html`. The build template MUST emit these IDs on the corresponding sections, otherwise the buttons silently land at the top of the page instead of scrolling to the relevant section.

| Proposal link | Required `id` on a `<section>` in build/index.html |
|---|---|
| `See it in your hero →` | `id="hero"` |
| `See it in your owner section →` | `id="about"` (the about section IS the owner section) |
| `See it in your hero form →` | `id="hero"` (same hero, the form lives inside) |
| `See it in your About section →` | `id="about"` |
| `See it in your service-area grid →` | `id="service-area"` (singular, NOT "service-areas") |
| `Open your build on your phone →` | (no anchor, opens the build root) |

**Verify before shipping:**

```bash
grep -nE 'id="(hero|about|service-area|reviews)"' clients/{slug}/build/index.html
# expected: ≥3 lines (hero + about + service-area). If any are missing, add them
# to the corresponding <section> in the build, DO NOT change the proposal links;
# the canonical anchor names are fixed.
```

### 3. Null-safe JS for `#year` / `#prep-date`

The proposal's inline `<script>` block sets the current year and proposal-prep date by ID. **Both lookups MUST be null-safe**, because if either element is missing the entire script aborts with a `TypeError`, which leaves the `const PAGE_DATA = {...}` declaration in temporal dead zone, silently breaking the §6 sitemap modal (cards click but nothing opens).

The template ships with the safe pattern; the rule is "don't replace it with the unguarded one":

```js
// CORRECT, null-safe. Safe even if #year or #prep-date is missing.
(function(){
  var y=document.getElementById('year'); if(y) y.textContent=new Date().getFullYear();
  var p=document.getElementById('prep-date'); if(p) p.textContent=new Date().toLocaleDateString('en-US',{year:'numeric',month:'long',day:'numeric'});
})();

// BANNED, un-guarded. Throws TypeError if #prep-date is missing → kills PAGE_DATA → kills sitemap modal.
// document.getElementById('year').textContent=new Date().getFullYear();
// document.getElementById('prep-date').textContent=new Date().toLocaleDateString(...);
```

If you want the prep-date to actually display (it shows in the Cover meta block when present), make sure the corresponding `<div id="prep-date">` element exists in the cover. If you remove it intentionally, the null-safe guard means the script keeps running anyway.



## {{AGENCY_NAME}} brand palette (from agency live-site CSS extraction)

| Token | Hex | Role |
|---|---|---|
| `agency-primary` | `{{AGENCY_PALETTE_PRIMARY}}` | Primary accent (CTAs, kickers, H1 emphasis) |
| `agency-primary-deep` | `{{AGENCY_PALETTE_PRIMARY_DEEP}}` | Button bevel / hover darken |
| `agency-accent` | `{{AGENCY_PALETTE_ACCENT}}` | Secondary accent (eyebrows, ROI highlight) |
| `agency-dark` | `{{AGENCY_PALETTE_DARK}}` | Dark sections, text |
| `agency-light` | `{{AGENCY_PALETTE_LIGHT}}` | Light section grounds |
| `agency-grey` | `{{AGENCY_PALETTE_GREY}}` | Body text on light grounds |
| `agency-white` | `#FFFFFF` | White sections |

Typography: from `agency-brand.json` typography fields. The default template ships with Montserrat (display) + Open Sans (body); the student replaces these with their agency's brand fonts.

## Required sections (in order)

The canonical proposal has an unnumbered Cover at the top + **17 numbered sections** + Footer. Sections §1-§4 are agency-static "trust intros" added 2026-05-08, they always show identical {{AGENCY_PRIMARY_CONTACT}}-talking-about-{{AGENCY_NAME}} copy and never use `{{VAR}}` substitution. Sections §5-§17 are per-client and use vars from `templates/proposal-template-vars.md`.

| Page section | Title | Purpose | Source data |
|---|---|---|---|
| Topbar | Sticky CTA bar | {{AGENCY_NAME}} logo (`height:100px`) + "Need a hand? Call {{AGENCY_PRIMARY_CONTACT}} directly." text + "Approve & Get Started" CTA, always visible | static |
| Cover ★ | The {{NICHE_NOUN_TITLE}} Website for [Company] | 2-column hero: left = eyebrow / H1 / **3 outcome bullets** (sourced from agency-brand.json intro.value_props[] or per-niche default); right = laptop mockup embedding `../build/index.html`. **No money-back / risk-reversal block in the hero** (removed 2026-05-09 per operator direction, risk-reversal lives in §16 Investment / Money-Back Badge only). Bullet emojis sit naked at the same scale as labels (or larger), NO container, NO background fill, NO border, NO border-radius. CSS: `.cover-bullets .cb-icon { font-size: clamp(32px, 2.4vw, 40px); line-height: 1; }`. The earlier styled-container variant (48×48px gold-tinted box) is BANNED, operator caught the visual weight of the box competing with the message. | brief.md + build/index.html |
| §1 ★ | Section 1 · Who I Am | **WHITE-MODE trust intro** (`section-trust section-agency-light`). "Hello, I'm {{AGENCY_PRIMARY_CONTACT}}." H2 + 3 editorial dash-marker bullets (no `01/02/03` chips, just red 28×3px dashes) + "That's not a claim, it's my promise." pill + {{AGENCY_PRIMARY_CONTACT}} signature. Right column: {{AGENCY_PRIMARY_CONTACT}} photo card with "100% Guaranteed" badge overhanging the top-right corner (`.agency-portrait-money-back` is sibling of `.agency-portrait-personal` inside `.agency-portrait-wrap`, not child, `.agency-portrait-personal` has `overflow:hidden`). | static ({{AGENCY_PRIMARY_CONTACT}}) |
| §2 ★ | Section 2 · What I Do | **DARK full-viewport** (`section-trust section-wid-full`, `min-height:100vh`). Punchy H2 with agency value prop + agency hero stat row + 4 outcome bullets in 2×2 grid (icon emoji **44px no border, no background**, in a 64×64 container). All copy comes from `agency-brand.json` (intro.promise + intro.value_props[]). | static ({{AGENCY_NAME}} value prop) |
| §3 ★ | Section 3 · How I Do It | **WHITE-MODE Winning Formula** (`section-trust section-formula section-formula-light`). Vertical `.formula-stack` of 3 dark term cards (TRAFFIC / TRUST / CONVERSION) on white background, gold `+` chips between them, red `=` chip before the climax red gradient result card with `{{AGENCY_FORMULA_OUTCOME}}` (e.g. "MORE ROOFS SOLD", "MORE JOBS BOOKED", set in agency-brand.json winning_formula.outcome_line) Result text **single-line** (`white-space:nowrap`, `font-size:clamp(28px,2.9vw,46px)`). | static ({{AGENCY_NAME}} framework) |
| §4 ★ | Section 4 · The Proof | **DARK proof section** (`section-proof`). {{AGENCY_PROOF_STAT}} / {{AGENCY_PROOF_STAT_SUBTITLE}} headline + thumbnail-link to {{AGENCY_PROOF_VIDEO_URL}}. Click opens video URL in new tab. All values from `agency-brand.json` proof.{}. | static ({{AGENCY_NAME}} case study) |
| §5 ★ | Section 5 · Built Mobile-First | **CENTERED layout** (`section-grey section-mobile-first`). Centered kicker / title / sub. Phone mockup (300px) + 6 mobile-conversion **one-line outcome bullets** (640px column max), grid centered (`max-width:1040px; justify-content:center`). | build/index.html (phone iframe) + bullets |
| §6 | Section 6 · SEO Audit On `<their-domain>` | **One** `.seo-audit-card-do` ("10 things we do on your SEO") in a 2-col block. Right col = mini-SERP mockup + mini-GMB knowledge panel. *(2026-05-11: the "Where {domain} falls short today" loss-card was DELETED, all stats in it (DA, monthly visits, page-1 keywords, AEO readiness) were fabricated because the pipeline has no real SEO-data source. Do not re-introduce until a real data feed exists per Gate 4.5.38.)* | brief.md + research/existing-site.md |
| §7 | Section 7 · You. At #1. (SIMPLIFIED 2026-05-09) | Section title changed from "Who's Taking Your Traffic" to "You. At #1." per operator direction. **The 8-card competitor grid is REMOVED** (was costing 5-8 min of Stage 2 runtime to capture screenshots + zero proposal value once the SERP mockup carried the "you could be here" psychology). The Google SERP mockup STAYS with: lead's domain highlighted gold at #1 + "THIS COULD BE YOU" badge + 3 generic dimmed placeholder rows below ("Local Roofing Competitor / Regional Roofing Brand / National Roofing Franchise", no real competitor data dependency). GMB knowledge panel on the right STAYS (uses the lead's own existing-site research, not competitor data). | brief.md + research/existing-site.md (NO competitor data needed, Stage 2 §2 is currently SKIPPED per perf optimization; restore both sections together if re-enabling) |
| §8 | Section 8 · The Proven Blueprint | 6 vertical-stack `<details>` cards w/ "See it in your X →" CTAs. Anchor links must match build IDs (#hero, #about, #service-area). | static + agency-brand.json blueprint_pdf_path |
| §9 | Section 9 · Why You Can't Sleep On This | 3 reason cards. | static |
| §10 | Section 10 · What's Included (Sitemap Tree) | Relume-style tree → click any of 12 page boxes → `<dialog id="pageDialog">` opens, populated by `PAGE_DATA` JS map (17 pages × 8-the niche-wireframe sections each). | seo/sitemap-plan.md + JS PAGE_DATA |
| §11 | Section 11 · AI Infrastructure | 4-card 2×2 grid · gold-dot bullets per card. | static |
| §12 | Section 12 · Live in 3 Days (Timeline) | 4-step grid + dashed agency-primary rail. | static |
| §13 | Section 13 · Run Your Numbers (ROI Calculator) | 4 sliders + live output panel. | client-facing live math |
| §14 ★ | Section 14 · Don't Take Our Word For It ({{AGENCY_NAME}} Written Reviews) | Horizontal carousel of {{AGENCY_NAME}} written reviews. **Centered eyebrow** (`display:flex; justify-content:center`). | injected from `agency-brand.json` reviews[] |
| §15 ★ | Section 15 · See It From {{NICHE_END_CUSTOMER_PLURAL}} ({{AGENCY_NAME}} Video Testimonials) | 1-4 owner MP4s in a grid (9:16 portrait). **Centered eyebrow.** | injected from `agency-brand.json` case_studies[] |
| §16 | Section 16 · Investment (Pricing) | Value-stacked card → **dark hero price card** ($/mo from agency-brand.json pricing.monthly_fee_default_usd, at 84px) + **"+ Reveal One-Time Offer" button** opens setup-fee modal. Modal default `${{SETUP_FEE_DEFAULT}}` (sourced from agency-brand.json pricing.setup_fee_default_usd), {{AGENCY_PRIMARY_CONTACT}} can edit inline (contenteditable), value persists in localStorage `agency-one-time-offer-{{CLIENT_SLUG}}`. **Centered eyebrow + title** (inline style). | per call + brief.md |
| §17 | Section 17 · Acceptance | Two-column signature block. | brief.md |
| Footer | {{AGENCY_NAME}} logo + tagline + year + link | static |

★ = headline sections. Cover laptop is the first thing the prospect sees (proves the site exists in the first 5 seconds), and the phone mockup in §1 carries the mobile-conversion narrative. Splitting laptop + phone across two sections (instead of stacking both in one demo block) gives each device its own narrative beat.

**Why §10 + §11 (testimonials) sit between ROI (§9) and Pricing (§12):** ROI shows what the prospect could earn; testimonials show that {{AGENCY_NAME}}'s other clients did earn it; THEN the pricing ask. The two-section testimonial block (written reviews + recorded video stories) is the highest-leverage social proof point in the proposal. **Never move these sections elsewhere in the flow.** The order is: doubt-reducer → social proof → ask.

## Technical Deep-Dive Accordion (§5-§13), added 2026-05-08 per {{AGENCY_PRIMARY_CONTACT}}

Sections §5 through §13 (Built Mobile-First, SEO Audit, Who's Taking Your Traffic, The Proven Blueprint, Why You Can't Sleep On This, What's Included, AI Infrastructure, Live in 3 Days, Run Your Numbers) ship **collapsed by default** as click-to-reveal accordions. {{AGENCY_PRIMARY_CONTACT}} reads the proposal during the sales call and opens only the sections relevant to the prospect's questions, the technical depth is available but not forced on every reader.

**Always-visible sections (NOT collapsed):**
- Cover, §1 (Who I Am), §2 (What I Do), §3 (How I Do It), §4 (The Proof), trust intros that frame {{AGENCY_PRIMARY_CONTACT}}
- §14 ({{AGENCY_NAME}} Reviews), §15 ({{AGENCY_NAME}} Videos), §16 (Investment / Pricing), §17 (Acceptance), close-the-deal flow

**Wrap pattern (canonical):** each of §5-§13 is wrapped in a native `<details class="proposal-collapsible" id="section-N">` element with a `<summary class="ps-summary">` containing:
- `<span class="ps-num">Section N</span>`, agency-primary eyebrow with dash
- `<span class="ps-title">{{ section title }}</span>`, bold dark
- `<span class="ps-chevron" aria-hidden="true"></span>`, agency-primary circle, rotates 225° on open

A "Sections 5-13 · Technical Deep-Dives" lead-in panel sits **directly above §5** with a black ground + agency-primary bottom border, explaining the click-to-reveal pattern to the reader. The 9 accordions are wrapped together in a `<div class="proposal-collapsibles-wrap">` so the visual stack reads as one cohesive technical block.

**Sticky-on-open behavior:** when a `<details>` is `[open]`, its `<summary>` becomes `position: sticky; top: var(--topbar-h, 123px); z-index: 50`, the summary docks just below the {{AGENCY_NAME}} topbar while the user scrolls through the section's content. The chevron stays in reach for one-click close. Sticky scope is the `<details>` element itself, so when the user scrolls past the section's bottom the summary auto-unsticks and the next accordion's summary takes over (or stays out of flow until the user reaches it).

**Scroll-back-on-close behavior:** native `<details>` keeps the scroll byte-offset constant on close, but the page just shrunk by the section's content height, so the user gets dumped past the accordion stack (often into §14/§15 testimonials). A `toggle` event handler at the bottom of the inline `<script>` block scrolls the just-closed summary back to the top of the viewport (instant snap, no smooth-scroll lag) so the user lands at the same accordion row in the stack, ready to open the next one.

**Required scaffolding (build skill emits all of this, don't skip):**
1. CSS: `.section-collapsibles-intro` + `.proposal-collapsibles-wrap` + `details.proposal-collapsible > .ps-summary` + sticky-on-open block + mobile media query, all live in the `<style>` block at the top of `templates/proposal-template.html`. Don't fork these per client; they're truly canonical.
2. HTML: lead-in panel + 9 `<details>` wraps + closing `</div>` for the wrap. The kicker inside each section stays as-is (redundant with the summary but harmless and provides context once open).
3. JS: `toggle` handler at the bottom of the inline `<script>` block.

**Why native `<details>` not custom JS toggle:** zero-JS open works for printing and accessibility; keyboard nav is free (Tab → Enter); no animation jank from height transitions. The only JS we add is the close-scroll fix.

**Banned executions:**
- Putting §1-§4 trust intros inside accordions, those are {{AGENCY_PRIMARY_CONTACT}}'s framing; collapsing them removes the human-trust setup
- Putting §14-§17 (testimonials, pricing, acceptance) inside accordions, those are the close; collapsing kills the flow
- Default-open ANY of §5-§13, {{AGENCY_PRIMARY_CONTACT}} controls reveal during the call; default-open contradicts the rationale
- Adding `<button>` toggle JS instead of native `<details>`, loses keyboard accessibility + print-mode auto-open + zero-JS fallback
- `position: fixed` on the summary, fixed escapes the section bound, so it would stay at top through the entire page; the sticky-bound-by-`<details>` is what makes it auto-unstick when scrolling past
- **Nesting `<dialog>` modals inside accordions**, `<dialog showModal()>` on an element nested inside a closed `<details>` misbehaves: the dialog either fails to open, opens but click events don't propagate, or "the page bugs" (RapidResponse v1 symptom). All page-level modals (`sopDialog`, `pageDialog`, `sopPwModal`, `setupFeeModal`) **must live at the bottom of `<body>`**, outside any `<section>` or `<details>`. They're page-level UI, not section-level UI.

## Heading line-break discipline (sitewide)

Every H1 and `.section-title` H2 in the proposal MUST set:

```css
text-wrap: balance;
max-width: 28ch;   /* H1 in cover, fits 2-line balanced break of "The {{NICHE_NOUN_TITLE}} Website / for [Company]" up to ~16-char company names */
max-width: 32ch;   /* .section-title H2, wider, smaller type */
```

And the H1 font-size MUST scale with viewport so it actually fits the column on narrower desktops:

```css
font-size: clamp(34px, 2.4vw, 40px);   /* H1, caps at 40px on wide screens, shrinks gracefully on narrow */
```

**Why three rules instead of one:**
1. **`text-wrap: balance`** redistributes words across lines so the visual mass is balanced. Without it, browsers greedy-wrap and orphan single words on a line (e.g. `The the niche template's hero / Website / for Gravity Roofing.`, "Website" stranded on line 2).
2. **`max-width` in `ch` units** caps the heading line length so the balancer has room to redistribute. Without it the H1 would extend to the full column edge and the balancer would have nothing to balance.
3. **Responsive font-size** (`clamp`) is needed because `text-wrap: balance` does NOT reduce line count, it only redistributes within the natural line count. If the natural wrap is 3 lines (because the heading is too wide for the column at 42px), `balance` will produce 3 balanced lines, not collapse to 2. Shrinking the font on narrower viewports collapses the natural wrap to 2 lines.

**Rules:**
- Never hard-code `<br>` tags inside H1/H2 to force breaks. The browser's balancer is smarter than per-client guesses, especially across different brand-name lengths.
- Never hardcode character-count rules per client (e.g. "use this phrasing if company name is ≤ 16 chars"). Trust the balancer + the `ch`-based max-width + the `clamp()` font-size.
- If a heading still wraps to 3+ lines on desktop after all three rules apply, the fix is to **rephrase the heading shorter**, not to drop font-size further or tighten max-width. Layer 0's "≤ 2 lines on desktop" rule wins.
- Browser support: `text-wrap: balance` and `clamp()` are Chrome 114+, Firefox 121+, Safari 17.5+ (all current browsers as of 2026-05). No fallback needed for sales-call use.

## Cover-grid responsive breakpoint

The cover's 2-column grid (content + laptop) needs a viewport breakpoint that's high enough that both columns actually have room. Per the canonical reference build, the breakpoint is `@media (max-width: 1380px)`, below that the cover stacks single-column. Reasoning: at 1280px viewport with `1fr 640px` columns, the content column gets squeezed to 520px, which forces the H1 to 3+ lines no matter what `clamp()` resolves to. Stacking single-column gives the H1 the full container width (1216px on a 1280px viewport) which keeps it at 2 lines.

If you change the laptop column width or container max-width, recompute this breakpoint so the content column on the breakpoint boundary is still wide enough to render the H1 in 2 lines.

## Container width (sitewide)

All three top-level containers, `.topbar-inner`, `.cover-inner`, `.section-inner`, share the same width tokens:

```
max-width: 1400px;
margin: 0 auto;
padding: 0 32px;
```

Why 1400px (not 1200px): on 1920px+ monitors the proposal lives in a Zoom screen-share alongside {{AGENCY_PRIMARY_CONTACT}}'s webcam. A 1200px container looked cramped, the H1 wrapped to 3 lines, the laptop preview was forced down to 560px wide, and there was 350px+ of dead margin each side. 1400px gives the cover-grid `1fr 640px` (content + bigger laptop), keeps the audit-cards and AI-infra cards from feeling stranded in a sea of dark, and still leaves a comfortable 250px each side at 1920px.

If you change one container's max-width, change all three so vertical alignment is consistent down the page.

## Device mockup specifications

### Cover laptop (hero/cover section)
- Container: `.cover-laptop`, `max-width: 640px`, `justify-self: end` inside the cover grid
- Outer body: rounded-top dark frame with browser chrome (3 dots + URL bar showing the prospect's domain)
- Viewport: full-width × 380px tall, fits the cover-grid alongside the content column
- Iframe: `width:1280px; height:800px; transform:scale(0.484); transform-origin:top left; position:absolute; top:0; left:0;`, renders the build at native desktop dimensions, scaled down to fit the hero viewport (scale derives from `(640 - 20px laptop-screen padding) / 1280 ≈ 0.484`)
- Base + tray + caption ("Desktop · 1280 viewport · Real, scrollable preview") below
- Below `1100px`: cover-grid collapses to single column, laptop centers under the content with `max-width: 720px`

### Demo phone (§2 Mobile-First Demo, iPhone 14 Pro style)
- Container: `.phone` (mockup), `width: 320px` column inside `.demo-stack` grid
- Outer body: 300px × 610px, dark `#0a0a0a`, border-radius 42px, 10px padding
- Notch: absolute-positioned 96px × 24px black pill at top-center
- Screen: 280px × 590px, border-radius 32px, overflow hidden
- Iframe: `width:375px; height:812px; transform:scale(0.747); transform-origin:top left; position:absolute;`, renders the build at native iPhone-width, mobile media queries kick in, scaled down to fit
- Below `880px`: demo-stack collapses to single column, phone centers above the bullets

**Critical CSS-class hygiene:** the topbar's "Need a hand?" span uses class `.topbar-phone` (NOT `.phone`) to avoid colliding with the `.phone` mockup class. Generic `.phone` selector matches mockup only.

**Why two laptops are NOT used:** earlier draft stacked a large laptop + phone in a single "Live Demo" block. The hero section was text-only. We moved the laptop into the hero (right column) so the prospect sees the live site in the first 5 seconds instead of after scrolling, and the demo section is dedicated to the mobile conversion narrative. **Do not duplicate the laptop in §2.**

## Per-section content rules

### Cover (with desktop preview)
- Layout: `.cover-grid` is `1fr 640px` on desktop (≥ 1100px) with a 56px gap, single column below. Left column = `.cover-content`, right column = `.cover-laptop`. Total page container is `max-width: 1400px` with `padding: 0 32px` (see "Container width" section above).

**Left column · `.cover-content`:**
- Eyebrow: `Prepared Exclusively For {{COMPANY_NAME}}` (red-bar prefix + gold uppercase)
- H1: 3-line stacked title with explicit `<br>` breaks (2026-05-11 typography overhaul):
  ```html
  <h1>{{NICHE_NOUN_TITLE}} <span class="h1-bold">AI Smart Website</span><br><span class="h1-for">for</span> <em>{{COMPANY_BRAND}}</em>.</h1>
  ```
  - Default h1 weight: **500 (medium)**, `the niche template's hero` reads light
  - `.h1-bold` wraps **only** `AI Smart Website` at weight **700** with tighter `-0.022em` letter-spacing, this is the visual anchor of the cover. *Lower than 700 reads soft; 800-900 reads cartoonish/chunky at the 64px display size.*
  - `.h1-for` = `for` styled as a smaller lowercase grey particle (0.62em, weight 600, white@55%)
  - `<em>{{COMPANY_BRAND}}</em>` = the lead's brand in agency-primary, font-style:normal
- Cover bullets: `.cover-bullets`, 4 items with emoji icon + label. Default `.cb-label` weight: **500 (medium)**. Bolded key word per row wrapped in `<span class="bold-key">` (weight 900). Bullet 4 is the result row with `.cb-result` class, uses `<em>` to wrap the entire bold-accent result phrase (em is auto-styled `font-style:normal; color:var(--agency-accent); font-weight:900`):
  ```html
  <li><div class="cb-icon">📈</div><div class="cb-label">Generates More <span class="bold-key">Traffic</span></div></li>
  <li><div class="cb-icon">🤝</div><div class="cb-label">Wins <span class="bold-key">Trust</span> of Homeowners</div></li>
  <li><div class="cb-icon">📅</div><div class="cb-label"><span class="bold-key">Converts</span> Them Into Leads</div></li>
  <li class="cb-result"><div class="cb-icon">💰</div><div class="cb-label"><span class="cb-equals">=</span> You <em>Sell More Roofs</em></div></li>
  ```

**Right column · `.cover-laptop`:**
- Laptop mockup with iframe `src="../build/index.html"` (or `build/index.html` when deployed flat to Vercel).
- **`.cover-laptop-crown`** sits at top-right corner (`top:-32px; right:-26px; width:96px; height:78px`):
  - Transform: `transform: scaleX(-1)`, horizontal mirror (NOT a rotation). The crown PNG is asymmetric; a left-right flip puts the dark shadow side on the left and the gold highlight side facing right (toward the laptop). Rotation transforms don't fix this, they just spin the same shading around.

### §1 Built Mobile-First (one-line outcome bullets)
- Kicker: `Section 1 · Built Mobile-First`
- H2: `60% of your traffic is mobile.` + italic emphasis on second clause
- Sub: pivot from desktop preview to mobile-conversion thesis (storm-driven, on-phone, decided-in-5-seconds)
- Eyebrow: `What this means for [Brand]` (NOT "What you're looking at", {{AGENCY_PRIMARY_CONTACT}} voice)
- H3: `Every mobile detail tuned to win the homeowner before they call anyone else.`
- Layout: `.demo-stack` is `320px 1fr` on desktop (≥ 880px), single column below.
- **6 outcome-led one-line bullets**, each rendered as a single line on desktop (~22px tall, ~13 words). `<strong>` is **`display: inline`** (NOT block) so the bold outcome sits IN-LINE with the proof text. NO `<p>` paragraph wrapper inside `.body`. Pattern:
  ```html
  <li><div class="check">✓</div><div class="body"><strong>OUTCOME.</strong> Tight proof line.</div></li>
  ```
- Canonical 6 (clone for new clients):
  1. **Catch every after-hours lead.** Sticky CTA toggles *Call* ↔ *Quote* by time of day.
  2. **Trust hits in 1 second.** [4.9–5.0]★ × [N] Google reviews above the fold.
  3. **Leads call *you* first.** Real "Talk to [Owner]" photo replaces the generic icon.
  4. **One tap to the phone.** Every number, header, hero, footer, sticky bar.
  5. **Looks like $30k, not budget.** Edge-to-edge photos · swipe galleries · big type.
  6. **No bounced thumbs.** 44px tap targets · 16px+ body · tested at 375px+.

### §2 SEO Audit On `<their-domain>`
- Kicker: `Section 2 · SEO Audit On <span style="color:var(--agency-accent)">[domain]</span>` (accent-highlighted domain)
- **One** `.seo-audit-card-do` titled `"10 things we do on your SEO"` (green left-rail + `+` badge) inside `.seo-audit-bullets-col`. Ten one-line bullets describing {{AGENCY_NAME}}'s delivery: city-targeted location pages (use real `brief.geo.cities.length`), Schema + FAQ markup, pillar→silo internal linking, LocalBusiness + Service schema, AEO answer blocks, real reviews + GBP sync, speed-optimized (Lighthouse 90+), mobile-first metadata + canonical hygiene + sitemap auto-ping, per-page meta + OG tags, 60-second AI callback.
- Right col `.seo-audit-serp-col`: compact "This could be you" mini-Google SERP mockup (lead's row gold-highlighted #1 + 2 dimmed generic rows) + compact mini-GMB knowledge-panel card using real `brief.address` + `brief.phone` + `review-evidence.json` rating.
- **REMOVED 2026-05-11**: the second `.seo-audit-card-loss` ("Where {domain} falls short today") with DA / monthly-visits / page-1-keywords / AEO-readiness stats. All numbers in it were fabricated, the pipeline has no real SEO-data source (no Ahrefs/Moz/DataForSEO integration). Do **not** re-introduce this card with placeholder numbers; Gate 4.5.38 (evidence-backed claims) treats `"DA \d+"`, `"\d+ monthly organic visits"`, `"\d+ page-1 keywords"` as fabrication patterns that must trace back to an evidence file. Re-introduce ONLY after Stage 2.7 SEO Audit (real API feed) lands.
- Source: `brief.md` + `research/existing-site.md` + `research/review-evidence.json`

### §3 Who's Taking Your Traffic (competitor proof)
- 8 competitor screenshot cards in 4-col grid. Card aspect-ratio `4/3`, screenshots via `https://image.thum.io/get/width/1200/{URL}` with `onerror` gradient fallback. Favicon via `https://www.google.com/s2/favicons?domain={DOMAIN}&sz=64`.
- Below: Google SERP mockup at 1180px max-width with two-column body (706px results column + 360px GMB knowledge panel).
- Lead's row in SERP: gold border + "THIS COULD BE YOU" badge.
- GMB knowledge panel uses real client data: banner image (`assets/hero/hero-composed.jpg` if present), logo overlay (`assets/logo/{slug}-logo.png`), real address, real phone, real review count + rating, license number, review snippet.
- Source: `research/competitors.md` + `brief.md`

### {{AGENCY_NAME}} Written Reviews (§9)
- Section background: `linear-gradient(180deg,#030303 0%,#1F2124 100%)` (dark, matches cover).
- Kicker: `Section 9 · Don't Take Our Word For It` (gold).
- H2: `Here's what {{AGENCY_NAME}}'s clients say.`, `clients` highlighted in `agency-accent`.
- Aggregate strip below H2: `{{AGENCY_REVIEW_COUNT}} 5-star reviews on [G icon] [f icon] {{AGENCY_REVIEW_PLATFORMS_LABEL}}`. The 4-color Google G uses inline SVG; the Facebook f is a white SVG inside a `#1877F2` circle.
- Carousel: horizontal scroll-snap row, 10 cards, 360px wide each on desktop / 86%-of-viewport on mobile. Gold (`agency-accent`) circular prev/next arrows on desktop. **Arrows are hidden on viewports ≤ 768px**, mobile users swipe.
- Card: photo (56px circle) + name (uppercase Montserrat 800) + 5-star row with `5.0` numeral + "Facebook Review" source label + Facebook icon top-right + verbatim review text clamped to 7 lines via `-webkit-line-clamp`.
- Source data is **always the live {{AGENCY_NAME}} testimonials** (see "{{AGENCY_NAME}} testimonial sources" below). **Use verbatim text only**, no rewording, no typo "fixes" (e.g., "Ive been in [industry]" stays as-is). This mirrors Real Review Evidence Gate 4.5.16 discipline.

### {{AGENCY_NAME}} Video Testimonials (§10)
- Section background: `#F1F1F1` (light grey), visual contrast vs. the dark §9 above.
- Kicker: `Section 10 · See It From The Clients`.
- H2: `Real owners. Real results.`, `Real results.` highlighted in `agency-primary`.
- Sub: 1 sentence framing the videos as 60-90 seconds each, real owners, real outcomes.
- Layout: `.agency-video-grid` is `repeat(4, 1fr)` on desktop (≥ 880px) with 18px gap. Below 880px it collapses to single column with `max-width: 380px; margin: 0 auto` and an 18px gap.
- Each card (`.agency-video-card`): portrait aspect ratio, `9/16` on desktop, `9/14` on mobile (slightly less extreme so the stack doesn't feel endless). Border-radius 16px, dark `#0a0a0a` ground, drop shadow that lifts on hover. Bottom-fade gradient overlay so the white owner-name label stays legible against varied video frames.
- Per card: `<video preload="metadata" playsinline>` filling the card via `object-fit: cover`, a centered red circular play button (`var(--agency-primary)` with `0.94` alpha + white triangle), and the owner name as a `.agency-video-label` (uppercase, Montserrat 800, 13px, text-shadow). Hover scales the play button 1.06×.
- Click handling: clicking any card calls `video.play()` and adds `is-playing` to the card (which fades the play button + bottom-gradient + label out and reveals native `controls`). Clicking a playing card pauses it. Starting one video pauses all others. `ended` event resets state and rewinds to start so the play button reappears.
- Why a grid instead of a slider: 4 owner stories all visible at once is higher density and lower friction than a carousel. Operators don't need to navigate to discover the other 3 videos. The portrait aspect mirrors the way prospects watch testimonial content on their phones today (Reels / Stories / TikTok grammar).

## {{AGENCY_NAME}} testimonial sources

**These are SYSTEM-LEVEL inputs (shared across every client's proposal, they are {{AGENCY_NAME}}'s reviews, not the client's reviews).**

### Written reviews (injected from agency-brand.json reviews[])

Source: `clients/_agency/agency-brand.json` reviews[]. Minimum 3 entries. Each entry: `{name, platform, rating, avatar_path, text}`. The `build-proposal.py` tool reads this array at every Stage 13 run and injects one carousel card per entry between the `<!-- AGENCY_REVIEWS_INJECTED_START -->` and `<!-- AGENCY_REVIEWS_INJECTED_END -->` markers in `proposal-template.html`.

Avatar files live in `clients/_agency/assets/review-avatars/` and are copied into each client's proposal folder at build time.

### Video testimonials (injected from agency-brand.json case_studies[])

Source: `clients/_agency/agency-brand.json` case_studies[]. 1-4 entries. Each entry: `{slug, owner_name, video_path, poster_path}`. MP4 files live in `clients/_agency/assets/case-studies/` and are copied into each client's proposal folder at build time.

The 4-card grid renders if there are 3-4 case studies. If only 1-2 case studies are populated, the grid auto-collapses to a 1- or 2-column layout. The build script halts if `case_studies[]` is empty.

### §4 The Proven Blueprint (click-expand cards + SOP modal)

- Vertical-stack accordion (`<details>` elements), max-width 920px, centered. NO 3-column grid (siblings sit on top of each other so opening one doesn't leave neighbors blank).
- Section header centered (kicker + h2 + sub all `text-align: center`).
- **Closed-state structure** (4-col grid: `56px 1fr auto 22px`):
  - 56px **rounded-square gradient num tile** (navy `#0E1430`→graphite `#1F2124`). On open: gradient swaps to agency-primary (`var(--agency-primary-deep)` → `var(--agency-primary)`) + tilts -3°.
  - **Title** (15.5px, weight 700) + **1-line teaser sub** (13px greyed), the sub is what lets a sales-call viewer scan all 6 cards without expanding.
  - **Category tag pill**, color-coded per mechanism via CSS variables: `.trust` (`--cat-trust-bg`), `.convert` (`--cat-convert-bg`), `.brand` (`--cat-brand-bg`), `.seo` (`--cat-seo-bg`), `.mobile` (`--cat-mobile-bg`). Default values live in `proposal-template.html`; per-agency overrides via the `palette` block in `agency-brand.json`.
  - Chevron (agency-primary, rotates 180° when open).
- **Open-state body** (padding `6px 22px 22px 96px`):
  - **3 punchy bullets** (NOT a paragraph). agency-primary dot prefix. `<strong>` lead-in for the key claim.
  - **"Why this works" callout** as a 2-col grid: big agency-primary stat (28-30px, weight 900) on the LEFT + tight proof on the right with eyebrow + 1-2 sentences. Background: gradient `var(--agency-accent-light)`→`var(--agency-accent-light-tint)`, accent-color border.
  - **See-it-live button** (NOT dashed link): white bg + 1.5px agency-primary border + uppercase Montserrat 800. Hover fills agency-primary with white text + 4px lift.
- Canonical 6 mechanisms (clone for new clients):
  1. Real Google + Facebook + BBB above the fold, `Trust` tag, stat: `5 sec`
  2. Owner photo, name & story on every key page, `Trust`, stat: `+47%`
  3. Frictionless 5-field form + sub-60s AI callback, `Convert`, stat: `78%`
  4. Story · Vision · Mission written for [Brand], `Brand`, stat: `4–7%`
  5. SEO + AEO architecture · location, schema, AI-ready, `SEO`, stat: `50%`
  6. Mobile-first conversion mechanics, `Mobile`, stat: `65%`
- **SOP-PDF modal trigger card** below the 6 cards: dark gradient card (navy→graphite) with gold "SOP" eyebrow, opens a `<dialog id="sopDialog" class="sop-dialog">` containing an iframe of `agency-blueprint.pdf`. The PDF is set in `clients/_agency/agency-brand.json` (`blueprint_pdf_path`) and copied into each client's proposal folder at build time. The proposal halts at Stage 13 if no blueprint PDF is present.

### §6 What's Included (Sitemap Tree, Relume-style)

- Container `.sitemap-pyramid` panel: warm light grey bg `#F7F5F0`, 14px radius, 48px top-padding so the rail clears.
- **Three tiers** with vertical 1px grey trunk lines (`.pyramid-trunk`) between them:
  1. **Home root**: single `.page-box.root` card (white, 4px agency-primary left-stripe, 14px font, weight 700). NO icon (the `⌂` was banned). Clickable: `onclick="openPage('home')"`.
  2. **Tier 1 · Core (5 cards)**: About · Gallery · Reviews · Contact · Financing. White cards with agency-primary dot prefix, weight 600. Each clickable.
  3. **Tier 2 · Pillars (n cards)**: page labels driven by `agency-brand.sitemap.tier2` (universal pillars like Services, Locations, Why Us, plus niche-specific pillar pages from the niche playbook). White cards with 1.5px agency-primary border. Pages flagged with `has_silos: true` in the sitemap get a `.has-silos` class with a count-badge (the badge number is the silo entry count). Each clickable.
  4. **Tier 3 · Silos**: 2-col grid below Tier 2 with vertical drop connectors. Left = service silos (8 chips), right = location silos (N city chips matching brief). White panels with chip clusters.
- **Tree connector lines** (CSS pseudo-elements, NOT inside cards):
  - `.tree-cell { padding: 24px 7px 0 }` so card sits 24px below the rail
  - `.tree-cell::before` = horizontal bus segment at `top:0` (1px tall, color `#d6d2c8`)
  - `:first-child::before { left:50% }` and `:last-child::before { right:50% }` so the bus has shoulder-trims (no overhang past the outermost cards)
  - `.tree-cell::after` = vertical drop from `top:1px` for 21px (lines END 2px above each card top, verified with `dropEndsBeforeCard: true`)
  - Mobile (≤780px): hide rail + drops, stack cleanly with 8px gap
- **All 12 main cards (root + 5 Core + 7 Pillars) clickable**, each has `role="button"`, `tabindex="0"`, `cursor:pointer`, and `onclick="openPage('id')"` plus `onkeydown` for Enter/Space.
- **Shared `<dialog id="pageDialog">`** populated by JS `openPage(id)` from a `PAGE_DATA` object map (defined in script before `</body>`). Each page has 8-the niche-wireframe sections rendered as `.pc-section-row` (gold-numbered badge + title + desc + category tag). Modal styled white-bg with `.pc-modal-head` + `.pc-modal-body` (light grey bg `#F7F5F0`).
- **Stats strip** below tree: 5-col grid (`Core 5 · Pillars 7 · Silos N · Total 40+ · 100% SEO Indexed`). Top-border separator.
- **6-feature included grid** below stats: 3-col (`.included-grid` overrides `.included-item` to be a card with white bg + 1px border + 10px radius + hover red-glow).

### §7 AI Infrastructure (mobile-bullets)

- 4 cards in 2×2 grid (1-col mobile). Dark section bg.
- Per card: **`.ai-card-head`** with 36px icon chip (agency-primary bg, 7px radius, 13px Montserrat 700 abbreviation) + h4 title (14px, weight 700, NO uppercase) + bottom border-divider.
- Body: `<ul class="ai-bullets">` with **4 bullets**, each prefixed by gold dot `::before`. NO paragraph prose.
- Use 2-3 letter abbreviations for icon chips (e.g. `AI`, `CAL`, `REV`, `CB`), clean and consistent vs. mixed emoji.

### §8 Live in 3 Days (Timeline with rail + WIN)

- 4-step grid (`repeat(4,1fr)` desktop, `repeat(2,1fr)` ≤980px, 1-col ≤560px). `padding-top: 60px` (desktop) to clear marker circles + rail.
- **Dashed agency-primary rail** at `top:30px` (`.timeline::before`): `repeating-linear-gradient(90deg, var(--agency-primary) 0 6px, transparent 6px 13px)`, spans `8% → 92%`. Hidden on mobile.
- **48px marker circles** (`.tl-marker`) absolute-positioned `top:-50px; left:50%`: white bg, 2px agency-primary border, agency-primary number, agency-primary shadow. On mobile: marker becomes inline (`position: static; margin: 0 auto 14px`).
- **Step card** (`.tl-step`): white bg, 1px border, 10px radius. Hover: agency-primary border + lift.
- Per step: `.tl-step-head` with accent "Step 0X" pill (`var(--agency-accent-light)` bg, accent border) + bold When (from `agency-brand.timeline.steps[i].when` label) + bottom border. Body = `.tl-bullets` (3 bullets, agency-primary dots, **first bullet has `<strong>` outcome lead-in**).
- **Final-step WIN moment** (`.tl-step.win` class on the last step in `agency-brand.timeline.steps`): white-to-accent-light gradient bg, 1.5px agency-primary border, beefier primary-tinted shadow. Marker is inverted (agency-primary bg + white step number). Num pill also inverted. Adds a `.tl-win-stamp` pill stamp top-right (label from `agency-brand.timeline.win_stamp_label`, in agency-primary with accent dot prefix, uppercase, letter-spaced).
- **Outcome banner** below the timeline (`.timeline-outcome`): navy gradient panel (`#0E1430`→`#1F2124`) with gold ambient glow + 32px gold "→" arrow + "AFTER 3 DAYS" eyebrow + {{AGENCY_PRIMARY_CONTACT}}-voice transformation line ("From invisible online to a roofing brand homeowners pre-decide they trust, before they ever pick up the phone."). Mobile collapses to centered single column.
- Canonical step copy (clone, customize per client):
  - **Step 01 · Today**, `<strong>Your slot is locked.</strong> No more wondering when this starts.` / Onboarding form hits your inbox · 10-min fill / Same-business-day start, not "next week"
  - **Step 02 · Day 1**, `<strong>[Owner] tells the story once.</strong> 15-min call · we turn it into your brand.` / Photos, voice, service-area cities locked / You don't write a single line of copy yourself
  - **Step 03 · Days 2–3**, `<strong>Your team sees something real.</strong> Full live-preview link by EOD3.` / Build · AI · SEO · content all stitched in / One round of revisions baked in, no surprise change-fees
  - **Final step (WIN)**, content from `agency-brand.timeline.steps[final].body` (the win body). Outcomes lead-in lives in `agency-brand.timeline.steps[final].outcomes[]`.

### §9 Run Your Numbers (ROI Calculator, {{AGENCY_PRIMARY_CONTACT}} voice)

- Kicker: `Section 9 · Run Your Numbers` (NOT "ROI Calculator").
- H2: `What this site is worth to [Brand].` (italic emphasis on "worth")
- Sub: {{AGENCY_PRIMARY_CONTACT}}-voice anti-hype line referencing {{AGENCY_NAME}}'s `30–50%` lift average.
- **4 sliders** (NOT 3, added the lift % as the conversion lever):
  1. **Monthly site leads now**, range 5–150, default 40
  2. **Close rate · leads → sold jobs**, range 10–50%, default 25
  3. **Average roof ticket**, range $5,000–$40,000 (step $500), default $12,500
  4. **Lift after we ship**, range 10–80%, default 30, hint label "{{AGENCY_NAME}} avg: 30–50%"
- **Output panel** (3-up):
  - HERO (`.roi-output-main`): "Extra revenue every month" eyebrow + `+$[X]/mo` figure (60px Montserrat 900) + sub: "From [N] extra closed jobs a month, built on YOUR numbers, not agency hype."
  - SUPPORTING (`.roi-output-aux`, 2-col): `+$[year]/yr` (Extra revenue per year) + `[ROI]×` (Return on the monthly fee)
- Math: `extraLeads = leads × (lift/100)` · `extraJobs = extraLeads × (close/100)` · `extraRev = extraJobs × ticket` · `extraYear = extraRev × 12` · `roiMult = extraRev / {{AGENCY_MONTHLY_FEE_NUMERIC}}  (the numeric value parsed from the rendered .pt-amount element)`
- Defaults render: `$37,500/mo · $450,000/yr · 126×` (with lift=30, leads=40, close=25, ticket=$12,500). The ROI multiple is the closer.

### §12 Investment (Pricing, value-stacked premium card)

- Card (`.pricing-card`): white, 14px radius, max-width 720px, centered. agency-primary→gold top stripe (6px).
- **Eyebrow**: "Limited Slot · Same-Day Start" (gold pill).
- **Headline** (`.pricing-headline`, 24px weight 700): "Become [Region]'s *most trusted* {{NICHE_NOUN}} brand." (italic em emphasis on the identity phrase). Customize Region per client.
- **Identity sentence** (`.pricing-identity`, 14px greyed): identity-language framing, "The {{NICHE_NOUN_TITLE}} Website + AI lead engine + ongoing SEO, everything you need to charge what you're worth, win better crew, and win the {{NICHE_END_CUSTOMER}} before they ever pick up the phone."
- **Value Stack panel** (`.value-stack`), the agency's value-stack move:
  - Off-white bg (`#FBFAF7`), 1px border, 10px radius
  - Eyebrow: "What's stacked into this" (agency-primary, with red dot prefix)
  - 5 line-items (`.vs-item`), each with green ✓ + name + line-through MSRP in `#7A7A7A` (agency-primary strike-color):
    1. Custom {{NICHE_NOUN_TITLE}} Website Build ({{TOTAL_PAGE_COUNT}}+ pages), **{{AGENCY_VALUE_STACK_LINE_1_MSRP}}**
    2. AI Lead-Handling Stack ({{AGENCY_AI_STACK_LABEL}}), **{{AGENCY_VALUE_STACK_LINE_2_MSRP}}**
    3. SEO Foundation + Schema + AEO setup, **$7,500**
    4. Hosting · SSL · Lifetime Maintenance, **$1,800/yr**
    5. Reputation + Review Auto-Engine, **$2,400/yr**
  - Total row (`.value-stack-total`): "STACKED VALUE" + bold **{{AGENCY_STACKED_VALUE_TOTAL}}+** (agency-set in agency-brand.json)
- **Risk-reversal pill** (`.risk-pill`) above the price: green pill (`#EEF7E9` bg, green border, dark-green text + green dot prefix): "100% money-back · cancel any time after month 3 · no contracts".
- **Hero price card** (`.pricing-hero`): navy gradient (`#0E1430`→`#1F2124`), 12px radius, gold ambient glow:
  - Gold "Your Investment" eyebrow (11px, letter-spaced)
  - **monthly fee at 84px (`.ph-price`)**, sourced from `agency-brand.json` pricing.monthly_fee_default_usd, Montserrat 900, white. The `/mo` em is 22px white-60% inline-baseline. Mobile drops to 64px. (The font weights and sizes are typography defaults; the dollar value is agency-defined.)
  - Sub: "+ one-time setup fee" (NOTHING ELSE, no "$1,000", no "discussed on call", no "varies")
- **CTA button**: "Approve & Lock In Your Slot", agency-primary 3D-bevel
- **Fine print**: "Same business-day start. We start building the moment your invoice clears."

### §13 Acceptance

- Two-column signature block ({{AGENCY_NAME}} + Client) with name pre-filled from `brief.md`
- Sub copy: "Setup fee is invoiced same-day, we start building the moment it clears." (NEVER mention `$1,000`)

### §10 {{AGENCY_NAME}} Written Reviews, carousel arrows in gutter

- `.agency-reviews-carousel-wrap { position: relative; padding: 0 64px }` so prev/next arrows live in their own 64px gutter, they NEVER overlap card text.
- `.agency-reviews-prev { left: 8px }` / `.agency-reviews-next { right: 8px }` (positioned inside the gutter, not overlapping cards).
- Mobile (≤768px): `.agency-reviews-carousel-wrap { padding: 0 }` + arrows hidden (swipe).

## Banned executions

- ❌ Static screenshot of the build (must be live iframe)
- ❌ Generic "Lorem ipsum" or unfilled `[PLACEHOLDER]` text, every field is real or auto-derived
- ❌ Pricing without the **Value Stack** + risk-reversal pill + dark hero monthly-fee card. The flat 2-row "setup + monthly" without the stack is DEPRECATED.
- ❌ **Mentioning "$1,000 setup fee" anywhere in the proposal**, `$1,000` is dropped sitewide. Setup fee is variable per client and discussed elsewhere; the proposal says "+ one-time setup fee" only. Also banned: "discussed on your sales call", "varies by complexity", or any other apologetic qualifier on the sub-line.
- ❌ §1 mobile bullets as paragraphs (`<p>` inside `.body`). Each bullet MUST be a single inline line: `<strong>OUTCOME.</strong> Tight proof.`
- ❌ §4 Blueprint cards as 3-col grid. MUST be vertical-stack accordion with the 1-line teaser sub visible while collapsed + colored category tag pill.
- ❌ §6 Sitemap as a flat list / pyramid / dark panel. MUST be the white-mode Relume tree (`#F7F5F0` bg) with connector lines OUTSIDE the cards (rail at top of cell, drop ends 2px above card top) and all 12 main cards clickable to a shared `pageDialog` modal.
- ❌ §7 AI Infrastructure with `<p>` paragraphs. MUST be 4-bullet mobile-bullets format with small icon chip + bottom-border head.
- ❌ §8 Timeline without the dashed agency-primary rail + numbered marker circles + final-step WIN treatment + outcome banner.
- ❌ §9 ROI with only 3 sliders OR with a single output number. MUST be 4 sliders + 3-up output (hero monthly + annual + ROI multiple).
- ❌ §10 carousel arrows positioned at `left:-18px / right:-18px` (overlap cards). MUST use the 64px gutter padding.
- ❌ Footer without {{AGENCY_FOOTER_TAGLINE}} + {{AGENCY_NAME}} URL
- ❌ Em dashes anywhere (per Layer 0 Golden Rule #7)
- ❌ Mockup `.phone` class colliding with topbar `.phone` (use `.topbar-phone` for the topbar span)
- ❌ Cover/hero text-only (must include `.cover-laptop` in the right column, the desktop preview is what proves the site exists in the first 5 seconds)
- ❌ Stacking laptop + phone in the same demo block (laptop lives in cover, phone lives in §1, see "Why two laptops are NOT used" above)
- ❌ {{AGENCY_NAME}} written reviews (§10) edited or rephrased, verbatim text only. Do not "fix" typos like "Ive been in [industry]" or normalize ALL-CAPS like "REAL DEAL". The Real Review Evidence Rule applies to {{AGENCY_NAME}}'s own reviews exactly as it applies to client review evidence.
- ❌ Replacing {{AGENCY_NAME}} video testimonials (§11) with client-specific videos, §11 is {{AGENCY_NAME}}'s portfolio (other roofing owners vouching for {{AGENCY_NAME}}), not the client's own video. Adding a client-specific video later is fine in a different section; never overwrite §11.
- ❌ Reverting §11 to a single-active-with-blurred-sides slider, the grid renders all 4 stories at once on desktop and stacks them on mobile, which is the canonical layout. A slider hides 3 of 4 stories behind navigation gestures and is banned.
- ❌ Moving §10 + §11 outside the ROI → testimonials → Pricing flow. The order is doubt-reducer → social proof → ask. Re-ordering breaks the close.

## Output artifact

`clients/{slug}/proposal/proposal.html`, one self-contained HTML file with inline CSS + JS, plus `agency-logo.svg` copied alongside it. Open in browser to view; share via web preview server or static-host upload.

## Deploy to Vercel (REQUIRED, every run)

Every Stage 13 run ends with a Vercel production deploy of the proposal folder. The closer sends the lead one URL, full stop.

**Project naming convention.** `<client-slug>-proposal` where `<client-slug>` matches the website Vercel project created in Stage 11. Derive the slug from `businessName`: lowercase, replace spaces with hyphens, strip ampersands and non-alphanumeric chars. Examples:

| Business name | Website project | Proposal project |
|---|---|---|
| Example Roofing Co. | `example-roofing-co` | `example-roofing-co-proposal` |
| Acme Roofing & Exteriors | `acme-roofing-exteriors` | `acme-roofing-exteriors-proposal` |
| Sunshine Painters Co. | `sunshine-painters-co` | `sunshine-painters-co-proposal` |

**Procedure.** Run from inside the proposal folder, never the repo root:

```bash
cd "clients/{Client Name}/{Client Name} Proposal"

# Link first
vercel link --yes \
  --project "{client-slug}-proposal" \
  --scope "{vercel scope from Stage 11 deploy-meta.json}"

# Deploy to production
vercel --prod --yes --scope "{vercel scope}"
```

**Capture and persist** the production alias + immutable URL + deployment ID into:

- `clients/{Client Name}/Pipeline Data/deploy/proposal-deploy-meta.json`
- `clients/{Client Name}/Pipeline Data/deploy/proposal-url.txt`

**Smoke checks (all four must pass before Stage 13 marks complete):**

1. `GET https://{client-slug}-proposal.vercel.app/` returns **200**
2. The HTML title contains both the business name and `{{AGENCY_NAME}}`
3. `GET https://{client-slug}-proposal.vercel.app/build/` returns **200** (the embedded site iframe target)
4. `GET https://{client-slug}-proposal.vercel.app/agency-logo.svg` returns **200**

If any smoke check fails, halt with `failed`. Do NOT advance Stage 13 to complete. Fix the source folder (most likely a missing copied asset) and re-run from substitution.

**Pre-flight requirement.** `vercel whoami` must return a logged-in user. If not: halt with "Vercel CLI not logged in. Run `vercel login` then re-run."

## Iteration discipline

After running, **DO NOT** auto-write a retrospective or append registry rows. Operator drives iteration. If the proposal needs improvements (per {{AGENCY_PRIMARY_CONTACT}} / sales-call feedback):
1. Operator gives specific feedback
2. Agent edits this SOP + the per-client proposal directly
3. Future proposals inherit the improvement

## Cross-references

- [`skills/06-proposal/SKILL.md`](../skills/06-proposal/SKILL.md), the skill that orchestrates this stage
- [`design-system/rules/cta-rules.md`](../design-system/rules/cta-rules.md) §"3D blue-collar button style", proposal CTAs follow this spec
- [`sops/00-master-blueprint.md`](00-master-blueprint.md), Layer 0 (em-dash ban + {{AGENCY_NAME}} attribution + general discipline)
- Reference: agency-brand.json blueprint_pdf_path (agency owns the source blueprint; populated via `/setup-agency`)

## Validated source build

Reference renders at:
  - 1920×1080: `cover-grid` `640px 640px`, H1 = 2 lines at 40px, section-title = 2 lines at 38px
  - 1400×900: `cover-grid` `640px 640px`, H1 = 2 lines at 34px (clamp lower bound), section-title = 2 lines
  - 1280×800: cover stacks single-column (1216px wide), laptop centers under, H1 = 2 lines at 34px
  - 375×812 (mobile): single column, H1 = 3 lines at 30px, section-title = 4 lines at 28px (both within Layer 0's "≤ 4 lines on mobile" cap), no horizontal scroll

All iframes must load cleanly, ROI calculator working, no console errors.

## Changelog

- **2026-05-06 (late)**, Major conversion-focused upgrade across 7 sections:
  - **§1 Mobile-First**: bullets rewritten in **{{AGENCY_PRIMARY_CONTACT}} voice** (outcome-led one-liners, ≤14 words each, 22px tall single line desktop). `<strong>` is `display:inline`, NO `<p>` paragraph wrapper. Eyebrow renamed "What this means for [Brand]".
  - **§4 Proven Blueprint**: cards upgraded with **rounded-square gradient num tile** (navy→graphite, swaps to red gradient on open with -3° tilt), **1-line teaser sub** visible while collapsed, **colored category tag pill** (Trust/Convert/Brand/SEO/Mobile), 3-bullet body (was paragraph), **stat-driven Why callout** (big agency-primary number left + tight proof right), **See-it-live as a real button** (was dashed link).
  - **§6 What's Included**: rebuilt as **Relume-style white-mode tree** (`#F7F5F0` panel bg). Home root + Tier 1 Core + Tier 2 Pillars + Tier 3 Silos. Connector rail + drops sit OUTSIDE cards (verified 2px gap above card top). All 12 main cards (root + 5 Core + 7 Pillars) clickable, opening a shared `<dialog id="pageDialog">` populated by JS `PAGE_DATA` map (8-the niche-wireframe sections per page in Relume page-card layout). Replaces the old flat ordered-list sitemap.
  - **§7 AI Infrastructure**: paragraph bodies replaced with **4-bullet mobile-bullets format** per card. Icon chips standardized as 2-3 letter abbreviations (AI/CAL/REV/CB).
  - **§8 Timeline**: added **dashed agency-primary horizontal rail** behind cards + **48px numbered marker circles** perched on the rail + **final-step WIN treatment** (white-to-accent-light gradient bg, agency-primary border, win-stamp pill, inverted marker) + **transformation banner** below (eyebrow + outcome line from agency-brand). Step bullets gained `<strong>` outcome lead-ins.
  - **§9 ROI Calculator**: 3 sliders → **4 sliders** with the 4th being "Lift after we ship" (the conversion lever, default 30%, hint "{{AGENCY_NAME}} avg: 30–50%"). Output redesigned: hero `+$X/mo` (60px gold) + "From N extra closed jobs a month, built on YOUR numbers, not agency hype" sub + 2 supporting stats (annual lift + **ROI multiple over the monthly fee** as the closer). Section kicker "ROI Calculator" → "Run Your Numbers".
  - **§12 Pricing**: redesigned as **value-stacked premium card**. Drops the flat setup+monthly row layout. Adds: **Value Stack panel** (5 line-items at MSRP totaling a total stacked value) + **green risk-reversal pill** above the price + **dark hero price card** (navy gradient with the monthly fee at 84px as the hero number). Sub line: "+ one-time setup fee" only. The exact setup fee is configurable per client.
  - **§13 Acceptance**: copy updated to drop the `$1,000 setup fee` mention.
  - **§10 {{AGENCY_NAME}} Reviews carousel**: arrows moved into a 64px gutter padding so they NEVER overlap card text.
  - Banned executions list expanded with all the new "MUST" rules.

- **2026-05-06**, Added §9 {{AGENCY_NAME}} Written Reviews + §10 {{AGENCY_NAME}} Video Testimonials between ROI and Pricing. §9 is a horizontal scroll-snap carousel of all written reviews (verbatim, injected from `agency-brand.json` reviews[]). §10 is a 1-4 card grid (responsive layout) of portrait-aspect cards, each with a click-to-play MP4 (injected from `agency-brand.json` case_studies[]). These are agency-level inputs shared across every client proposal. _Initial §10 draft was a side-blur slider; replaced same-day with the grid because the slider hid stories behind navigation gestures._
- **2026-05-04**, Container max-width 1200px → 1400px (more usable width on 1920px+ Zoom-share viewports). Cover-laptop bumped 560px → 640px with iframe `scale(0.484)` and 380px viewport. H1 sizing made responsive (`clamp(34px, 2.4vw, 40px)`) with `text-wrap: balance` + `max-width: 28ch` so it always renders ≤ 2 lines on desktop. Cover-grid breakpoint moved from 1100px → 1380px so narrow desktops stack single-column instead of squeezing the H1 to 3 lines. Added "Container width", "Heading line-break discipline", and "Cover-grid responsive breakpoint" sections to this SOP.
- **2026-05-03**, Restructured: cover became 2-column (content + laptop), demo became phone + 6 conversion bullets. Old layout had laptop+phone stacked in a single "Live Demo" block after a text-only hero; new layout puts the laptop in the hero so the prospect sees the live site in the first 5 seconds, and reserves §2 for the mobile-conversion narrative.
- **2026-05-02**, Initial agency proposal generator (Stage 13) per May 1 meeting structure.
