# 10c - UI Uplift SOP

Implements: Stage 10c.

Loop cap: 3. Pass threshold: all checklist items confirmed.

The niche template (`templates/{active-niche-slug}/`) ships with most
uplift items already baked in by Module 2D (3D icons, scroll reveals,
hover lift, marquee strips, hero entrance, animated badges, the
persistent mobile CTA pattern the niche wireframe specified). Stage
10.3 now only handles the small set of OPTIONAL extras that aren't
shipped in the niche template and depend on per-client signals.

If none of the optional extras apply to this client, this stage is a
no-op.

## Prerequisites

Read all 3 skills in order before starting:
1. `system/.claude/skills/ui-ux-pro-max/SKILL.md`
2. `system/.claude/skills/framer-motion/SKILL.md`
3. `system/.claude/skills/frontend-design/SKILL.md`

Then read the active niche's checklist:
`templates/{active-niche-slug}/.claude/checklists/uplift.md` (when
present — Module 2D writes per-niche uplift extras here).

Optional: query 21st.dev MCP and React Bits MCP for component sourcing
in Step 7.

## Procedure

### Step 1 - Audit Lucide icons

Replace any remaining Lucide line icons in `clients/[slug]/build/src/`
with 3D-style or custom illustrated equivalents per the brand-dna.json
motif and shape_mode. The niche template's `icon-3d` CSS class
(when present) defines the icon treatment.

Nav utility icons and close/chevron controls are exempt.

### Step 2 - Animated SVG backgrounds (per niche template)

If the niche template already mounts background SVG components
(via `BackgroundPattern` or equivalent), confirm they render on the
sections the niche wireframe specifies. Do not add a second animation
layer to sections that already have decorative motion.

### Step 3 - Framer Motion polish

Where the niche template prescribes scroll reveals + hero entrance + hover
states + marquee strips, confirm they fire correctly. Use the existing
`anim-in` / `visible` CSS classes (or whatever the niche template ships)
as the canonical animation contract.

`prefers-reduced-motion: reduce` MUST disable every animation. Verify
with DevTools emulation.

### Step 4 - Trust signal polish

If the niche template surfaces trust badges (any shape — strip, floating,
inline, footer wall), apply the niche playbook's prescribed motion treatment
(shimmer-on-load, stagger entrance, hover scale). The niche playbook's
`trust-signals.json -> placements[]` declares which surfaces ship trust
badges; do not add motion to surfaces the niche doesn't use.

### Step 5 - Persistent mobile CTA (per niche template)

The niche template ships the persistent mobile CTA element the niche
wireframe specified. Verify it renders at mobile viewport and is hidden
at desktop. If the niche playbook prescribes time-of-day logic
(business hours swap), confirm it fires.

If `brand-dna.business_hours.{tz,open,close}` are set AND the niche
playbook enables the swap, the in-hours primary action and after-hours
primary action come from the niche playbook's `copy-locks.json`.

### Step 6 - Animated counters on stats

For any numeric stat surfaces the niche template ships (review counts,
years in business, projects completed, revenue figures), wire a
scroll-triggered count-up animation. 800ms to 1.2s ease-out, fires
once on first scroll into view, honours `prefers-reduced-motion`.

### Step 7 - Component sourcing (if MCPs available)

For any component need not covered by the niche template, query
21st.dev MCP and React Bits MCP. Source components that fit the
brand-dna shape_mode + palette. Adapt all props to use CSS var tokens —
no hard-coded hex values.

## Output location

All changes write directly to `clients/[slug]/build/src/`. The build
must still compile after uplift. Run `npm run build` in
`clients/[slug]/build/` to verify.

Log results to `clients/[slug]/qa/uplift-runs/run-N/report.md`.

## Pass gate

All items in the merged uplift checklist (universal layer +
`templates/{active-niche-slug}/.claude/checklists/uplift.md` when
present) must be confirmed.

## Failure handling

- Loop cap 3 reached with failing items: write
  `MANUAL-INTERVENTION-NEEDED.md` listing exact failures.
- `npm run build` fails after uplift changes: revert the last edit
  that introduced the error, log it, continue with remaining checklist
  items.

## What this agent never does

- Rebuild any niche template component from scratch — enhance only
- Add animations to every section — surgical application only
- Vary the locked CTA copy or trust signal claims during uplift
- Hard-code hex values — all colours use CSS var tokens
- Add or remove any of the niche-wireframe sections — uplift is
  polish only, not restructure
