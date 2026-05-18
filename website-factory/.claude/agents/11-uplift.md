# Agent: UI Uplift (Stage 10.3)

## Role

SCOPED DOWN under the per-niche factory architecture. Most uplift items
the prior pipeline ran (3D icons, scroll reveals, hover lift, marquee
strips, hero entrance, animated trust badges, the persistent mobile CTA
element per the niche wireframe) are already baked into
`templates/{active-niche-slug}/` by Module 2D. Stage 10.3 now only
handles the small set of OPTIONAL extras that aren't shipped in the
niche template and depend on per-client signals.

If none of the optional extras apply to this client, this stage is a
no-op. Mark `stage_10_3: complete` immediately and hand off to Stage 10.4a.

## Prerequisites

- Stage 10.2 (Personalise) complete with `pipeline-state.stage_10_2 === 'complete'`
- `clients/[Client Name]/[Client Name] Website/dist/` exists (Stage 10.1 build)
- `clients/[Client Name]/Pipeline Data/brand/brand-dna.json` for the per-client signals checked below

## Steps

### Step 0, Read accumulated lessons (REQUIRED)

Before any other step, read these two files if they exist:

1. `.claude/lessons/by-agent/11-uplift.md`, universal corrections that apply to every run of this agent
2. `clients/[Client Name]/Pipeline Data/lessons/notes.md`, corrections specific to this client only

Lessons take precedence over the default behaviour in this spec.

### Step 1, Decide which optional extras apply

Read `brand-dna.json` and the niche playbook at
`templates/{active-niche-slug}/niche-playbook/` to decide which extras
the niche supports + the per-client signals trigger:

| Optional extra | Trigger condition | Action |
|---|---|---|
| Persistent mobile CTA time-of-day swap | `brand-dna.business_hours.tz` set AND `brand-dna.business_hours.{open,close}` defined AND niche playbook enables the swap | Add the time-of-day swap (Step 2) |
| Animated stats counters | `brand-dna.trust.years_in_business` >= 5 OR `brand-dna.reviews.totalReviewCount` >= 25 | Wire counter-up animation on visible numbers (Step 3) |
| Custom icon set replacement | `brand-dna.icon_set` field present AND not 'lucide' (the niche template default) | Swap Lucide icons for the named set (Step 4) |
| Time-of-day greeting | `brand-dna.copy.greeting_morning` / `_afternoon` / `_evening` populated AND niche template renders a greeting slot | Wire greeting in the relevant section (Step 5) |

If NONE of the trigger conditions match, skip directly to Step 6 (mark complete).

### Step 2, Persistent mobile CTA time-of-day swap (optional)

Wire `business_hours` from brand-dna to the persistent mobile CTA
element the niche template ships (location + component name per the
niche wireframe):

- During business hours: phone CTA primary (left), form CTA secondary (right)
- After hours: form CTA primary (left), phone CTA secondary (right)

Use the client's timezone from `brand-dna.business_hours.tz` (IANA, e.g. `America/Phoenix`).
Implementation pattern: a small `useEffect` that reads `Intl.DateTimeFormat` in the timezone, compares against open/close strings, and swaps button order via state. Server-render defaults to "during hours" so SEO crawlers see the simpler layout.

### Step 3, Animated stats counters (optional)

For any numeric stat surfaces the niche template ships (review count,
years in business, projects completed, etc.), wire a count-up
animation on first scroll into view. Use a single shared `useCountUp`
hook. 800ms duration, ease-out easing, `prefers-reduced-motion`
respected.

Which components ship which numbers is per-niche. Read the niche
wireframe (or the niche template's component source) to identify the
correct mount points; do not hardcode component names in this agent.

### Step 4, Custom icon set replacement (optional)

If `brand-dna.icon_set` specifies a non-default set:

- Replace Lucide imports in every component the niche template uses
  icons in (read the niche template's component tree to find them)
- Adapt sizes + stroke weights to match the niche template's existing
  visual rhythm (`w-4 h-4` to `w-6 h-6`, `strokeWidth={2}`)

Default `icon_set` = `'lucide'`, keep the niche template's icons as-is.

### Step 5, Time-of-day greeting (optional)

If `brand-dna.copy.greeting_morning` / `_afternoon` / `_evening` are
populated AND the niche template renders a greeting slot, wire them as
a small client-side swap. Same pattern as Step 2, `useEffect` reads
`Intl.DateTimeFormat` in the timezone, picks the matching greeting,
falls back to a static default for SSR.

### Step 6, Mark complete + hand off

Update `clients/[Client Name]/Pipeline Data/logs/pipeline-state.json`:
```json
{ "stage_10_3": "complete" }
```

Append to `clients/[Client Name]/Pipeline Data/logs/build-log.md`:
```
## Stage 10.3, Uplift
Status: complete
Optional extras applied: [list of triggers that fired, or "none, niche template defaults retained"]
```

Hand off to Stage 10.4a (design fidelity QA).

## Pass gate

- `pipeline-state.stage_10_3 === 'complete'` recorded
- Any optional extras listed in the build-log
- If extras were applied: re-run Stage 10.1's `npm run build` so the changes land in `dist/`
- No hardcoded hex values introduced (all per-client palette values stay in `brand-dna.js`, never inlined)

## What this agent NO LONGER does (per-niche-factory pivot)

The following lived in the prior 11-uplift but are now baked into
`templates/{active-niche-slug}/` by Module 2D:

- **3D icons** — the niche template's icon treatment ships per the
  niche playbook + niche wireframe
- **Animated SVG backgrounds** — `<BackgroundPattern>` (or the niche's
  equivalent component) mounts the per-client SVG from
  `brand-dna.shape_motif`; no separate animation pass needed
- **Scroll reveals + hero entrance** — the niche template's CSS handles
  fade-up on scroll for the section types the niche wireframe ships
- **Hover lift** — the niche template ships card elevation utilities
  consistent with its design language
- **Marquee strips** — the niche template ships the ticker / marquee
  component when the niche wireframe prescribes one
- **Persistent mobile CTA always-on sticky** — the niche template's
  persistent mobile CTA element is fixed at mobile breakpoints

These don't need re-doing per client. If a per-client run wants to
OVERRIDE one of them (e.g. switch off scroll reveals for a heritage-
feeling brand), the override goes in `brand-dna.json` under
`manual_overrides` and is consumed by the relevant component, not by
this stage.

The 21st.dev / React Bits MCP component sourcing path is also retired,
the niche template already ships the components we use; the pipeline
doesn't sample new ones per client.
