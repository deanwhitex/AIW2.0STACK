# Web Design Research → File Mapping

Maps every actionable tactic from
`research/_framework/web-design-research-2026-05.md` to the repo file(s) where
it lands. Source of truth for "where is tactic N implemented?". Updated when
a tactic moves or a new file consumes it.

## Section 1: Top 15 actionable tactics

| # | Tactic | Where it lives |
|---|---|---|
| 1 | Variable font + humanist sans pairing (Fraunces + Plus Jakarta Sans) | `templates/{niche-slug}/src/index.css` (@import), `tailwind.config.js` (fontFamily) |
| 2 | Editorial hero restraint (eyebrow + headline + sub + 1 CTA) | niche playbook: `templates/{niche}/niche-playbook/hero-composition.md` (the per-niche layout); shell stays data-driven |
| 3 | 1.25 / 1.333 modular type scale | `templates/{niche-slug}/tailwind.config.js` (`fontSize` extend; named `display-sm/md/lg/xl` tokens) |
| 4 | Body line-height 1.55-1.65, display 1.05-1.1 | `tailwind.config.js` (`lineHeight` extend: `leading-display`, `leading-body`) |
| 5 | Negative letter-spacing on headlines, positive on eyebrows | `tailwind.config.js` (`letterSpacing` extend: `tracking-display`, `tracking-eyebrow`) |
| 6 | Curly quotes, en-dashes, ellipsis, tabular numbers | `references/copy/typographic-standards.md`, `tools/copy-lint.py`, `index.css` (`.tabular-nums`) |
| 7 | Real photography, no stock, niche-specific shot list | `.claude/sops/04-assets.sop.md`, niche playbook: `niche-playbook/photo-manifest.json` |
| 8 | Asymmetric layouts over 3-column grids | per-niche component design at `templates/{niche}/src/components/` (Module 2D scaffolds) |
| 9 | Scroll-linked headline reveal | `templates/{niche-slug}/src/components/ScrollRevealHeadline.jsx` |
| 10 | `prefers-reduced-motion`, no `transition: all` | `templates/{niche-slug}/src/index.css` (`@media (prefers-reduced-motion: reduce)` block); SOP 13 enforces no `transition: all` |
| 11 | Premium easings (`cubic-bezier(0.16, 1, 0.3, 1)`) | `tailwind.config.js` (`transitionTimingFunction`), `index.css` (`--ease-default`, `--ease-emphasis`, `--ease-premium-in`) |
| 12 | 8pt spacing scale with named tokens | `tailwind.config.js` (`spacing` extend: `section-gap`, `section-gap-lg`, `card-pad`) |
| 13 | 5-token palette discipline | `tailwind.config.js` (existing CSS-var palette: navy/gold/steel/cool/silver/ink); per-client values injected by `inject-theme.mjs` |
| 14 | Mobile sticky inquiry bar (no desktop) | `templates/{niche-slug}/src/components/the niche template's mobile CTA component` (already existed) |
| 15 | Layered shadows (ambient + direct) | `tailwind.config.js` (`boxShadow` extend: `shadow-card`, `shadow-card-lg`, `shadow-floating`) |

## Section 2: Anti-patterns to ban

| Anti-pattern | Enforcement |
|---|---|
| Inter as the only typeface | `tailwind.config.js` fontFamily defaults to Fraunces + Plus Jakarta Sans |
| Purple-to-blue gradient hero | (informational; no automated check yet) |
| Three-column feature grid with icons | (informational; design-fidelity QA flags it via the niche playbook's anti-patterns list) |
| Stock photography | `sop/04-assets.sop.md` bans stock; photo manifest enforces shot types |
| Vague aspirational headlines | `copy-lint.py` blocks vocab; niche playbook's copywriting framework provides patterns |
| Em-dashes | `copy-lint.py` hard fail; `references/copy/typographic-standards.md` |
| AI vocabulary tells (realm, tapestry, beacon, etc.) | `references/copy/ai-vocab-blocklist.md` + `tools/copy-lint.py` |
| Uniform 16px border radius and 24px padding | `tailwind.config.js` spacing scale varies tokens |
| Centered hero with one button on gradient | per-niche hero composition prescribes; SOP 08 enforces |
| Auto-playing motion / scroll-jacking | SOP 13 forbids; `prefers-reduced-motion` gates |

## Section 3: Hero design specifics

| H# | Tactic | Where |
|---|---|---|
| H1 | Golden hour / candlelit photography | `niche-playbook/photo-manifest.json` (lighting fields); SOP 04 |
| H2 | Location-as-protagonist (detail over wide aerial) | `niche-playbook/hero-composition.md` |
| H3 | Eyebrow + Headline + Sub + One CTA above fold | `niche-playbook/hero-composition.md`; niche template's `the niche template's Hero section component` |
| H4 | 1-3 second slow Ken Burns or static, never autoplay video | SOP 08; Hero component implementation |
| H5 | Vignette bottom 30% only, no full overlay | SOP 08; niche playbook's hero spec |

## Section 4: Trust + social proof

| T# | Tactic | Where |
|---|---|---|
| T1 | Real reviews with named source, photo, date | `.claude/skills/research/SKILL.md` review extraction; niche template's `the niche template's Reviews section component` |
| T2 | Host face shown once, prominently | `niche-playbook/photo-manifest.json` (people category); niche template's `the niche template's Founder section component` |
| T3 | Wordmark certifications, not gaudy badge clusters | niche playbook's `trust-signals.json` defines the badge presentation mode |
| T4 | Real named stories per gallery entry | niche template's gallery component; SOP 04 asset spec |
| T5 | Transparent pricing | niche playbook's `cro-rules.md` (pricing pattern); SOP 06 copywriting |

## Section 5: Motion + microinteractions

| M# | Tactic | Where |
|---|---|---|
| M1 | One scroll-linked headline reveal per page | `ScrollRevealHeadline.jsx` |
| M2 | Spring hover (200/300ms in, 400/500ms out) | `index.css` (`--hover-duration`, `--hover-out-duration`); SOP 13 |
| M3 | Image card stagger fade-in | per-niche gallery component using framer-motion + `--entrance-stagger` |
| M4 | `position: sticky` not `position: fixed` for in-content | SOP 13 enforces |
| M5 | Page transitions: 200ms fade + 8px translate | `PageTransition.jsx` |

## Section 6: Typography + spacing

| Ty# | Tactic | Where |
|---|---|---|
| Ty1 | Variable fonts + `font-optical-sizing: auto` | `index.css` (font @import + `html { font-optical-sizing: auto }`) |
| Ty2 | 1.25 / 1.333 modular scale | `tailwind.config.js` `fontSize` extend |
| Ty3 | Display tracking -0.025em, eyebrow +0.12em uppercase | `tailwind.config.js` `letterSpacing` extend |
| Ty4 | Body line-height 1.6, display 1.05 | `tailwind.config.js` `lineHeight` extend |
| Ty5 | Max paragraph width 65-72ch | `tailwind.config.js` (`maxWidth.prose: 68ch`); `index.css` (`.prose-narrow`) |

## Section 7: Sources

The research synthesis cites 100+ public sources. Re-read
`research/_framework/web-design-research-2026-05.md` for the full list when
adding new tactics or updating existing ones.

## Adding a new tactic

When a new tactic gets adopted:
1. Add the tactic and its source URL to the research doc
2. Implement in the relevant file
3. Add a row to this mapping
4. Reference the mapping row in the implementing file's docstring/comment
5. If the tactic adds a copy-lint pattern, add it to
   `references/copy/ai-vocab-blocklist.md` or
   `references/copy/typographic-standards.md`
