# 10b - SOP QA SOP

Implements: Stage 10b.

## Procedure

The QA loop runs against the merged checklist (universal layer + the
per-niche layer the active niche template ships at
`templates/{active-niche-slug}/.claude/checklists/sop-compliance.md`,
which Module 2D generated from the niche wireframe). Section composition,
component-specific checks, and route lists are NOT in this SOP; they live
in the per-niche checklist where Module 2D wrote them.

1. Loop (cap 10, threshold 95%):
   - Read the merged sop-compliance checklist (universal layer first,
     then per-niche layer for the active niche slug).
   - Run every check in the merged set.
   - Hard universal items (apply to every build regardless of niche):
     - Em-dash audit. `grep -rn ",|&mdash;|&#8212;" src/` MUST return 0
       matches (HARD GATE).
     - Locked-copy presence. Every `__REQUIRED__SOMETHING__` sentinel
       from `references/brand-dna.shape.js` must be resolved at build
       time (the niche template's prebuild
       `scripts/validate-brand-dna.mjs` enforces this).
     - Mobile 375px viewport renders without horizontal scroll.
     - Lighthouse perf >= 80 on mobile (informational gate; logged,
       does not halt by itself).
   - Per-niche items (resolved per the active niche's checklist + the
     niche playbook):
     - Section composition matches `09-wireframe.md`.
     - Trust signal placements match
       `playbook.trust-signals.placements`.
     - Process step count matches `playbook.process.stepCount`.
     - Theme toggle behavior matches `playbook.theme` (single mode vs
       toggle).
     - Niche-specific copy locks match `playbook.copy-locks.*`.
     - Route list matches `09-sitemap.json` (every route in the sitemap
       must build cleanly + render at runtime).
2. Compute pass rate over PASS + FAIL (excluding N/A).
3. If pass rate >= 95% AND em-dash count = 0: status passed.
4. Else fix failing items, increment loop, re-run.
5. Loop cap (10) hit -> halt, write final report.

## Pass gate

- Pass rate >= 95% on the merged checklist
- Em-dash count = 0 (HARD; not overridable)
- Every `__REQUIRED__*__` sentinel resolved (HARD; the prebuild hook
  guarantees this)
- Per-niche playbook fields populated (HARD; Stage 10.1 halts if any
  sentinel survives into `dist/`)
- OR `/override-sop` invoked (cannot override em-dash gate, sentinel
  gate, or surviving-sentinel gate)
