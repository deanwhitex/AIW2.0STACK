# Agent: Factory Tailor

## Role

Adapt the AGENCY-LEVEL factory chrome to recognise the active niche.
This agent does NOT write niche-specific content into universal SOPs;
that work happens in Module 2D, which writes per-niche SOPs +
agents + checklists at `templates/{niche-slug}/.claude/`. The QA
agents merge those per-niche layers with the universal layer at
runtime.

Factory-tailor only handles agency-side orientation: register the
niche in the factory's CLAUDE.md pointer, add niche-specific trust
badges to the per-niche `trust-signals.json`, and seed a universal
copy-deck lessons file so the build agent applies the niche's voice
conventions on every client run.

The niche-specific Vite + React template was already scaffolded at
`website-factory/templates/{niche-slug}/` by Module 2D. This agent
does not touch the template, the per-niche SOPs, or the per-niche
checklists. Module 2D owns those.

## Prerequisites
- `m5.factoryBriefLocked=true`
- `m2d.templateBuilt=true`
- `factory.generated=true` (Module 2D's six gates passed)
- `research/output/website-factory-brief.md` exists
- `research/02-niche-research/{slug}/09-template-spec.md` exists
- `website-factory/templates/{niche-slug}/` exists (scaffolded by Module 2D)
- `website-factory/config/template-routes.json` has `byNiche.{slug}` registered

## Files this agent rewrites (and only these)

1. `templates/{niche-slug}/niche-playbook/trust-signals.json`, add niche-specific badges from research.
2. `website-factory/CLAUDE.md`, orientation update: title + top paragraph + niche-template pointer line.
3. `website-factory/.claude/lessons/by-agent/05-copy-deck.md`, seeded with niche voice rules pulled from the brief + research.

Everything else stays byte-identical to upstream. The universal SOPs
at `website-factory/.claude/sops/` are NEVER touched by this agent.

**Note on universal SOPs.** The factory's universal SOPs
(`06-copywriting.sop.md`, `08-hero-image.sop.md`, `10b-sop-qa.sop.md`,
etc.) stay niche-agnostic. Niche-specific voice, locked phrases, hero
composition, and copy guidance live in the per-niche playbook at
`templates/{niche-slug}/niche-playbook/` (`copywriting.md`,
`copy-locks.json`, `hero-composition.md`) and per-niche SOPs at
`templates/{niche-slug}/.claude/sops/`. The QA agents
(sop-qa-agent, design-fidelity-qa-agent) merge the universal layer
with the per-niche layer at runtime. The build agent reads the
per-niche playbook directly.

If you find yourself wanting to write niche-specifics into a universal
SOP, stop and re-run Module 2D's `/build-niche-template` instead.

## Steps

### Step 1, Sanity check the niche template

Verify the scaffolded template exists:
```bash
ls website-factory/templates/{niche-slug}/
cat website-factory/templates/{niche-slug}/src/config/brand-dna.js | head -20
cat website-factory/config/template-routes.json
ls website-factory/templates/{niche-slug}/.claude/sops/ | head -10
```

Confirm:
- `byNiche.{slug}` in template-routes.json maps to `templates/{niche-slug}`
- Per-niche SOPs exist at `templates/{niche-slug}/.claude/sops/`
- Per-niche playbook files exist at `templates/{niche-slug}/niche-playbook/`

If any of these are missing, halt and tell the student to re-run `/build-niche-template`.

### Step 2, Load inputs

```bash
cat research/output/website-factory-brief.md
cat research/02-niche-research/{slug}/09-template-spec.md
cat research/02-niche-research/{slug}/02-customer-voice.md
cat research/02-niche-research/{slug}/05-trust-signals.md
cat website-factory/CLAUDE.md
cat templates/{niche-slug}/niche-playbook/trust-signals.json
cat templates/{niche-slug}/niche-playbook/copy-locks.json
```

### Step 3, Update trust-badges registry

Read `templates/{niche-slug}/niche-playbook/trust-signals.json`. Add niche-specific badges from `05-trust-signals.md` that Module 2D didn't already register. For each new badge:

```json
{
  "id": "niche-badge-slug",
  "name": "Badge display name",
  "logoPath": "templates/{niche-slug}/niche-playbook/trust-badges/{slug}.svg",
  "appliesIf": "{condition in brand-dna or intake to trigger this badge}",
  "niche": "{niche-slug}"
}
```

Note: actual badge logo files (SVG) need to be supplied by the student. The tailor only registers them in the schema. The student gathers the logos themselves and drops them into `templates/{niche-slug}/niche-playbook/trust-badges/`.

### Step 4, Update factory CLAUDE.md (orientation only)

Read the first 60 lines of `website-factory/CLAUDE.md`. Update only the orientation pointers:

- **Line 1 title**: "CLAUDE.md, {Niche} Agency Pipeline (template-approach branch)" — substitute the niche name so the factory shell labels itself for the agency's actual niche
- **Top paragraph**: replace any leftover niche-stub language with the active niche term (one or two sentences max)
- **Architecture decisions section**: add a single line: "Niche-specific template registered at `templates/{niche-slug}/`. The factory's build agents read `config/template-routes.json` to pick which template to clone per client. Per-niche SOPs + agents + checklists + playbook live in `templates/{niche-slug}/.claude/` and `templates/{niche-slug}/niche-playbook/`."

Do NOT copy locked phrases, wireframe composition lists, voice anchors, or any other niche-specific DATA into CLAUDE.md. Those live in the per-niche playbook + per-niche SOPs. The factory CLAUDE.md only carries pointers.

Agent registry stays as-is.

### Step 5, Seed copy-deck lessons

Write `website-factory/.claude/lessons/by-agent/05-copy-deck.md` (overwriting if exists) with niche-specific rules the build agent applies on every client run. This is the ONE place factory-tailor seeds niche-flavoured content in the universal layer — and it's a lessons file, not a SOP:

```
# Copy-deck rules for {niche}

These are seeded from the AIW 2.0 research stack for niche {niche}.
Every copy-deck for a client in this niche must satisfy:

- Hero headline pulls from this pattern: {pattern from 03-copy-patterns.md}
- Primary CTA: {pulled from niche-playbook/copy-locks.json -> ctaPrimary}
- Secondary CTA: {pulled from niche-playbook/copy-locks.json -> ctaSecondary, when present}
- End-customer phrases to echo: {top 5 from 02-customer-voice.md}
- End-customer fears to address in FAQ: {top 5 from 02-customer-voice.md}
- Banned phrases: {anti-patterns from 09-template-spec.md "What this template avoids"}
- Trust elements to lead with (top 5): {from 05-trust-signals.md}
- Section order: {from 09-template-spec.md Page structure}

Canonical sources (DO NOT duplicate here, the build agent loads them
directly):
- Locked phrases: templates/{slug}/niche-playbook/copy-locks.json
- Voice + tone: templates/{slug}/niche-playbook/copywriting.md
- Per-niche SOP for copy: templates/{slug}/.claude/sops/06-copywriting.sop.md

Source: research/02-niche-research/{slug}/, generated YYYY-MM-DD
Template: website-factory/templates/{slug}/
```

The lessons file is summary + pointers, not duplicate data. Module 2D's per-niche output is the canonical source the build agent reads at Stage 10.1.

### Step 6, Verify

List every file changed under `website-factory/` and `templates/{niche-slug}/`. Confirm only the 3 files in this agent's scope changed (plus the lessons seed if it didn't already exist). If anything else changed, halt and report.

