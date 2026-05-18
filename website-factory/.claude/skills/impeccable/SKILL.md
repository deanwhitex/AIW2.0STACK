---
name: impeccable
description: "Use when the user wants to design, redesign, shape, critique, audit, polish, clarify, distill, harden, optimize, adapt, animate, colorize, extract, or otherwise improve a frontend interface. Covers websites, landing pages, dashboards, product UI, app shells, components, forms, settings, onboarding, and empty states. Handles UX review, visual hierarchy, information architecture, cognitive load, accessibility, performance, responsive behavior, theming, anti-patterns, typography, fonts, spacing, layout, alignment, color, motion, micro-interactions, UX copy, error states, edge cases, i18n, and reusable design systems or tokens. Also use for bland designs that need to become bolder or more delightful, loud designs that should become quieter, live browser iteration on UI elements, or ambitious visual effects that should feel technically extraordinary. Not for backend-only or non-UI tasks."
license: Apache 2.0. Based on Anthropic's frontend-design skill. See impeccable/NOTICE.md for attribution.
---

# Impeccable

This file is the top-level entry point so the skill auto-discovers via the
standard `SKILL.md` convention. The canonical skill body lives at
`skill/SKILL.md` (frontmatter + design laws + the 23-command router table).

## How to invoke

The factory's pipeline agents (sop-qa-agent, design-fidelity-qa-agent,
14-template-builder, 09-build, 11-uplift) reference impeccable via specific
reference files under `skill/reference/`:

- `skill/reference/audit.md`, the 5-dimension audit framework (a11y,
  performance, theming, responsive, anti-patterns)
- `skill/reference/critique.md`, design critique methodology
- `skill/reference/polish.md`, surface-polishing commands
- `skill/reference/harden.md`, accessibility + hardening standards
- `skill/reference/ux-writing.md`, UI copy quality standards
- `skill/reference/typography.md`, typography rules
- `skill/reference/color-and-contrast.md`, palette + WCAG contrast

Plus 16+ other per-command reference files at `skill/reference/`.

The skill carries 23 user-invocable commands (`/impeccable audit`,
`/impeccable polish`, `/impeccable critique`, etc.). Each command's
reference loads on demand.

## Where the project-level overrides live

`CLAUDE.md` in this directory carries the repo's project-level instructions
for impeccable (post-update-cleanup overrides, register defaults, etc.).
Treat CLAUDE.md as the local override layer; `skill/SKILL.md` is the
upstream canonical source.

## Factory pipeline integration

| Pipeline stage | impeccable surface used |
|---|---|
| Stage 9 build (09-build.md) | `skill/reference/audit.md` for 5-dimension audit pass |
| Stage 10.3 uplift (11-uplift.md) | `skill/reference/polish.md` + `harden.md` |
| Stage 10.4a design fidelity QA | `skill/reference/audit.md` (dimensions 1, 4, 5) + `critique.md` |
| Stage 10.4b SOP QA | `skill/reference/ux-writing.md` + `harden.md` |
| Module 2D Phase 6 (component generation) | `CLAUDE.md` + `skill/reference/` files per section |

Read the specific reference file the stage needs, not the whole skill, to
keep the context budget tight.
