# Agent: Template Builder (Module 2D)

## Role

Capture 8 to 12 best-of-niche websites via Apify. Score each with Claude
Vision against an end-customer conversion rubric. Show the student the
top 3 with side-by-side screenshots and scores. Let them pick one (or
specify a mix). Generate a pixel-accurate design spec, wireframe, and
sitemap.

Then **generate the entire per-niche factory from scratch**: build
skeleton, per-section React components, per-route pages, niche playbook
(10 JSON files), per-niche SOPs, per-niche QA checklists, per-niche
agents, per-niche prompts.

There is NO shared baseline. Every niche is generated end-to-end from
its own captured research, the canonical brand-dna shape contract at
`website-factory/references/brand-dna.shape.js`, the universal blueprint
at `website-factory/references/factory-blueprint/`, and the four design
skills (`frontend-design`, `impeccable`, `ui-ux-pro-max`,
`taste/skills/redesign-skill`).

The generator (`website-factory/tools/generate-factory.py`) handles the
deterministic plumbing. This agent doc tells Claude how to drive the
Claude-driven phases between the deterministic steps.

## Prerequisites

- `m2c.nicheDecided=true`
- `credentials.apify=true`
- `credentials.anthropic=true`
- `research/02-niche-research/{slug}/` exists with Module 2B research
  artifacts (Sub-tasks 1, 4, 6 minimum)
- Apify credit (~$4-5 for Phase 2 capture)

## Output artifacts

Under `research/02-niche-research/{slug}/`:
- `templates/raw/{site-slug}/` (per-site screenshots, DOM, CSS, fonts, colors)
- `templates/scores.md`
- `templates/pick.json`
- `09-template-spec.md`, `09-wireframe.md`, `09-sitemap.json`
- `niche-design-tokens.json`

Under `website-factory/templates/{niche-slug}/`:
- Full Vite + React + Tailwind project, generated end-to-end:
  - Build infra materialised from `references/factory-blueprint/` with
    niche tokens substituted
  - `src/config/brand-dna.example.js` stamped from
    `references/brand-dna.shape.js`
  - `src/components/` (one .jsx per wireframe section, Claude-generated)
  - `src/pages/` (one .jsx per sitemap route, Claude-generated)
  - `niche-playbook/` (10 JSON + markdown contracts, Claude-filled)
  - `.claude/sops/` (per-stage SOPs, Claude-generated)
  - `.claude/agents/` (per-stage agents, Claude-generated)
  - `.claude/checklists/sop-compliance.md` +
    `design-fidelity.md` (Claude-generated from wireframe)
  - `MANIFEST.json`

Under `website-factory/config/`:
- `template-routes.json` `byNiche.{niche-slug} = templates/{niche-slug}`

Under stack root:
- `stack-state.json gates.m2d.templateBuilt = true`
- `stack-state.json gates.factory.generated = true`

## Phase 1: Source candidates

Pull 8 to 12 URLs from:

1. Module 2B agencies file (top 4 agency-built sites)
2. Module 2B CRO patterns file (top 4 niche-business sites)
3. Module 2B SEO landscape file (top 2 organic rankers per primary
   keyword; dedupe)

Ask the student for manual picks. Combine + dedupe by URL. Save to
`templates/candidates.json`.

## Phase 2: Capture via Apify

Use the `template-capture-and-build` skill. For each URL run
`apify/playwright-scraper` twice (desktop 1440x900, mobile 390x844).
Save outputs to `templates/raw/{site-slug}/`: `desktop.png`,
`mobile.png`, `dom.html`, `css.json`, `fonts.json`, `colors.json`. Log
every actor run. Halt if total cost approaches $8.

## Phase 3: Score with Claude Vision

For each captured site, read screenshots + DOM + CSS. Score against the
8-category 100-point rubric (CTA visibility, trust signal density,
hero clarity, mobile pattern, visual coherence, navigation, form
friction, conversion confidence). Write `templates/scores.md` with
breakdown + rationale + `distinctive_moves` + `anti_patterns` per site.

