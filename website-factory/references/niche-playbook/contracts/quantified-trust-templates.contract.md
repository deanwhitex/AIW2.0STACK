# Niche playbook contract: `quantified-trust-templates.md`

Patterns for the hero's quantified-trust inline line ("14 years protecting
Plymouth homes", "Hosting 60 weddings a year since 2014", "8,000+ orders
shipped from Cape Town"). Stage 6 (copywriting) walks these patterns
top-to-bottom and uses the first whose research conditions match.

Optional file, when absent, Stage 6 falls back to a generic year-count
pattern from the universal copywriting skill.

---

## Pattern format

Each pattern has:

```
### Pattern {N}
Conditions: {expressions over research.json fields}
Output template: "{string with placeholders}"
Justification: {one sentence on what this proves about the client}
Source: {site URL from pool that uses this pattern}
```

Conditions are simple expressions Stage 6 evaluates against
`research-data.json`:
- `years_in_business >= N`
- `googleReviewCount + facebookReviewCount >= N`
- `serviceAreas.length >= N`
- `manufacturerCerts.gafMasterElite == true` (or any niche-extension boolean)
- `nicheExtensions.{slug}.{field}` available
- Boolean operators: `&&`, `||`

The first pattern whose conditions all evaluate true wins. Stage 6 falls
through to the next if any condition fails.

## Placeholders

Available placeholders Stage 6 substitutes:

- `{years}`, `research.yearsInBusiness`
- `{foundedYear}`, `research.yearFounded`
- `{primaryCity}`, `research.primaryCity`
- `{adjacentCity}`, first `research.serviceAreas` entry
- `{region}`, `research.region` or derived "Greater {primaryCity}"
- `{jobCount}`, `research.googleReviewCount + research.nicheExtensions.{slug}.manualProjectCount`
- `{reviewCount}`, `research.totalReviewCount`
- `{audienceNoun}`, `vocabulary.json.audienceNouns.endCustomerPlural`

Niche playbooks may extend with niche-specific placeholders sourced from
`research.nicheExtensions.{slug}.*`.

## Patterns (top to bottom, in priority order)

### Pattern 1 (high-trust, long-established)
Conditions: `years >= 10 && reviewCount >= 100`
Output template: "{years} years {audienceNoun-verb} in {primaryCity}"
Example output: "14 years protecting Plymouth homes"
Justification: combines tenure + scale = a clear credibility frame

### Pattern 2 (high-scale, newer)
Conditions: `jobCount >= 100 && years >= 3`
Output template: "{jobCount}+ {audienceNoun-verb} across {region} since {foundedYear}"
Example output: "500+ roofs kept dry across Tucson since 2010"
Justification: scale wins when tenure is mid

### Pattern 3 (owner-led, multi-area)
Conditions: `serviceAreas.length >= 5 && reviewCount >= 20`
Output template: "Owner-led {audienceNoun-verb} across {primaryCity} and {N} cities around"
Justification: owner-led emphasis + geographic spread

### Pattern 4 (heritage)
Conditions: `years >= 25 || research.nicheExtensions.{slug}.generations >= 2`
Output template: "{N} generations of {audienceNoun-verb} in {primaryCity}"
Justification: heritage emphasis when applicable

### Pattern 5 (fallback)
Conditions: (always)
Output template: "{audienceNoun-verb} in {primaryCity} since {foundedYear}"
Justification: minimum viable quantified-trust when other conditions fail

## Per-niche customisation

Niches add their own patterns. Examples:

- **Hospitality**: "Hosting {weddingCount} weddings a year since {foundedYear}"
- **E-commerce**: "{ordersShipped}+ orders shipped to {audienceNoun} in {region}"
- **Healthcare**: "{patientCount}+ {audienceNoun} cared for in {primaryCity}"
- **Legal**: "{casesWon}+ cases settled across {region} since {foundedYear}"

The niche playbook's `copywriting.md` Section 11 references this file when
present.

---

## Source traceback

```
## Source traceback
- Pattern 1 source: {site URL}
- Pattern 2 source: {site URL}
- ...
```
