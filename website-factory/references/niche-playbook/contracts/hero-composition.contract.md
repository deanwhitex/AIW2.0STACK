# Niche playbook contract: `hero-composition.md`

Complete per-niche prompt template Stage 9 (Nano Banana hero image) reads.
Defines the niche's hero photograph composition: subject placement,
foreground/midground/background, what objects anchor the shot, mood baseline,
plus the assembled prompt body Nano Banana receives.

Module 2D writes one per niche into
`templates/{niche-slug}/niche-playbook/hero-composition.md`. This file is
the complete scaffold the niche ships; there is no separate universal
scaffold to layer on top.

A complete `hero-composition.md` MUST cover the sections below. Stage 9's
`tools/generate-hero.py` substitutes per-client tokens (company name, city,
palette, region, owner-photo path, etc.) into this file and sends the result
to the Gemini Image API as the prompt.

---

## 1. Composition spec

```
Subject: {what's in the frame and where it sits}
Scale: {how much of the frame the primary subject occupies}
Foreground: {what's in the bottom third}
Midground: {what's mid-distance}
Background: {what's behind / above}
Text overlay zone: LEFT 40% reserved, kept relatively unobstructed
People: {whether and where; e.g. \"owner on right 25%, half-overlapping subject\"; or \"no people in frame\"}
Anchor object: {the niche-coupled object that signals the niche, e.g. branded truck for contractor, dressed table for hospitality, product still-life for ecommerce, equipment for fitness}
Negative space: {how much, where}
Forbidden in frame: {ladders, scaffolding, debris, watermarks, etc.}
```

## 2. Subject reference photo handling

If the niche playbook requires a subject reference photo (an owner, host, or
in-frame person):

- Where the photo lives on disk (e.g. `[Client] Assets/founder-photos/owner.{jpg,png}`)
- Whether it's required vs optional
- Behaviour when missing (subject-less composition fallback OR halt)
- Required composition for the cutout (chest-up, neutral background, etc.)

## 3. Logo handling in-frame

How the client logo gets composed into the hero:
- Where it appears (truck wrap, signage, glass etching, product label,
  background banner, etc.)
- Size relative to frame
- Whether it's prominent or subtle

## 4. Mood baseline

What the default `brand-dna.hero.mood` should be for this niche if not
otherwise specified. The mood mapping lives at
`niche-playbook/hero-mood-mapping.json`.

## 5. Region defaults

How the niche varies composition by region. Example: a hospitality niche
might compose a wine-country hero very differently from a beach-resort hero.
A contractor niche varies house style by region.

If the niche has region-specific composition, write a region table here
referencing `niche-playbook/hero-regions.json`.

## 6. Lighting + colour

How the lighting brief from `hero-mood-mapping.json` combines with the
niche's brand palette. Example: "the warm tones of golden_hour_warm
complement the niche's near-black + cream + tan palette; the dramatic_dusk
mood emphasises the niche's gold accent."

## 7. Style ladder

How the niche's hero should look at three quality tiers, the build agent
generates the bottom tier by default; manual photo replacement upgrades to
the top tier:
- **Generated baseline** (Stage 9 default, what Nano Banana produces)
- **Professional shoot** (the brief the proposal recommends pricing in)
- **Cinematic premium** (what the niche's top-of-pool achieves)

This helps the proposal-builder agent recommend a tier-appropriate
photography spend.

## 8. Example prompt assembly

A worked example of the complete prompt body with `{token}` placeholders
the runtime substitutor fills (`tools/generate-hero.py` substitutes
`{company}`, `{location}`, `{primary_color}`, `{accent_color}`,
`{accent_name}`, `{mood_lighting}`, `{region_setting}`, `{region_landscape}`,
`{region_sky}`, `{region_background}`, `{owner_block}` per client).
Useful as a test fixture: feed this through `tools/generate-hero.py
--dry-run` to verify the prompt is well-formed before client builds.

```
{Generated prompt example pasted here, with client placeholders}
```

---

## Source traceback

```
## Source traceback
- Composition patterns: from {site URLs} hero analysis
- Mood preferences: {site URL} (golden_hour), {site URL} (dramatic_dusk)
- Subject scale + placement: {site URL}
```
