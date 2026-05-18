---
description: Apply accumulated factory-run lessons back to the niche starter template.
---

Gate: At least one entry in `research/lessons/factory-runs.md`. Strongly suggested at 3+ entries.

Steps:

1. Read `research/lessons/factory-runs.md` and `research/02-niche-research/{slug}/08-starter-template.md` and `website-factory/references/design-dna/active-template.md`.

2. Synthesize all lesson entries into a concrete change set. Group by template section: visual personality, typography, color, hero composition, section order, trust stack, CTA copy, form pattern, anti-patterns.

3. Show the student the proposed changes section by section. For each, show: old wording, new wording, source run number that surfaced the change. Ask: "Apply? (y / skip / refine the change)."

4. For approved changes, rewrite both:
   - `research/02-niche-research/{slug}/08-starter-template.md` (the source)
   - `website-factory/references/design-dna/active-template.md` (the live copy)

5. Append a refinement entry to `research/lessons/template-refinements.md`:
```
## Refinement NN, {YYYY-MM-DD}
Source runs: [list of run numbers]

Changes applied:
- [section] {old} → {new} (source: run #X)

Changes rejected:
- ...

Template version after this refinement: {hash}
```

6. Tell the student: "Template refined. Next factory run will use the new version. `/run-factory` for the next client."
