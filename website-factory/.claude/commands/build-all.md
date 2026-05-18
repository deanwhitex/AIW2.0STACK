# /build-all

Runs the full pipeline end-to-end for a given client, starting at Stage 1
and halting at any approval gate or blocking flag.

## Usage

```
/build-all --client="Acme Roofing"
/build-all --client="Acme Roofing" --dry-run
```

## What this command does

Executes stages in order, with parallel groups where dependencies allow.
Each stage reads its agent file, verifies prerequisites, runs, and updates
`logs/pipeline-state.json` before the next stage starts. Halts at any gate.

## Stage flow (template-approach branch)

| Order | Stage(s) | Agent(s) | Gate |
|-------|----------|----------|------|
| Sequential | 1 Intake | `00-intake.md` | onboarding-form.json present |
| Sequential | 2 Research | `01-research.md` | research-report.md + research.json written (Apify actors run in parallel internally) |
| **Parallel group A** | **3 SEO** + **4 Asset harvest** + **5 Strategy** | `02-seo-audit.md` + `03-asset-scraper.md` + `04-strategy.md` | All three must complete |
| Sequential | 6 Copy deck | `05-copy-deck.md` | copy-deck.md written, validator confirms zero the niche template string leakage |
| Sequential | 7 Brand DNA | `brand-dna-agent.md` | brand-dna.json validated. Drops `archetype`. Adds `theme_mode` (light/dark) + `voice_register` + keeps `shape_motif` |
| Sequential, **OPTIONAL** | 7.5 Brand resonance | `07-5-brand-resonance.md` | Active. Apify (GBP + Facebook + website) + Playwright (screenshots + DOM vocabulary) + Pillow (color quantization) + Claude Vision (voice + photo style + theme_mode_recommendation). Stage 7 reads `theme_mode_recommendation` to set `brand-dna.theme_mode`. Skipped gracefully (no halt) if intake has no website URL or `ANTHROPIC_API_KEY` is unset. |
| Sequential | 9 Hero image | `08-hero-image.md` | BOTH `hero-final-desktop.png` AND `hero-final-mobile.png` written via Gemini API |
| Sequential | 10.1 Build | `09-build.md` | `tools/build-from-template.py --client "[X]"` clones templates/{niche-slug}/, overlays brand-dna.js, copies + optimises assets, npm install + npm run build, validator passes (no `__REQUIRED__` sentinels, no forbidden strings in dist) |
| Sequential | 10.2 Personalize | `10-personalize.md` | sitemap.xml + schema injected |
| Sequential | 10.3 Uplift | `11-uplift.md` | optional extras (scoped down vs prior approach; most things already in the niche template) |
| Sequential | 10.4a Design fidelity | `design-fidelity-qa-agent.md` | SSIM 100% structural match against templated reference (build templates/{niche-slug}/ with this client's brand-dna applied to a temp dir) |
| Sequential | 10.4b SOP QA | `sop-qa-agent.md` | BOTH niche-wireframe composition AND universal SOP at 100%, OR `/override-sop` |
| Sequential | 10.4c Build fidelity | `10-4c-build-fidelity.md` | `tools/build-fidelity-diff.py` reports zero structural mismatches (DOM tree shape matches templates/{niche-slug}/), 100% required |
| Sequential | 10.4d Perf | `10-4d-perf.md` | Lighthouse LCP < 3s on desktop AND mobile |
| Sequential | 11 Deploy | `13-deploy.md` | Vercel URL captured, smoke check passes |
| Sequential | 12 Delivery | `12-delivery.md` | delivery-report.md written |
| Sequential | 13 Proposal | `14-proposal.md` | proposal.html written + deployed to `https://[client-slug]-proposal.vercel.app`, 4/4 smoke checks pass |

## Parallel group A (Stages 3 + 4)

After Stage 2 writes research.json, the strategy agent (Stage 3) and the
asset-scraper agent (Stage 4) have independent dependencies and can run
concurrently:

- Stage 3 reads research.json + audit-data.json (note: audit-data is from Stage 5, but the strategy agent works from research alone for the early sitemap pass)
- Stage 4 reads research.json + the Apify cache populated in Stage 2, then downloads asset URLs

Launch as background processes from the build-all orchestrator:

```bash
# After Stage 2 completes
launch_stage_3_strategy &
PID_S=$!
launch_stage_4_assets &
PID_A=$!
wait $PID_S
wait $PID_A
```

Both must succeed before Stage 5 (SEO audit) starts.

**Wall-clock impact:** Stage 3 ≈ 3-5 min, Stage 4 ≈ 3-5 min (after Apify cache reuse). Sequential = 6-10 min. Parallel = 3-5 min. Saves ~3-5 min per pipeline run.

## Dry-run mode

`--dry-run` validates all inputs and agent files without executing any
stage. Reports what would run, what inputs are present, and what is
missing. Does not write any output files.

## Failure modes

| Condition | Response |
|-----------|----------|
| `--client` not provided | Halt: "Specify a client name. Example: /build-all --client=\"Acme Roofing\"" |
| Client folder missing | Halt: "No folder found at clients/[Client Name]/. Run /intake first." |
| Blocking flag in pipeline-state.json | Halt at the affected stage, print the flag, do not continue |
| Stage agent file missing | Halt: "Agent file missing: .claude/agents/[agent].md" |
| Approval gate reached (Stage 7, low confidence) | Halt with: "Brand DNA confidence < 0.70. Review `Pipeline Data/brand/extraction-report.md`, then run `/approve-brand-dna` to continue, or re-run Stage 7 with corrected inputs." |
| Stage 10.1 validator failed (`__REQUIRED__` sentinel survived) | Halt with the field path. Fix the upstream stage output that should have populated it, then re-run `/stage-10-1-build`. |
| Stage 10.1 validator failed (forbidden string in dist) | Halt with file + string. Some component wasn't fully refactored to consume `brandDNA.*`. Fix the literal, re-run `/stage-10-1-build`. |
| Stage 10.4b SOP gap | Run `/override-sop` to accept, OR re-run with fixes per the surfaced report. |
| Stage 10.4a fidelity gap | Run `/override-design-fidelity` to accept, OR investigate the SSIM diff in `Pipeline Data/qa-screenshots/`. |
| Parallel group: one branch fails | Wait for the other branch to complete, then halt with both exit codes |

## Pipeline state contract

After every stage completes, `clients/[Client Name]/Pipeline Data/logs/pipeline-state.json` is updated with `stage_X: complete` (or `stage_X: needs_regeneration` for soft failures). Re-runs of /build-all skip stages already marked complete unless `--force` is passed.
