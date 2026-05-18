# 00 - Master Pipeline Blueprint

## The pipeline stages + approval gate

| # | Stage | Output | Gate Threshold |
|---|---|---|---|
| 1 | Intake | intake.json + WEBSITE-SNAPSHOT.html | 4 fields validated |
| 2 | Research | research.json + brand-research.md | 11 sections present |
| 3 | SEO | seo-strategy.json + audit + revenue calc | 7 audit sections, ≥5 keyword gaps, $-figure |
| 4 | Asset Scraping | assets/{logo,photos,badges,owner}/* | logo found OR halt |
| 5 | Strategy | strategy/strategy.json + sitemap.json | per niche playbook |
| 6 | Copywriting | copy-deck.json + per-page .md | every sitemap page covered, zero placeholders |
| 7 | Brand DNA | brand-dna.json (5-pass extraction) | schema valid, aggregate confidence ≥ 0.70 |
| **GATE 1** | Brand DNA Approval | `/approve-brand-dna` | user issues command (only if confidence < 0.70) |
| 9 | Hero Image | hero-image/hero-final-{desktop,mobile}.png | both pass validation |
| 10.1 | Build | per-client Website/ + dist/ | Vite builds, every section in the per-niche template's canonical order populates |
| 10.2 | Personalise | per-client overrides applied | personalisation checklist passed |
| 10.3 | Uplift (optional) | optional extras wired per brand-dna signals | no-op when no triggers fire |
| 10.4a | Design Fidelity QA | qa-screenshots/* + scores.json | aggregate SSIM ≥ 0.90 per region, loop cap 5 |
| 10.4b | SOP QA | sop-runs/run-N/* | ≥ 95% pass, em-dash count = 0, loop cap 10 |
| 11 | Deploy | vercel-url.txt + deploy-log.json | Vercel build succeeds |
| 12 | Delivery | delivery-report.md | every checklist item passed |
| 14 | Proposal | proposal.html | zero `[BRACKET]` placeholders, iframe URL valid |

## Failure protocol

Any gate failure or loop cap breach:
1. Write `clients/[slug]/MANUAL-INTERVENTION-NEEDED.md` listing exact failures + fix instructions
2. Update `pipeline-state.json` with `status: "halted"`
3. Append to `build-log.md`
4. Halt. NO downstream stages.

## Two-zone discipline

- `system/` is FROZEN during client runs. The `pre-tool-use.sh` hook blocks writes to system/ when an active client is set.
- Per-client work goes ONLY to `clients/[active-client]/`.

## Cross-cutting requirements (every stage)

These are the **universal** invariants. The **niche-specific** locked phrases, counts,
and section order come from the niche playbook at
`templates/{active-niche-slug}/niche-playbook/`. Module 2D writes that playbook from
the top-of-niche research the student ran in Module 2D.

**Universal (apply to every niche):**

- ZERO em-dashes anywhere
- Smart-quote enforcement (curly quotes, real en-dashes, real ellipsis)
- AI-vocab blocklist enforcement (loaded from `references/copy/ai-vocab-blocklist.md`)
- `prefers-reduced-motion: reduce` honoured by every animation
- Schema validity at every gate that writes JSON
- Logo present (HALT on missing)

**Niche-specific (read from `niche-playbook/`):**

- LOCKED CTA: from `niche-playbook/copy-locks.json` → `ctaPrimary`
- LOCKED form header: from `niche-playbook/copy-locks.json` → `formHeader`
- LOCKED privacy line: from `niche-playbook/copy-locks.json` → `formPrivacy`
- LOCKED mobile call button: from `niche-playbook/copy-locks.json` → `mobileCallLabel`
- Trust signal claim count + badge count: from `niche-playbook/trust-signals.json` → `trustStripCount` (the niche template decides which surface renders these)
- Trust badge placements: from `niche-playbook/trust-signals.json` → `placements[]`
- Theme support (light/dark/both): from `niche-playbook/theme.json` (typical default: both)
- Process section step count: from `niche-playbook/process.json` → `stepCount`
- Home page section order: from the niche template's `HomePage.jsx` (Module 2D scaffolds
  it from the niche-specific spec)
