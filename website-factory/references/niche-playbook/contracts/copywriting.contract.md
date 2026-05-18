# Niche playbook contract: `copywriting.md`

This file IS the niche's copywriting framework. Module 2D writes one per niche
into `templates/{niche-slug}/niche-playbook/copywriting.md`. The Stage 6
copywriting agent loads it; `.claude/skills/copywriting/SKILL.md` is the
universal contract that points at this file for niche specifics.

A complete niche `copywriting.md` MUST cover these sections, in this order. If
research is too thin to fill a section, mark it `Insufficient data, defaults
apply` rather than padding with filler.

---

## 1. Voice grammar

One paragraph defining the niche's voice in one sentence, then the voice
principles. Specific to the niche audience. Avoid the universal-blocklist
words from `references/copy/ai-vocab-blocklist.md`.

Example (do not copy verbatim, derive yours from the niche's reference pool):

> Voice in one sentence: **{calm and editorial / direct and confident / warm
> and conversational / etc.}**, speaking to **{the end customer}** about
> **{the purchase decision they face}**.

Then 4-6 voice principles. Each principle: a bad/avoid example, a good/use
example. The voice principles in this section are what makes a hospitality
copywriter sound different from a contractor copywriter even when they're
both selling trust.

## 2. Banned phrases (niche-specific additions)

Beyond the universal blocklist at `references/copy/ai-vocab-blocklist.md`,
list 3-10 phrases that signal AI-slop specifically inside this niche. These
land in `copy-blocklist-additions.md` (a separate playbook file copy-lint
reads when `--include-niche` is set). Mirror them here as documentation.

## 3. Preferred phrases (niche-specific tells of authenticity)

3-10 niche-specific phrasings that signal a real practitioner. Example for
hospitality: "the room turns down at six", "your suite is ready by three".
Example for contractor: "we treat your yard like ours", "no surprises". These
are the niche's authenticity fingerprints.

## 4. Tone calibration by sub-segment (optional)

If the niche has clear sub-segments (e.g. retail vs insurance for contractor;
boutique vs resort for hospitality), describe how the voice shifts per
segment. Skip if the niche is uniform.

## 5. Section-by-section copy frameworks

For every section in the niche template's `HomePage.jsx`, define:

- **Section H2 formula**, pattern with placeholders the agent fills.
- **Section sub-H2 formula**, what the supporting line says.
- **Body copy framework**, bullets, paragraph length, what to mention.
- **Niche-specific guardrails**, what to never say in this section.

Cover at minimum: Hero, Reviews, Trust badges, Why-choose-us, Gallery /
Past-work, Process, Offers / Pricing, Services / Offerings, About / Founder,
FAQ, Final CTA, Footer. Add niche-specific sections (e.g. Capacity,
Wedding-package, Booking-flow for hospitality).

For each, anchor to the wireframe + spec in
`research/02-niche-research/{slug}/09-template-spec.md`.

## 6. CTA microcopy library

Variants of the locked CTAs that fit different in-page contexts:
- Hero CTA button (from `copy-locks.json` `ctaPrimary`)
- Form pre-header (`formHeader`)
- Form privacy line (`formPrivacy`)
- Mid-page CTA (3-5 alternative phrasings)
- Bottom-banner CTA (3-5 alternatives)
- Mobile sticky during hours (`mobileCallLabel`)
- Mobile sticky after hours (falls back to `ctaPrimary`)
- Post-submit thank-you

## 7. Review guardrails

When real reviews exist: format rules (count, source-attribution, photo,
date, truncation, max length). When real reviews are insufficient (0-3 real):
the niche-specific objection-review generator pattern, what reviewer types
to invent, what objections each must address, what the niche playbook
forbids generated reviews from claiming.

## 8. Location-page copy framework

If the niche has location pages (most do for local-search): the H1 pattern,
the intro paragraph rules (what local detail to weave in: landmark,
neighbourhood, climate, demographic, etc.), word-count minimum, internal
linking pattern.

## 9. Service / offering / category page copy framework

For each service-type page: H1 pattern, hero paragraph (problem-aware),
required H2 sections (process, why-choose, materials/categories, cost,
FAQ), word-count minimum, schema requirement.

## 10. Blog post patterns

Blog title formulas that work for this niche's audience. Default 4-6 post
starter list (titles only; copy generation happens later). Section
structure (hook → 4-6 H2 sections → internal links → CTA).

## 11. Quantified trust line patterns

Inline patterns for the hero's quantified trust line. Each pattern has
qualifying conditions on research.json fields and an output template. The
agent walks the patterns top-to-bottom and uses the first whose conditions
match.

Move to `quantified-trust-templates.md` if patterns get verbose; reference it
here.

## 12. Em-dash + smart-quote audit

Reiterate the universal hard fail. Zero em-dashes. Smart quotes throughout.
`python3 tools/copy-lint.py --check` must pass before delivery.

## 13. Quality bar (niche-specific extras on top of universal)

Bullet list. Example: "every wedding-venue review mentions the host by
name", "every contractor location page references a real local landmark".
Niches add 2-5 quality gates above the universal ones.

---

## Source traceback

Footer of every niche copywriting.md: list the reference sites Module 2D
drew patterns from. Per-pattern attribution where applicable. Helps future
refinement (`/refine-template`) reconnect insights to sources.

```
## Source traceback
- Voice grammar: derived from {site URLs}
- Section H2 formulas: {site URL} (Hero, Reviews, ...), {site URL} (Process, ...)
- Banned phrases: synthesised from {site URLs}' AI-slop content
- Preferred phrases: lifted patterns from {site URLs}
```
