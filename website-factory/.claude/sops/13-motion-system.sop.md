# SOP, Motion Design System

## Purpose

Standardise tasteful, restrained motion across all website-factory builds. Two tiers:
always-on micro-interactions and selectively-applied premium polish. Honours
`prefers-reduced-motion`.

## Niche customisation

The Tier 2 / "premium polish" decisions (which Tier 2 patterns the niche uses, which
easing personality fits the niche's voice) come from the niche playbook:

- `templates/{active-niche-slug}/niche-playbook/motion-preset.json`

Example presets the niche playbook may choose:
- `restrained`, premium easings only (`cubic-bezier(0.16, 1, 0.3, 1)` and similar),
  exclude bouncy/spring easings, smaller hover deltas, slower stagger, longer fade
  durations. Suits editorial / hospitality / luxury / professional-services niches.
- `energetic`, overshoot/bounce easings (`cubic-bezier(0.34, 1.56, 0.64, 1)`), larger
  hover deltas, faster stagger, snappier transitions. Suits trade / service /
  consumer-action niches.
- `custom`, niche playbook overrides individual values.

Default to `restrained` if `motion-preset.json` is missing.

## Tier 1, Always-on (every build, every section)

| Pattern | Spec | When NOT to use |
|---|---|---|
| Button hover | `translateY(-1px)` + shadow expand `0 4px → 0 6px`, `transition: 180ms` (timing function from the niche's `motion-preset.json` → `easeButtonHover`) | disabled / pressed states |
| Card hover | `transform: scale(1.02)` + `--card-shadow-layered`, `transition: var(--hover-duration) var(--ease-default)` | touch devices (`@media (hover: hover)`) |
| Scroll reveal | `.scroll-reveal` + `.is-revealed` toggle on intersection 0.15. Defined in tokens.css. | `prefers-reduced-motion` |
| Number count-up | Trust stats animate 0 → value over 1.4s `easeOutCubic` on first viewport entry | decorative numbers (year, phone digits) |
| Anchor smooth scroll | `html { scroll-behavior: smooth; }` | external links |
| Hero entrance stagger | `.hero-entrance-N` classes (1-6) keyed to `--entrance-stagger`. CTA easing comes from niche preset's `easeCtaEntry`. | `prefers-reduced-motion` |

## Tier 2, Premium polish (apply selectively, never stack on same section)

The niche playbook's `motion-preset.json` lists which of these Tier 2 patterns are
enabled and any niche-specific overrides.

| Pattern | Spec | When NOT to use |
|---|---|---|
| Limited parallax on hero image | `translate-y` at 0.15 multiplier max via `will-change: transform` | hero contains a foreground subject cutout (composed in Stage 9), or touch device |
| Scroll-driven progress bar | 2px brand-accent bar at top, `animation-timeline: scroll(root block)` | page under 2 viewport heights |
| Magnetic CTA | Button shifts 4px toward cursor within 60px proximity | more than one CTA in viewport simultaneously |
| Number-glow on hover | Trust stats brief brand-accent text-shadow pulse on hover | text under 18px or already brand-color |
| Image reveal (clip-path) | `clip-path: inset(0 100% 0 0) → inset(0 0 0 0)`, 700ms ease-out, on people/portrait photos only | 2+ images in viewport |
| Scroll-linked headline word reveal | per-word opacity 0.2 → 1.0 driven by `useScroll`, max one per page | `prefers-reduced-motion` |

## Implementation order
1. Tier 1 ships in tokens.css (`.hero-entrance`, `.scroll-reveal`, `.card-hover-lift`)
2. Tier 2 ships behind the niche's `motion-preset.json` enable flags
3. All animations honour `@media (prefers-reduced-motion: reduce)`, `animation-duration:
   0.01ms !important; transition-duration: 0.01ms !important`
4. Never use `transition: all`, explicit transition-property only (`transform, opacity`
   preferred for GPU acceleration)

## Pass gate (added to Stage 10.4b SOP QA)
- All buttons have hover transition
- All cards have hover lift
- Hero elements have entrance classes (`.hero-entrance-1` through 6)
- `prefers-reduced-motion` test viewport disables animations
- No `transition: all` anywhere in component CSS
- Easing curves match the niche's `motion-preset.json` (no bouncy easing in a `restrained`
  preset; no excessive ease-out-expo in an `energetic` preset)
