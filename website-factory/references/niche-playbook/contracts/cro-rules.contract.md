# Niche playbook contract: `cro-rules.md`

Consensus conversion-rate-optimisation patterns derived from the niche's
top-of-niche reference pool. Module 2D synthesises these in Phase 7 from
the scores + rationales of the 8-12 captured sites. Stage 10.4b (SOP-QA)
reads them as additional gates beyond the universal CRO rules in
`.claude/sops/00-master-blueprint.md`.

A complete `cro-rules.md` MUST cover the sections below. Use the format
**Rule → Evidence → Failure mode**.

---

## 1. Above-the-fold rules

Patterns the niche's top-of-pool consistently uses above the fold:

```
Rule: {short statement}
Evidence: {X of Y captured sites do this. Site URLs: ...}
Failure mode: {what happens if violated}
```

Typical entries: primary CTA placement, hero CTA-to-click-to-call ratio,
review-pill placement, license / accreditation badge, navigation simplicity.

## 2. Trust signal density

How much trust signal each section gets:

```
Rule: {trust signal surface} in slot {N} renders {count} badges
Evidence: {X of Y sites} normalised to {count}
Failure mode: {below minimum: trust drops; above maximum: looks busy}
```

The trust signal surface name varies per niche (strip, floating pill,
inline checkmark list, footer wall, etc.). Plus where badges appear:
hero (frequency), under-hero strip, in-section, footer.

## 3. Form friction

The niche's form acceptable surface:

```
Rule: contact form has {N} or fewer fields above the optional-fields fold
Rule: required fields: {list}
Rule: optional fields: {list}
Rule: phone number is {required / optional}
Rule: address-collection happens {pre-submit / post-submit}
```

## 4. Mobile-specific rules

What the niche's mobile experience demands:

```
Rule: sticky bottom CTA bar is {present / absent} on mobile
Rule: click-to-call is {present / hidden} on mobile
Rule: form field count on mobile = {N}
Rule: tap-target minimum size = {px}
```

## 5. Pricing transparency

Whether and how the niche shows pricing:

```
Rule: cost / starting-price is {visible above fold / on service page / on quote-only}
Rule: financing is {mentioned in hero / mentioned in pricing section / not mentioned}
Rule: price-anchor pattern: {“starting at $X” / “from $X” / “quotes vary by complexity”}
```

## 6. Review presentation

Niche-specific review display:

```
Rule: review source: {Google / Facebook / industry-specific platform}
Rule: review excerpt length: {character count maximum}
Rule: reviewer photo: {required / optional / hidden}
Rule: review velocity proof: {hero-bar count / inline date / aggregate-only}
```

## 7. Process / service explanation

How the niche explains its service:

```
Rule: process step count: {N}
Rule: process step granularity: {high-level / detailed}
Rule: service page minimum word count: {N}
Rule: includes cost section: {yes / no}
Rule: includes FAQ section: {yes / no, with FAQ schema}
```

## 8. Quantified-trust line

The format the niche uses for the inline trust line in hero (e.g. "14 years
protecting Plymouth homes" for contractor; "Hosting 60 weddings a year since
2014" for hospitality):

```
Pattern 1 (if condition X): "{template with placeholders}"
Pattern 2 (if condition Y): "{template}"
Pattern 3 (fallback): "{template}"
```

Move to `quantified-trust-templates.md` if patterns get verbose.

## 9. Conversion-killer anti-patterns

What the niche's bottom-of-pool sites do that the top doesn't:

```
Anti-pattern: {short statement}
Evidence: {site URL where it appears, score below median}
Why it fails: {one sentence}
```

3-7 anti-patterns. The Stage 10.4b SOP-QA gates fail when these appear in
the per-client build.

---

## Source traceback

```
## Source traceback
- Top of pool: {site URL, score} → rules {1-9}
- Mid of pool: {site URL, score} → rules {3, 5}
- Bottom of pool / anti-patterns: {site URL, score} → anti-patterns
```