## Phase 4: Present top 3, capture pick

Sort by score, take top 3. Show the student the screenshots + rationale.
Capture their decision in `templates/pick.json` (winner OR mix of
heroFrom / sectionOrderFrom / typographyFrom / colorSystemFrom /
trustStackFrom / ctaFrom / navigationFrom / formPatternFrom /
mobilePatternFrom).

## Phase 5a: Design spec + wireframe + sitemap

**Skills invoked:**
- `website-factory/.claude/skills/taste/skills/image-to-code-skill/SKILL.md` — analyse the captured reference pool's screenshots + DOM for layout patterns
- `website-factory/.claude/skills/design-language-extraction/SKILL.md` — produce the per-niche design vocabulary (`niche-playbook/design-vocabulary.md`) from the pool
- `website-factory/.claude/skills/design-synthesis/SKILL.md` — synthesise consistent design decisions across the pool

Claude Vision analyses the picked sites and produces:

- `09-template-spec.md`, pixel-accurate design spec
- `09-wireframe.md`, ASCII sketches per page type. Each section in the
  homepage wireframe documents:
  - Section name + slug
  - Layout variant (split-screen, asymmetric, centered, full-bleed,
    etc.)
  - Composition annotations (above/below fold, column ratios, image
    placement, CTA position, mobile reflow)
  - Brand-dna paths the section reads
  - SSIM region weight + threshold
- `09-sitemap.json`, page tree + keyword anchors + per-page section
  list

## Phase 5b: Extract niche design tokens

```bash
python3 website-factory/tools/extract-niche-design-tokens.py \
  --slug {niche-slug}
```

Writes `niche-design-tokens.json` with palette (10 hex), typography
(heading + body family + Google-Fonts URL fragment), motion preset,
theme mode, shape motif.

## Phase 5c: Materialise the build skeleton

```bash
python3 website-factory/tools/generate-factory.py --niche {niche-slug} --force
```

The orchestrator handles deterministic steps:

- Phase 0: prerequisite verification
- Phase 1: copy `references/factory-blueprint/` -> `templates/{niche-slug}/`
- Phase 2: substitute `{{...}}` slots in `*.template` files using
  `niche-design-tokens.json`
- Phase 3: stamp `references/brand-dna.shape.js` into
  `templates/{niche-slug}/src/config/brand-dna.example.js` (renaming
  the export from `brandDNAShape` to `brandDNA`)

At this point the niche template has build infrastructure but no
section components, no pages, no playbook, no SOPs, no checklists, no
agents, no prompts. The next phases fill those.

## Phase 6: Generate per-section React components (Claude-driven)

For each section in the niche wireframe:

1. **Read inspiration**:
   - `website-factory/.claude/skills/frontend-design/SKILL.md`,
     anti-AI-aesthetic guardrails + component patterns
   - `website-factory/.claude/skills/impeccable/CLAUDE.md` + relevant
     references under `impeccable/skill/reference/`, 5-dimension audit
     framework (a11y, performance, theming, responsive, anti-patterns)
   - The captured winner screenshots + DOM at
     `research/02-niche-research/{slug}/templates/raw/{winner}/`
   - The section's wireframe entry (layout variant + composition
     annotations + brand-dna path list)

2. **Generate the JSX** at
   `templates/{niche-slug}/src/components/{SectionName}.jsx`:
   - Imports `brandDNA` from `../config/brand-dna`
   - Reads ONLY canonical paths from
     `references/brand-dna.shape.js` (any off-shape access fails Gate 1)
   - Implements the wireframe's layout variant + composition
   - Uses tailwind classes referencing the niche token CSS variables
   - Honours `prefers-reduced-motion`
   - No em-dashes, no AI-vocab blocklist terms
   - No locked-copy hardcodes; all copy comes from `brandDNA.copy.*`
     paths Stage 10.1 fills from the niche playbook

3. **Self-audit** against the 5-dimension audit framework.

Section count + section names come from the niche wireframe. There is
no fixed list; some niches will have 6 sections, some 10, some more.

