# Niche playbook contract: `sop-overrides/00-master.md`

Per-niche overrides to the universal master blueprint at
`.claude/sops/00-master-blueprint.md`. Loaded by Stage 10.4b SOP-QA when
verifying the per-client build.

A complete file MUST cover only the niche overrides, universal invariants
(zero em-dashes, schema validity, prefers-reduced-motion, etc.) inherit
unchanged.

---

## 1. Locked CRO copy (cross-references `niche-playbook/copy-locks.json`)

Restate the locked phrases for human-readability. The build agent reads from
`copy-locks.json`, not from this file. This file is documentation:

```
- ctaPrimary: "{value}"
- ctaSecondary: "{value}"
- formHeader: "{value}"
- formPrivacy: "{value}"
- mobileCallLabel: "{value}"
```

## 2. Section counts

```
- Trust signal claim count: {N} (per niche; the niche playbook supplies the number)
- Trust signal badge count: {N} (from trust-signals.json `trustStripCount`)
- Process section step count: {N} (from process.json `stepCount`)
- Reviews shown on homepage: {N} (per niche; typical 4-10)
- FAQ items shown: {N} (per niche; typical 6-8)
- Trust-badge placements: {list} (from trust-signals.json `placements`)
```

## 3. Page order (from `09-template-spec.md` Page structure)

Numbered list of HomePage sections in the order the niche template's
`HomePage.jsx` renders them. Stage 10.4b verifies the build matches.

## 4. Required sections (cannot be omitted)

Sections that must render even if data is sparse. The list of
required-vs-conditional sections is per niche; Module 2D derives it
from the niche wireframe + top-of-niche reference pool.

## 5. Conditional sections (render when data exists)

Sections that render-nothing-if-empty: Special-Offers, Charity, Awards,
Galleries when no photos, etc.

## 6. Niche-specific cross-cutting rules

Rules unique to this niche. Examples:
- Hospitality: "Capacity number rendered in hero subhead with tabular-nums."
- Contractor: "License number always visible above H1 in a small caps eyebrow."
- E-commerce: "Stock status rendered inline on every product card."

## 7. Halt conditions

When this niche's build halts above the universal halt conditions:
- Required asset categories from `photo-manifest.json` below minimum
- Required trust signals not detected in client research
- Niche-specific required fields missing from brand-dna

---

## Source traceback

```
## Source traceback
- Cross-cutting rules: derived from {site URLs} consistency analysis
- Conditional section logic: {site URL} (has it), {site URL} (does without)
```
