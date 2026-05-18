# /stage-10-1-build

Invokes `09-build.md` (Stage 10.1) to scaffold the live React + Vite + Tailwind
site by overlaying brand DNA + the generated hero image onto the per-niche
template at `templates/{active-niche-slug}/`.

## Usage

```
/stage-10-1-build
/stage-10-1-build --client="Client Name"
/stage-10-1-build --skip-install
```

`--skip-install` skips `npm install`, useful for re-runs where dependencies
are already present.

## Prerequisites

Stage 10.1 cannot run unless ALL of these are true:

| Stage | State |
|-------|-------|
| Stage 7 (Brand DNA) | `complete` |
| Stage 9 (Hero image) | `complete` |
| `factory.generated` gate | `true` (Module 2D ran `/build-niche-template`) |

Stage 10.1 reads `pipeline-state.json` + `stack-state.json` and refuses
to start if any prerequisite is missing.

## What this command does

1. Reads `.claude/agents/09-build.md` end-to-end
2. Verifies all prerequisite stages are complete
3. Confirms required input files exist:
   - `clients/[Client Name]/Pipeline Data/brand/brand-dna.json`
   - `clients/[Client Name]/Pipeline Data/hero-image/hero-final-desktop.png`
   - `clients/[Client Name]/Pipeline Data/hero-image/hero-final-mobile.png`
   - `clients/[Client Name]/Pipeline Data/copy/copy-deck.md`
   - `clients/[Client Name]/Pipeline Data/strategy/sitemap.json`
   - `clients/[Client Name]/[Client Name] Assets/logo/`
   - `clients/[Client Name]/[Client Name] Assets/founder-photos/` (at least one photo)

4. If any required input is missing, halts with `MANUAL-DROP-NEEDED.md` listing
   exactly what's needed and where it goes.

5. Otherwise, executes the process from `09-build.md`:
   - Resolve the active niche template via `template-routes.json byNiche`
   - Halt with `NoNicheTemplateError` if no entry exists or
     `GENERATION-FAILED.md` is present
   - Clone the per-niche template to `clients/[Client Name]/[Client Name] Website/`
   - Overlay brand-dna.js (fills sentinels from brand-dna.json)
   - Copy assets to public/
   - Run prebuild hooks (validate-brand-dna.mjs + inject-theme.mjs)
   - `npm install && npm run build`
   - Visual quality check + /impeccable audit

6. Auto-triggers Stage 10.2 (Personalise) on completion.

## Output

```
clients/[Client Name]/[Client Name] Website/
├── package.json (cloned from per-niche template)
├── src/
│   ├── components/    cloned from per-niche template
│   ├── pages/         cloned from per-niche template
│   └── config/
│       └── brand-dna.js    sentinels filled from client brand-dna.json
└── public/
    ├── logo.*
    ├── hero-image.webp
    ├── hero-image-mobile.webp
    ├── badges/        matched trust badge files
    └── [founder photos]
```

## Failure handling

| Condition | Response |
|-----------|----------|
| Prerequisite stage incomplete | Halt, point to missing stage's command |
| Required asset missing | Halt, write MANUAL-DROP-NEEDED.md |
| `npm install` fails | Halt with the exact error, do not retry |
| `npm run build` fails | Halt with the exact error |
| Bundle size > 1MB gzip | Continue but log warning |

## After build completes

Stage 10.2 (Personalise) auto-fires. Invoke manually with `/stage10-4a-design-qa`
to inspect output before personalisation if needed.