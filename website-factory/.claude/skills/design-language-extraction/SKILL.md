---
name: design-language-extraction
description: Extract the design vocabulary the build agent should pick from when composing client sites. Used by Module 2D during /build-niche-template to catalogue layout patterns, hero compositions, typography pairings, motion idioms, and palette signals from a curated pool of top-of-niche reference sites, and emit them as the niche-playbook design vocabulary document.
---

# Design Language Extraction

A skill that turns a captured pool of top-of-niche reference sites into
the structured design vocabulary the build agent reads at Stage 10.1.

## When this skill loads

Module 2D's `14-template-builder` agent invokes this skill during
Phase 5a (design spec + wireframe + sitemap generation). The skill
runs against the Apify capture set the agent collected at Phase 2
(8 to 12 reference sites with desktop + mobile screenshots, DOM, CSS,
fonts, colors per site) plus the winner pick from Phase 4.

## What this skill produces

A `templates/{niche-slug}/niche-playbook/design-vocabulary.md` file
that follows the structure in
`design-pool-vocabulary.md` (the catalogued vocabulary surface this
skill ships alongside).

Sections the document carries:

1. **Per-site one-liners**: one sentence per reference site naming
   dominant palette, typography family, hero composition archetype,
   standout decorative move
2. **Layout vocabulary catalogue**: recurring patterns across the
   pool grouped by section (hero, transitions, card grids, trust
   signal placement, etc.)
3. **Typography pairings**: which display + body pairings recur,
   what character they encode
4. **Motion idioms**: scroll reveal patterns, hero entrance signatures,
   hover treatments
5. **Palette discipline**: what the pool does well, what to avoid

## How to apply

1. Read the captured reference pool at
   `research/02-niche-research/{niche-slug}/templates/raw/{site-slug}/`
   per site (screenshots + DOM + CSS + fonts + colors).
2. Read the winner pick at
   `research/02-niche-research/{niche-slug}/templates/pick.json` to
   know which site's vocabulary leads each dimension (heroFrom,
   sectionOrderFrom, typographyFrom, etc.).
3. Read `design-pool-vocabulary.md` for the document structure +
   per-section guidance on what to catalogue.
4. Write the structured vocabulary to
   `templates/{niche-slug}/niche-playbook/design-vocabulary.md`.

## Consumed by

- **Build agent (Stage 10.1)**: reads `niche-playbook/design-vocabulary.md`
  to pick the right visual treatment per section
- **Design fidelity QA agent (Stage 10.4a)**: reads it to verify the
  composed site matches the niche's design language

## Output contract

The contract this skill writes against lives at
`website-factory/references/niche-playbook/contracts/design-vocabulary.contract.md`.
Module 2D's checklist verifies the output matches.

## Related skills

- `design-synthesis/SKILL.md`: extracts the per-client brand DNA from
  logo + research + asset analysis (different concern: brand DNA is
  per-client, design vocabulary is per-niche)
- `template-capture-and-build/SKILL.md`: the Apify capture path that
  produces the input pool this skill consumes
- `taste/skills/redesign-skill/SKILL.md`: audits the captured pool
  for generic-AI patterns to avoid
