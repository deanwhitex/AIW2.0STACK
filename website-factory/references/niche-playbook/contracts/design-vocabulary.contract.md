# Niche playbook contract: `design-vocabulary.md`

Catalogue of design patterns observed in the niche's reference pool that the
build agent picks from when composing client sites. Module 2D synthesises
this in Phase 5b from the 8-12 captured sites' visual analysis.

A complete `design-vocabulary.md` MUST cover the sections below.

---

## 1. Per-site one-liners

One sentence per captured reference site. Each sentence names: dominant
palette, typography family, hero composition archetype, standout decorative
move. The point is to give the build agent a vivid mental image of each
reference without re-reading the source.

Example pattern (do not copy verbatim, derive yours from the actual pool):

> - **{site-slug}**, Warm cream + oxblood palette with Fraunces display +
>   Plus Jakarta body, split-headline + golden-hour-property-photo right,
>   curved arc divider into reviews, no-people-in-hero discipline.

## 2. Layout vocabulary catalogue

The patterns common across the niche's reference pool, grouped by section.

### 2.1 Hero compositions
- **{pattern-name}** ({sites using this}), {description}. Mood: {tag}.

3-6 hero archetypes typical for the niche.

### 2.2 Section-to-section transitions
- **{pattern-name}**, {description}. Frequency in pool.

Niche-shaped section dividers: hard-cut, diagonal slice, arc, torn-paper,
topographic-line, etc.

### 2.3 Card grids
- **{N-up pattern}** ({sites}), {description + mood}.

What grid patterns the niche uses for services / offerings / portfolio.

### 2.4 Trust signal placements
- **{pattern}** ({sites}), {description}.

How the niche's pool composes trust signals (under-hero strip, badge wall,
inline checkmark, etc.).

### 2.5 Service / offering / category grids
- **{pattern}** ({sites}), {description}.

How the niche presents its service / offering / product / category tiles.

### 2.6 Gallery / portfolio patterns
- **{pattern}** ({sites}), {description}.

Carousel, masonry, named-project-cards, map-as-gallery-stand-in, etc.

## 3. Typography pairings catalogue

```
- **{heading-font} + {body-font}** ({sites using this}), {description}. Mood: {tag}.
```

Mood = the niche-appropriate emotional descriptor (editorial / industrial /
warm-family / luxe-restrained / etc.).

Plus weight-contrast and tracking patterns observed across the pool.

## 4. Palette idioms

Recurring colour structures the pool uses:
- **{idiom-name}** ({sites using this}), {description}.

Examples: warm-paper + oxblood accent; dark-monochrome + saturated accent;
near-black + cream + tan + gold; cobalt + cream + sand; etc.

## 5. Motion idioms

Motion patterns the niche's pool uses (where it motions at all):
- **{pattern}** ({sites}), {duration + easing + trigger}.

Niches that opt into `motion-preset.json` = `energetic` will have spring
bounce patterns; `restrained` niches use premium easings.

## 6. Decorative motif idioms

Background patterns, corner overlays, accent shapes specific to the niche
aesthetic.

## 7. Anti-patterns observed in the pool

Patterns the niche pool **avoids** that other niches use, these become
explicit "don't do this for {niche}" rules for the build agent.

3-7 anti-patterns. Each: pattern + which low-scoring site does it + why it
fails the niche.

---

## Source traceback

```
## Source traceback
- Pool size: {N} sites captured
- High-scoring sites: {site URLs with scores}
- Low-scoring sites (anti-pattern source): {site URLs}
```
