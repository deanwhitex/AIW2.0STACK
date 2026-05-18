# Niche Playbook (`templates/{niche-slug}/niche-playbook/`)

The **niche playbook** is the per-niche configuration the website factory reads
to make every stage niche-appropriate. Module 2D writes the playbook when a
student runs `/build-niche-template`. Every SOP, agent, tool, and skill in the
factory references the playbook for niche-specific values, never hardcodes
them.

This directory (`website-factory/references/niche-playbook/`) defines the
**contract surface**: the schemas that JSON playbook files validate against
and the markdown framework templates that markdown playbook files follow. The
contracts ship in the public repo. The per-niche playbook content is generated
per-student by Module 2D from their own niche research.

## Playbook file layout

A complete niche playbook at `templates/{niche-slug}/niche-playbook/`:

```
niche-playbook/
├── copy-locks.json                    [required]
├── copywriting.md                     [required]
├── hero-composition.md                [required]
├── hero-mood-mapping.json             [required]
├── photo-manifest.json                [required]
├── asset-patterns.json                [required]
├── trust-signals.json                 [required]
├── resonance-queries.json             [optional, niches that mine social data]
├── resonance-extraction.schema.json   [optional, extends universal shape]
├── quantified-trust-templates.md      [optional]
├── motion-preset.json                 [optional, defaults to restrained]
├── theme.json                         [optional, defaults to {default: light, toggle: false}]
├── process.json                       [optional, defaults to 6 steps from spec]
├── vocabulary.json                    [optional, niche-specific section names]
├── cro-rules.md                       [optional, derived from top-of-niche analysis]
├── design-vocabulary.md               [optional, niche reference-pool catalogue]
├── seo-patterns.md                    [optional]
├── design-synthesis-overrides.md      [optional]
├── research-extensions.md             [optional, niche-specific research fields]
├── research-extensions.schema.json    [optional, paired with the .md above]
├── copy-blocklist-additions.md        [optional, niche-specific vocab on top of universal]
└── sop-overrides/                     [optional, per-stage niche overrides]
    ├── 00-master.md
    ├── 04-assets.md
    ├── 06-copywriting.md
    ├── 08-hero-image.md
    ├── 13-motion.md
    └── 15-copy-resonance.md
```

## Contract surface

This directory:

```
references/niche-playbook/
├── README.md                          [this file]
├── schemas/                           [JSON schemas for the JSON playbook files]
│   ├── copy-locks.schema.json
│   ├── photo-manifest.schema.json
│   ├── trust-signals.schema.json
│   ├── resonance-queries.schema.json
│   ├── vocabulary.schema.json
│   ├── motion-preset.schema.json
│   ├── theme.schema.json
│   ├── process.schema.json
│   ├── asset-patterns.schema.json
│   ├── hero-mood-mapping.schema.json
│   └── resonance-extraction-base.schema.json
└── contracts/                         [structural contracts for the .md playbook files]
    ├── copywriting.contract.md
    ├── hero-composition.contract.md
    ├── cro-rules.contract.md
    ├── design-vocabulary.contract.md
    ├── seo-patterns.contract.md
    ├── design-synthesis-overrides.contract.md
    ├── research-extensions.contract.md
    ├── quantified-trust-templates.contract.md
    ├── copy-blocklist-additions.contract.md
    └── sop-overrides/
        ├── 00-master.contract.md
        ├── 04-assets.contract.md
        ├── 06-copywriting.contract.md
        ├── 08-hero-image.contract.md
        ├── 13-motion.contract.md
        └── 15-copy-resonance.contract.md
```

## How Module 2D writes the playbook

Module 2D's Phase 5b (`/.claude/agents/14-template-builder.md`) generates every
playbook artifact from:
- The student's Module 2B research outputs (`research/02-niche-research/{slug}/`)
- The student's pick from Phase 4 (`templates/raw/{site-slug}/`)
- The design spec from Phase 5a (`09-template-spec.md`)
- The universal contracts and schemas in THIS directory

For each required playbook file:
1. Module 2D loads the contract / schema
2. Reads the relevant research to fill the niche-specific values
3. Writes the playbook file
4. Validates against the schema (for JSON files)

For each optional playbook file:
1. Module 2D evaluates whether the niche needs it (based on research signals)
2. If yes, generates as above
3. If no, skips, the factory's SOPs/skills have defaults that apply when the
   file is absent

## How the factory consumes the playbook

The factory's SOPs and skills (see
`website-factory/.claude/sops/*.sop.md` and
`website-factory/.claude/skills/*/SKILL.md`) reference playbook paths directly:

```
templates/{active-niche-slug}/niche-playbook/{filename}
```

Where `{active-niche-slug}` is resolved from `stack-state.json.niche.slug`
(written by Module 2C `/pick-niche`).

If a required playbook file is missing, the corresponding SOP halts with a
Module-2D pointer. If an optional file is missing, the SOP applies its
documented default.

## Versioning

Each playbook file's first line includes a `<!-- niche-playbook v1 -->`
comment (or `"$schema-version": 1` for JSON). This lets the factory detect
playbook format upgrades and run a one-time migration when the contract evolves.

## Updating the contracts

When the factory adds a new niche-specific capability:
1. Define the new playbook file's schema or contract in this directory
2. Add it to the niche-playbook layout above
3. Update the Module 2D agent to know how to generate it
4. Update the factory SOP/skill/agent that consumes it
5. If required, add a migration note for existing niche playbooks

Open a PR for review. Schema / contract changes are append-only where
possible (existing fields don't get renamed without a migration).
