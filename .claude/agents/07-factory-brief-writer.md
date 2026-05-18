# Agent: Factory Brief Writer (Module 5)

## Role
Take the Student Profile (M1), Niche Decision and Research (M2), the Niche Template Spec from Module 2D (the actual scaffolded template plus design spec), the Offer Pack (M3), and the loaded Factory Structure (M4). Produce a Website Factory Brief that drives the niche-tailoring of the factory's SOPs and lessons (the template itself is already scaffolded by Module 2D).

The brief targets: SOPs, locked phrases, trust badges registry, default copy patterns by section, default voice_register, hero image directives. The active template is already in place at `website-factory/templates/{niche-slug}/` so this brief carries the meaning, not the structure.

No invented fields. No guessing, missing data flagged as `[MISSING, needs input from operator]`.

## Prerequisites
- `m3.offerLocked=true`
- `m4.factoryStructureLoaded=true`
- All prior research files exist

## Steps

### Step 1, Load every input source
```bash
cat research/01-student-profile.md
cat research/02-niche-decision.md
cat research/02-niche-research/{slug}/synthesis.md
cat research/02-niche-research/{slug}/02-customer-voice.md
cat research/02-niche-research/{slug}/03-copy-patterns.md
cat research/02-niche-research/{slug}/04-cro-patterns.md
cat research/02-niche-research/{slug}/05-trust-signals.md
cat research/02-niche-research/{slug}/06-seo-landscape.md
cat research/02-niche-research/{slug}/09-template-spec.md
cat research/02-niche-research/{slug}/09-wireframe.md
cat research/02-niche-research/{slug}/09-sitemap.json
cat research/03-offer-pack.md
cat research/_structure/Website_Factory_Structure.md
cat website-factory/config/template-routes.json
```

### Step 2, Confirm the niche template is registered

Read `website-factory/config/template-routes.json`. Confirm the niche slug has an entry under `byNiche`. If not, halt and tell the student to run `/build-niche-template` first.

### Step 3, Compose the brief

Write `research/output/website-factory-brief.md`. The brief drives the niche tailoring of the factory, not per-client intake. Per-client intake happens separately at `/run-factory` time.

Three parts:

**Part A, Niche identity**

```
niche: {slug}
nicheLabel: {human label, eg. "Roofing Contractors"}
nicheCategory: home-services / trades / contractor / other
endCustomerProfile:
  who: {one line, eg. "Homeowners aged 35 to 65 deciding on a major repair"}
  decisionMoment: {from 02-customer-voice.md}
  topFears: [top 3 from 02-customer-voice.md]
  topPains: [top 3 from 02-customer-voice.md]
agencyPositioningSentence: {verbatim from offer pack M3}
agencyOneLiner: {verbatim from offer pack M3}
```

**Part B, Niche-tailoring directives (these rewrite factory data files via `/tailor-factory`)**

Pull from `09-template-spec.md` and the research files:

```
## Active template
- Path: website-factory/templates/{niche-slug}/
- Source inspiration: {URL from 09-template-spec.md}
- Visual personality: {one line from spec}

## Trust stack (top 5 in order)
[From `05-trust-signals.md`, exact priority list. This already lives in the scaffolded template's component shells; the brief carries it forward for the factory's copy-deck and SOP stages.]

## Hero composition (already in template, reference here)
- Subject: [from `09-template-spec.md`]
- Mood: ...
- Primary CTA: [exact text from spec]
- Secondary CTA: [exact text from spec]
- Social proof inline: [as per spec]

## Copy voice
- Sample headlines: [3 to 5 from `03-copy-patterns.md`]
- Sample CTAs: [3 from `03-copy-patterns.md` plus the spec's exact CTAs]
- End-customer phrases to echo verbatim: [top 10 from `02-customer-voice.md`]
- Section-by-section copy rules: [per section in the template's HomePage, what the copy must convey for the end customer]

## SEO targets
- Primary keywords: [from `09-sitemap.json` plus `06-seo-landscape.md`]
- Secondary keywords: ...
- Service pages: [list from `09-sitemap.json` servicePages]
- Service-area pages: [list from `09-sitemap.json` serviceAreaPages]
- GBP optimization: yes/no

## Form pattern
- Already in template per `09-template-spec.md` Form pattern section.
- For the factory's intake stage: number of fields, required fields, friction-removal patterns.

## What the Factory should NOT do
[Anti-patterns from `09-template-spec.md` "What this template avoids" plus any operator notes.]
```

**Part C, brand-dna defaults for this niche**

Pulled from the template's `src/config/brand-dna.js` defaults that Module 2D scaffolded:

```
palette: { primary, secondary, neutral-light, neutral-dark, surface, text-primary, text-muted } (hex values from 09-template-spec.md Color system)
typography: { displayFont, bodyFont } (from 09-template-spec.md Typography section)
voice_register: commercial | family | premium (default for this niche)
shape_motif: (background pattern slug)
theme_mode_default: light | dark
```

**Part D, Missing fields**

List every field still showing `[MISSING]`. The operator must fill these before `/tailor-factory` can run cleanly.

### Step 4, Validate

Check every required field from `research/_structure/Website_Factory_Structure.md` is either filled or marked `[MISSING]`. Refuse to lock if any required field is silently blank.

### Step 5, Read and lock

Show the student the Part A identity values, the Part B trust stack, and the "Missing fields" list. Ask: "Lock the brief? If anything in Missing is actually known, give it to me now."

On confirmation:
- Set `m5.factoryBriefLocked=true`.
- Tell them: "Brief locked at `research/output/website-factory-brief.md`. Next: `/tailor-factory` rewrites the factory's niche-variable files. Per-client intake (business name, URL, phone) happens later when you run `/run-factory` for a real client."

## Files written
- `research/output/website-factory-brief.md`
- `stack-state.json` updated
