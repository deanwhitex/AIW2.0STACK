# Agent: Factory Structure Loader (Module 4)

> **Naming note.** This is the Module 4 brief-writer that scans the
> `website-factory/` tree once and emits a structure document for
> downstream context. It is NOT the Stage 10.1 factory loader (that
> lives at `website-factory/.claude/agents/09-build.md` and resolves
> the active per-niche template at build time).

## Role
Scan the `website-factory/` tree and auto-generate `research/_structure/Website_Factory_Structure.md`. Internal, no student input.

The factory is the bundled `website-factory/` shell. Its per-client builds use the per-niche template at `templates/{niche-slug}/` (written by Module 2D from captured niche research). There is no shared baseline; the factory halts cleanly when no per-niche template exists.

## Prerequisites
- `m3.offerLocked=true`
- `website-factory/` exists in the stack

## Steps

### Step 1, Read the factory's master CLAUDE.md
```bash
sed -n '1,250p' website-factory/CLAUDE.md
```

Pull: pipeline stages, agent registry, command list, architectural decisions, the universal references the factory depends on, and how the per-niche template + playbook plug in.

### Step 2, Read the canonical brand-dna shape contract
```bash
cat website-factory/references/brand-dna.shape.js
```

Identify every field in the canonical shape. This is the data API every component in every niche template reads from. Per-client values are filled by Stage 7 (brand-dna-agent) and overlaid onto the niche template at Stage 10.1.

### Step 3, Read the master blueprint and key SOPs
```bash
cat website-factory/.claude/sops/00-master-blueprint.md
ls website-factory/.claude/sops/
```

Identify which SOPs are universal (apply to every niche) vs niche-driven (read niche-specific values from the playbook at `templates/{niche-slug}/niche-playbook/`).

### Step 4, Read the niche playbook schemas
```bash
ls website-factory/references/niche-playbook/schemas/
ls website-factory/references/niche-playbook/contracts/
```

These schemas + contracts define every per-niche playbook file Module 2D writes. The brief in Module 5 will reference these so the student understands which playbook files Module 2D populates from research.

### Step 5, Read intake mechanism

The factory uses `clients/[Client Name]/Pipeline Data/` rather than a single intake-form.json. The Stage 1 intake agent at `website-factory/.claude/agents/00-intake.md` defines what intake data the pipeline expects.

```bash
cat website-factory/.claude/agents/00-intake.md
```

Identify required intake fields and the client folder structure.

### Step 6, Write Website_Factory_Structure.md

```
# Website Factory, Structure Overview

## What the Factory does
[From CLAUDE.md, 1 to 2 sentences. The factory runs a per-client pipeline that clones the active niche template, overlays per-client brand-dna + copy + assets, builds, validates, deploys.]

## Per-niche template

The factory does NOT carry a baseline template. Module 2D generates a per-niche template at `templates/{niche-slug}/` from captured niche research (top-of-niche sites, design tokens, niche playbook, niche-specific QA checklists). Stage 10.1 clones the active niche template per client.

If no per-niche template exists for the active niche, Stage 10.1 halts with a clear error pointing back to `/build-niche-template`.

## Pipeline
The pipeline runs through Stages 1 to 13 from intake to delivery. See `website-factory/CLAUDE.md` for the full table. The student runs `/build-all` from inside the factory to kick off the whole pipeline. Approval gate at Stage 7 (brand-dna confidence).

## Inputs the Factory needs (per client)

Each client lands in `clients/[Client Name]/`. The intake agent populates:
- `Pipeline Data/intake/intake.json`, business name, website URL, phone, email, address, primary city, state, owner name
- (optional) `Pipeline Data/intake/notes.md`, any special instructions

After intake, downstream stages populate the rest:
- `Pipeline Data/research/research.json`
- `Pipeline Data/seo/audit-data.json`
- `Pipeline Data/strategy/strategy.json`
- `Pipeline Data/copy/copy-deck.md`
- `Pipeline Data/brand/brand-dna.json`
- `[Client Name] Assets/`, logo, photos, etc.

## What the per-niche template + playbook supply

The active niche template at `templates/{niche-slug}/` carries:
- The niche-specific React components + pages
- The niche's tailwind config + foundation tokens
- The niche-specific QA checklists at `.claude/checklists/`
- The niche playbook at `niche-playbook/` (copy locks, trust signals, process, vocabulary, motion preset, theme, hero composition, photo manifest, etc., per the schemas at `references/niche-playbook/schemas/`)

The factory pipeline reads from the playbook for any niche-specific decision and reads from the niche template for any structural decision.

## What the Factory defaults handle (universal)

- Theme mode logic (light/dark from logo brightness)
- Build stack (Vite + React + Tailwind) per the niche template's package.json
- SEO injection, schema markup
- Lighthouse perf gate (LCP < 3s)
- Vercel deploy
- Proposal HTML generation
- Universal AI-vocab blocklist + typographic standards

## Outputs the Factory produces
- `clients/[Client Name]/[Client Name] Website/dist/`, built site
- Vercel deploy URL
- `clients/[Client Name]/[Client Name] Proposal/proposal.html` + live proposal URL
- Delivery report at `clients/[Client Name]/Pipeline Data/delivery/delivery-report.md`

## Handoff format
The Module 5 brief lands at `research/output/website-factory-brief.md`. `/tailor-factory` reads it and updates any factory-wide settings that need to align with the niche (e.g. agency branding in the proposal template).
```

### Step 7, Lock
- Set `m4.factoryStructureLoaded=true`.
- Tell the student: "Factory structure mapped. Next: `/generate-wf-brief`."

## Files written
- `research/_structure/Website_Factory_Structure.md`
- `stack-state.json` updated