## Phase 7: Generate per-route pages (Claude-driven)

**Skills invoked:**
- `website-factory/.claude/skills/frontend-design/SKILL.md` — page-level composition + layout discipline
- `website-factory/.claude/skills/impeccable/skill/reference/audit.md` — 5-dimension a11y + responsive audit applied to each page

### Per-page generation

For each route in `09-sitemap.json`:

1. **Read the route's section list** from `09-wireframe.md` (per-page section composition) and the section IDs Phase 6 generated.
2. **Generate `templates/{niche-slug}/src/pages/{PageName}.jsx`** that imports the section components from `../components/` and composes them in the order the wireframe specifies. Each page is a thin shell — no business logic in pages, only composition.
3. **Verify each imported component actually exists** under `src/components/`. Halt + retry Phase 6 if a wireframe-named section is missing.

### Quality requirements (every page Claude writes)

- **Semantic HTML.** Use `<main>`, `<section>`, `<nav>`, `<aside>`, `<footer>` per the section role. Don't wrap everything in `<div>`.
- **Accessibility.** Every interactive element is keyboard-reachable + has a visible focus ring. Landmark roles where appropriate. Heading hierarchy starts at `<h1>` per page (one per page) and goes down sequentially.
- **Mobile-first responsive.** Compose the layout for 375px first, then layer breakpoints (`md:`, `lg:`) for wider viewports. Don't ship desktop-first markup.
- **No inline styles.** Every visual decision goes through Tailwind utility classes or CSS variables defined in `src/index.css`. No `style={{ ... }}` on elements.
- **`prefers-reduced-motion` respected.** If the page imports animated components, those components must already honour the user's reduced-motion preference (Phase 6 enforces). The page wrapper shouldn't introduce its own animations that bypass that.
- **No em-dashes, no AI-vocab blocklist terms** in any page-level copy. (Same rule Phase 6 applies to components.)
- **No hardcoded routes.** Every route literal lives in `App.jsx`'s `<Route path="...">` (filled in App.jsx wiring below). Pages don't carry route strings.

### App.jsx wiring