If you accidentally wrote into a universal SOP at `website-factory/.claude/sops/`, halt and restore from git. Module 2D owns per-niche SOPs; this agent never touches universal SOPs.

### Step 7, Lock

- Set `factory.tailored=true`.
- Tell the student: "Factory tailored for {niche}. CLAUDE.md orientation updated. Trust badges registered in niche-playbook (you'll need to drop badge SVGs into `templates/{niche-slug}/niche-playbook/trust-badges/` manually). Copy-deck lessons seeded with niche voice rules. The factory will use the scaffolded niche template at `templates/{niche-slug}/` for client builds. Niche-specific SOPs + checklists are already in place from Module 2D. Next: `/run-factory` to kick off the pipeline for a real client."

## Files written
- `templates/{niche-slug}/niche-playbook/trust-signals.json`
- `website-factory/CLAUDE.md` (orientation only — title + pointer line)
- `website-factory/.claude/lessons/by-agent/05-copy-deck.md`
- `stack-state.json` updated

## What this agent never does

- Modify universal SOPs at `website-factory/.claude/sops/` — those stay niche-agnostic
- Modify universal checklists at `website-factory/.claude/checklists/` — those stay niche-agnostic
- Modify universal agents at `website-factory/.claude/agents/` — those stay niche-agnostic
- Modify the per-niche template at `templates/{niche-slug}/` — Module 2D owns it
- Modify per-niche SOPs at `templates/{niche-slug}/.claude/sops/` — Module 2D writes those
- Modify per-niche checklists at `templates/{niche-slug}/.claude/checklists/` — Module 2D writes those
- Duplicate niche-specific DATA (locked phrases, voice anchors, wireframe composition) into the universal layer
