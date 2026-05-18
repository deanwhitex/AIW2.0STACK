---
description: Module 2D. Capture best-of-niche sites, score them, pick a winner, and generate the entire per-niche factory (components, pages, playbook, SOPs, agents, checklists) from scratch.
---

Gate: `m2c.nicheDecided` must be true.

Invoke the `14-template-builder` agent at `.claude/agents/14-template-builder.md`. Use the `template-capture-and-build` skill for Apify capture. The deterministic plumbing runs via `website-factory/tools/generate-factory.py`; the Claude-driven phases between deterministic steps fill components, pages, playbook, SOPs, agents, checklists.

There is NO shared baseline template. Every niche is generated end-to-end from its own captured research, the canonical brand-dna shape contract at `website-factory/references/brand-dna.shape.js`, the universal blueprint at `website-factory/references/factory-blueprint/`, and the four design skills (`frontend-design`, `impeccable`, `ui-ux-pro-max`, `taste/skills/redesign-skill`).

## Twelve phases

1. **Source candidates**, pull 8 to 12 best-of-niche URLs from Module 2B outputs plus optional manual picks.
2. **Capture via Apify**, playwright-scraper at desktop 1440x900 + mobile 390x844 (screenshots, DOM, CSS, fonts, colors).
3. **Score with Claude Vision**, every capture against the 8-category 100-point end-customer conversion rubric.
4. **Present top 3, capture pick**, student picks a winner OR specifies a mix (heroFrom / sectionOrderFrom / typographyFrom / colorSystemFrom / etc.).
5a. **Design spec + wireframe + sitemap**, generate `09-template-spec.md`, `09-wireframe.md`, `09-sitemap.json`.
5b. **Extract niche design tokens**, `tools/extract-niche-design-tokens.py` writes `niche-design-tokens.json` (palette, typography, motion preset, theme mode, shape motif).
5c. **Materialise the build skeleton**, `tools/generate-factory.py --niche {slug}` runs the deterministic plumbing (materialise blueprint, token substitution, stamp canonical brand-dna shape). At this point the niche template has build infrastructure but no section components, no pages, no playbook, no SOPs, no checklists, no agents.
6. **Generate per-section React components (Claude-driven)**, one `.jsx` per wireframe section. Imports `brandDNA` from the canonical shape; reads only canonical paths; implements the wireframe's layout variant; tailwind utilities reference the niche token CSS variables; honours `prefers-reduced-motion`; no em-dashes; no AI-vocab blocklist terms; no locked-copy hardcodes.
7. **Generate per-route pages (Claude-driven)**, one `.jsx` per route in `09-sitemap.json`. Each page imports the section components in the order the wireframe specifies. Fills the `App.jsx` route table.
8. **Generate the niche playbook (Claude-driven)**, every schema in `references/niche-playbook/schemas/` becomes a JSON file at `templates/{slug}/niche-playbook/`; every contract becomes a markdown file. Plus trust badges (curated SVGs or a `MANUAL-DROP-NEEDED.md` listing).
9. **Generate per-niche SOPs + agents (Claude-driven)**, one SOP + one agent per pipeline stage, filled from `references/factory-blueprint/sops/_stage-skeleton.md` + `agents/_stage-agent-skeleton.md`.
10. **Generate per-niche QA checklists (Claude-driven)**, `sop-compliance.md` + `design-fidelity.md` filled from the blueprint skeletons with the niche's actual sections, region weights, thresholds.
11. **Run the 6-gate validator**, `tools/validate-niche-template.py --niche {slug}`. Gates 1 (brand-dna shape), 2 (ESLint + parse), 3 (Vite build), 6 (factory completeness) are HALT. Gates 4 (taste audit), 5 (SSIM vs winner) are WARN.
12. **Register + lock**, write `MANIFEST.json`, update `website-factory/config/template-routes.json byNiche.{slug}`, set `stack-state.json gates.m2d.templateBuilt = true` AND `gates.factory.generated = true`.

## On hard-gate failure

Module 2D writes `templates/{slug}/GENERATION-FAILED.md` with the precise failure. `template-routes.json` is NOT updated. `factory.generated` stays false. Stage 10.1 detects the marker and halts cleanly when invoked.

## Cost

Estimated $4 to $5 in Apify credits for Phase 2 (combined with Module 2B research, total Apify spend per niche is roughly $5 to $7). Student may need to top up Apify before this command runs. Halt if Phase 2 cost approaches $8.

## On pass

Lock with `m2d.templateBuilt=true` AND `factory.generated=true`. Also set `niche.templateVersion = 1` (incremented by `/refine-template`).

## Output

A complete per-niche factory at `website-factory/templates/{niche-slug}/`:

- Vite + React + Tailwind project (build infra from blueprint, tokens substituted)
- `src/components/` per-section JSX (Claude-generated)
- `src/pages/` per-route JSX (Claude-generated)
- `src/config/brand-dna.example.js` (stamped from canonical shape) + sentinel-laden `brand-dna.js`
- `niche-playbook/` (full JSON + markdown contract surface)
- `.claude/sops/`, `.claude/agents/`, `.claude/checklists/` (per-stage, per-niche)
- `MANIFEST.json` summarising every generated file

The factory uses this template for client builds in this niche.