Update `templates/{niche-slug}/src/App.jsx` by replacing the `{{PAGE_IMPORTS}}` + `{{ROUTES}}` slots (these slots survive Phase 2's token substitution intact; Phase 2 explicitly leaves them alone for this step):

1. **`{{PAGE_IMPORTS}}`**: emit one `import { PageName } from './pages/PageName.jsx';` per route.
2. **`{{ROUTES}}`**: emit one `<Route path="..." element={<PageName />} />` per route, in sitemap order. URL paths must match `09-sitemap.json` exactly.
3. **404 fallback**: add `<Route path="*" element={<NotFoundPage />} />` as the last entry. Phase 7 must also generate a `NotFoundPage.jsx` (semantic 404 with a primary CTA back to home).
4. **`aliasPages` from `proposal-pages.json`**: alias pages don't get their own routes — they resolve to URLs the niche template ALREADY ships (services / about / etc.). Verify each alias's `fallbackUrl` matches an existing route.

### Verification (Phase 7 self-check before Gate validation)

- Every route in `09-sitemap.json` ends up in App.jsx (count must match exactly)
- Every `<Route>` element points at an imported component that exists
- The 404 route is last + uses `path="*"`
- No surviving `{{PAGE_IMPORTS}}` or `{{ROUTES}}` placeholders in the final App.jsx

If any check fails, halt + flag the gap — Gate 6 would catch it later anyway, but Phase 7 self-check makes the loop-back trip shorter.

## Phase 8: Generate the niche playbook (Claude-driven)

Write every required JSON + markdown file under
`templates/{niche-slug}/niche-playbook/`. Each file maps to a schema or
contract under `website-factory/references/niche-playbook/`. Gate 6 of
the validator (`tools/validate-niche-template.py`) halts the run if any
required JSON below is missing.

**Skills invoked:**
- `website-factory/.claude/skills/copywriting/SKILL.md` — for the `copywriting.md` + `cro-rules.md` + `quantified-trust-templates.md` markdown contracts
- `website-factory/.claude/skills/design-language-extraction/SKILL.md` — for the `design-vocabulary.md` markdown contract
- `website-factory/.claude/skills/asset-scraping/SKILL.md` — informs `photo-manifest.json` + `asset-patterns.json` JSON contracts

### Required JSON files (Gate 6 enforces)

Validate each file against its schema before writing.

| File | Schema | Source (per-niche research) | Drives |
|---|---|---|---|
| `copy-locks.json` | `schemas/copy-locks.schema.json` | `09-template-spec.md` Primary/Secondary CTA + `02-customer-voice.md` form-header conventions | Stage 10.1 build, locked CTA + form header + privacy line + trust strip claims |
| `trust-signals.json` | `schemas/trust-signals.schema.json` | `05-trust-signals.md` from niche research (badges + issuer URLs + tier-rankings) | Stage 4 asset scraping, Stage 10.1 build, trust-signal placements + badge counts |
| `process.json` | `schemas/process.schema.json` | `09-template-spec.md` Process composition + `09-wireframe.md` step-count for the niche | Stage 10.1 build, process section step count + descriptions |
| `vocabulary.json` | `schemas/vocabulary.schema.json` | `02-customer-voice.md` + `04-search-and-keywords.md` + `09-template-spec.md` lexicon | Stage 6 copywriting, niche-specific word + phrase preferences |
| `motion-preset.json` | `schemas/motion-preset.schema.json` | `09-template-spec.md` motion idioms + the captured pool's hover/scroll patterns | Stage 10.1 build, Stage 13 motion-system, restrained vs energetic vs cinematic preset |
| `theme.json` | `schemas/theme.schema.json` | `09-template-spec.md` Theme section + the pool's light/dark stance | Stage 10.1 build, light / dark / both mode support |
| `hero-mood-mapping.json` | `schemas/hero-mood-mapping.schema.json` | `09-template-spec.md` Hero composition + the pool's mood signatures | Stage 9 hero image, mood -> lighting brief lookup |
| `photo-manifest.json` | `schemas/photo-manifest.schema.json` | `09-template-spec.md` Photo direction + the pool's image categories | Stage 4 asset scraping, shot list + counts + lighting per niche |
| `asset-patterns.json` | `schemas/asset-patterns.schema.json` | `09-template-spec.md` Asset surface + the pool's filename / naming conventions | Stage 4 asset scraping, expected asset categories + naming patterns |
| `proposal-pages.json` | `schemas/proposal-pages.schema.json` | `09-sitemap.json` route list + `09-wireframe.md` section composition per route | Stage 13 proposal generator, per-niche PAGE_DATA pages + perServicePageTemplate + perAreaPageTemplate + aliasPages |

### Quality criteria (each JSON must satisfy)

- Every required field per the schema is populated (no nulls / empty strings)
- Counts derive from the niche research, not "feels right" defaults (e.g. `trustStripCount` from the most-common badge-strip count across the pool; `process.stepCount` from the most-common process-section step count)
- String values use the niche's end-customer vocabulary (per `02-customer-voice.md`), not AI-vocab blocklist terms
- File validates against its schema before Claude writes (use `jsonschema` Python library or equivalent; halt on error)

For `proposal-pages.json`, write the pages the niche actually ships — there is no hardcoded ID list anymore (the proposal modal's pyramid renders dynamically from per-page `tier` metadata). Every page entry MUST carry a `tier` field: `root` (the homepage, always one entry), `core` (universally-useful pages: About, Contact, Reviews, Gallery, FAQ — 3-6 entries), `pillar` (niche-specific pillar surfaces that drive conversion — 4-8 entries). Pillar pages that fan out to silo expansions also set `hasSilos: "service"` (for `perServicePageTemplate`) or `hasSilos: "city"` (for `perAreaPageTemplate`) so the pyramid renders a `+N` count badge.

Include `perServicePageTemplate` + `perAreaPageTemplate` when the niche template ships service detail + service-area routes. Include niche-specific `aliasPages` entries when the niche has shortcut surfaces (roofing: stormdamage, insuranceclaims; hospitality: bookings, event-spaces; auto-detailing: mobile-detailing; etc.). Each alias page also carries a `tier` field, typically `pillar`.

### Required markdown contracts

For each `*.contract.md` file under `references/niche-playbook/contracts/`, write the corresponding markdown to `templates/{niche-slug}/niche-playbook/{name}.md` covering every required section the contract describes:

- `copywriting.md`, niche voice + tone guidance
- `cro-rules.md`, conversion mechanics derived from top-of-niche analysis
- `design-vocabulary.md`, per-site one-liners + layout vocabulary catalogue + typography pairings + motion idioms (consumed by Stage 10.1 build + Stage 10.4a fidelity QA)
- `hero-composition.md`, complete per-niche hero image prompt template Stage 9 reads (composition spec + subject + mood baseline + region defaults + style ladder)
- `quantified-trust-templates.md`, niche-specific trust statement templates
- `copy-blocklist-additions.md`, niche-specific terms to add to the universal copy blocklist
- `sop-overrides/00-master.md` and other sop-overrides as the contract surface dictates

### Trust badges subfolder

Curate niche-specific badge SVGs into `templates/{niche-slug}/niche-playbook/trust-badges/` OR write `trust-badges/MANUAL-DROP-NEEDED.md` listing each badge with its issuer URL when SVGs aren't readily available. The student curates the SVGs manually after Module 2D completes.

## Phase 9: Generate per-niche SOPs + agents (Claude-driven)

For each pipeline stage that benefits from niche-specific knowledge, write a per-niche SOP at `templates/{niche-slug}/.claude/sops/NN-{stage-name}.sop.md` AND a per-niche agent at `templates/{niche-slug}/.claude/agents/{NN-stage-name}.md`. Both files are filled from the skeleton templates with EVERY `{{slot}}` substituted from the niche playbook + wireframe.

### Per-stage tailoring matrix

| Stage agent | Tailor? | Per-niche knowledge to encode | Skill(s) the per-niche agent invokes |
|---|---|---|---|
| `00-intake.md` | No | Universal intake form; no niche-specific tailoring | `asset-scraping/SKILL.md` |
| `01-research.md` | No | Universal research procedure | `template-capture-and-build/SKILL.md` |
| `02-seo-audit.md` | Light | Niche keyword cluster pointers (from `04-search-and-keywords.md`) | none required |
| `03-asset-scraper.md` | Yes | Niche photo categories (from `photo-manifest.json`) + niche-specific badge sources (from `trust-signals.json`) | `asset-scraping/SKILL.md` |
| `04-strategy.md` | Yes | Niche-specific service + areas hints (from `09-template-spec.md` Strategy section) | `copywriting/SKILL.md` |
| `05-copy-deck.md` | Yes | Niche voice anchors (`02-customer-voice.md`) + locked phrases (`copy-locks.json`) + AI-vocab blocklist + per-niche `copywriting.md` | `copywriting/SKILL.md` |
| `brand-dna-agent.md` | Yes | Niche palette / typography defaults (from `09-template-spec.md`) + canonical shape (`references/brand-dna.shape.js`) | `design-synthesis/SKILL.md`, `nano-banana/SKILL.md` |
| `07-5-brand-resonance.md` | Yes | Niche Reddit + review-mining queries (from `02-customer-voice.md`) | none required |
| `08-hero-image.md` | Yes | Niche hero composition template (`niche-playbook/hero-composition.md`) + mood mapping | `nano-banana/SKILL.md` |
| `09-build.md` | **Critical** | Component composition order from the niche wireframe + brand-dna canonical paths + Tailwind utility classes from `niche-playbook/motion-preset.json` + `theme.json` | `frontend-design/SKILL.md`, `impeccable/CLAUDE.md`, `impeccable/skill/reference/audit.md`, `ui-ux-pro-max/SKILL.md` |
| `10-personalize.md` | Light | Per-client `manual_overrides` mappings (from `09-template-spec.md`) | none required |
| `11-uplift.md` | Yes | Niche-specific optional extras (from `niche-playbook/motion-preset.json` + the niche wireframe's optional surfaces) | `ui-ux-pro-max/SKILL.md`, `taste/skills/redesign-skill/SKILL.md` |
| `12-delivery.md` | Light | Niche-specific handoff checklist items (from `09-template-spec.md`) | none required |
| `13-deploy.md` | No | Universal Vercel + CallRail wiring | `vercel-deploy/SKILL.md` |
| `14-proposal.md` | Yes | Niche-specific PAGE_DATA references (`niche-playbook/proposal-pages.json`) + per-niche pricing patterns | `copywriting/SKILL.md` |
| `design-fidelity-qa-agent.md` | Yes | Per-niche fidelity checklist + region weights (`templates/{slug}/.claude/checklists/design-fidelity.md`) | `impeccable/skill/reference/audit.md`, `taste/skills/redesign-skill/SKILL.md` |
| `sop-qa-agent.md` | Yes | Per-niche sop-compliance checklist (`templates/{slug}/.claude/checklists/sop-compliance.md`) + niche locked phrases | `impeccable/skill/reference/ux-writing.md`, `impeccable/skill/reference/harden.md` |

### Tailoring requirements (Gate 6 enforces)

For every SOP + agent file Claude writes:

- ZERO `{{slot}}` placeholders survive (Gate 6 fails hard on `{{` substring)
- Each file is at least 600 characters (Gate 6 enforces; aim higher — a properly-tailored SOP runs 1000-2000 chars; a properly-tailored agent runs 2000-4000 chars)
- Across the entire `.claude/agents/` set, at least one agent file contains a reference to a universal skill (Gate 6 enforces). The matrix above names which skill each agent should reference; Claude should follow the matrix not the minimum.
- Each agent doc includes: a `## Role` section, a `## Prerequisites` section, a `## Steps` section with numbered + named steps, a `## Pass gate` or `## Failure handling` section, and a `## What this agent never does` section

## Phase 10: Generate per-niche QA checklists (Claude-driven)

**Skills invoked:**
- `website-factory/.claude/skills/impeccable/skill/reference/audit.md` — 5-dimension audit framework drives the design-fidelity per-region checks
- `website-factory/.claude/skills/impeccable/skill/reference/ux-writing.md` — UI copy quality items inform the sop-compliance per-section checks

Generate:

- `templates/{niche-slug}/.claude/checklists/sop-compliance.md` from
  `references/factory-blueprint/checklists/sop-compliance.skeleton.md`
  + the niche wireframe. For each section in the wireframe, emit the
  per-section checks (composition matches wireframe, brand-dna paths
  canonical, copy from playbook).
- `templates/{niche-slug}/.claude/checklists/design-fidelity.md` from
  `references/factory-blueprint/checklists/design-fidelity.skeleton.md`
  + the niche wireframe. Region weights derived from where
  conversion-critical sections sit; thresholds from the
  09-template-spec.md fidelity table.

## Phase 11: Run the 6-gate validator (with loop-back on tailoring failures)

```bash
python3 website-factory/tools/validate-niche-template.py --niche {niche-slug}
```

| Gate | Type | Check |
|---|---|---|
| 1. brand-dna shape | HALT | Every generated component reads only canonical paths from `references/brand-dna.shape.js` |
| 2. ESLint + parse | HALT | Every JSX file is syntactically valid + lints clean |
| 3. Vite build | HALT | `npm install && npm run build` succeeds against a synthetic-filled brand-dna |
| 4. taste/redesign-skill audit | WARN | No high-severity generic-AI patterns |
| 5. SSIM vs winner | WARN | Rendered template SSIM-matches the winner at >= 0.70 |
| 6. Factory completeness | HALT | Every required artifact present AND tailored: components/, pages/, niche-playbook/ JSON (10) + markdown contracts (4), .claude/checklists/ with no surviving slots, per-niche SOPs + agents that are above min length, free of `{{slot}}` placeholders, and collectively invoke at least one universal skill (frontend-design / impeccable / ui-ux-pro-max / taste / etc.) |

Hard halts on 1, 2, 3, 6. Soft warnings on 4, 5.

### Loop-back behavior (Gate 6 tailoring failures)

When Gate 6 fails with skeleton-shaped or under-length SOPs/agents (the "you wrote stubs instead of tailored docs" failure mode), the validator's output carries a `Loop-back hint:` block naming the Module 2D phases to re-run. Loop back into those phases up to 3 times before giving up.

| Validator hint | Re-run |
|---|---|
| `Phase 6 (per-section components)` | Re-do Phase 6: regenerate the section JSX components |
| `Phase 7 (per-route pages)` | Re-do Phase 7: regenerate the page JSX files |
| `Phase 8 (niche playbook)` | Re-do Phase 8: regenerate the missing JSON/markdown files |
| `Phase 9 (per-niche SOPs + agents)` | Re-do Phase 9: regenerate the SOPs + agents with real niche content, filled slots, and skill invocations |
| `Phase 10 (per-niche QA checklists)` | Re-do Phase 10: regenerate sop-compliance.md + design-fidelity.md with the wireframe sections substituted |
| `Phase 12 (register + lock)` | Re-do Phase 12: write MANIFEST.json (this should only fire if Phase 12 was skipped or interrupted) |

After each re-run, re-execute `validate-niche-template.py` and read the new output. Continue looping until Gate 6 passes or 3 loops have been spent.

### Halt protocol (after loop cap or non-recoverable failures)

If after 3 loop-back attempts Gate 6 still fails, OR if any of gates 1/2/3 fail (which the loop-back doesn't address):

- Module 2D writes `templates/{niche-slug}/GENERATION-FAILED.md` with the precise validator output (including the loop-back hint history)
- `template-routes.json` is NOT updated
- `stack-state.json gates.factory.generated` stays false
- Stage 10.1 detects the marker and halts cleanly when invoked
- The student is told to inspect the failure marker and either fix the niche research inputs OR re-run `/build-niche-template` after addressing the cause

## Phase 12: Register + lock

If all hard gates passed:
- Write MANIFEST.json summarising every generated file
- Update `website-factory/config/template-routes.json` with
  `byNiche.{niche-slug} = "templates/{niche-slug}"`
- Set `m2d.templateBuilt=true` AND `factory.generated=true` in
  `stack-state.json`
- Append history entry
- Tell the student: "Niche factory generated at
  `website-factory/templates/{niche-slug}/`. The factory will use
  this template for client builds. Next: `/craft-offer`."

## When to halt

- Apify cost exceeds $8 for Phase 2
- Any HALT gate (1, 2, 3, 6) fails after Claude phases; do not
  register the niche
- Student wants to skip generation: write Phase 5a artifacts +
  `niche-design-tokens.json` only; do NOT scaffold the factory; set
  `m2d.templateBuilt=false` with a history note

## Files written

Under `research/02-niche-research/{slug}/`:
- `templates/candidates.json`, `templates/raw/...`, `templates/scores.md`,
  `templates/pick.json`, `templates/build-log.md`
- `09-template-spec.md`, `09-wireframe.md`, `09-sitemap.json`
- `niche-design-tokens.json`

Under `website-factory/templates/{niche-slug}/`:
- Full generated factory (see "Output artifacts" above)

Under `website-factory/config/`:
- `template-routes.json` updated

Under stack root:
- `stack-state.json` gates + history updated

## Skills consumed

- `website-factory/.claude/skills/frontend-design/SKILL.md` (Phase 6)
- `website-factory/.claude/skills/impeccable/CLAUDE.md` + references
  (Phase 6, audit framework)
- `website-factory/.claude/skills/ui-ux-pro-max/SKILL.md` (Phase 5c
  token generation)
- `website-factory/.claude/skills/taste/skills/redesign-skill/`
  (Phase 12 Gate 4)
- `.claude/skills/template-capture-and-build/SKILL.md` (Phases 2-3)
