# /stage10-4a-design-qa

Invokes `design-fidelity-qa-agent` to run a visual diff between the built
site and a headless render of `templates/{active-niche-slug}/` with this
client's brand-dna applied. Loops up to 5 times targeting >= 0.90 fidelity.
Auto-triggered after Stage 10.1 completes.

## Usage

```
/stage10-4a-design-qa
/stage10-4a-design-qa --client=example-roofing
```

## Prerequisites

| Input | Location | Required |
|-------|----------|---------|
| Active niche template | `templates/{active-niche-slug}/` | Yes |
| Built site | `clients/[Client Name]/[Client Name] Website/` | Yes |
| Playwright | Local install | Yes |
| pipeline-state stage_10_1: complete | `clients/[Client Name]/Pipeline Data/logs/pipeline-state.json` | Yes |

## What this command does

1. Reads `.claude/agents/design-fidelity-qa-agent.md` end-to-end
2. Resolves the merged checklist: universal layer
   (`website-factory/.claude/checklists/design-fidelity.universal.md`)
   + per-niche layer
   (`templates/{active-niche-slug}/.claude/checklists/design-fidelity.md`)
3. Renders the per-niche template with the client's brand-dna applied
   to a temp dir (the design fidelity reference)
4. Takes Playwright screenshots of the built site at 1440px desktop +
   375px mobile
5. Diffs the screenshots against the reference render section by section
   (per-region SSIM)
6. Scores fidelity (0.00 to 1.00 per region; aggregate weighted by
   conversion criticality)
7. If aggregate < 0.90 and loop count < 5:
   - Identifies the lowest-scoring sections
   - Applies targeted fixes to the build
   - Re-runs the diff
8. If aggregate >= 0.90: marks `stage_10_4a: complete`
9. If aggregate < 0.90 after 5 loops: halts, prints gap report, prompts for `/override-design-fidelity`

## Loop cap

Maximum 5 loops. Each loop result is logged to `clients/[Client Name]/Pipeline Data/logs/build-log.md` with
the fidelity score and which sections were fixed.

## Failure modes

| Condition | Response |
|-----------|----------|
| Playwright not installed | Halt: "Run: npx playwright install" |
| Build folder missing | Halt: "Run /stage10-1-build first." |
| Active niche template missing | Halt: "Run /build-niche-template (Module 2D) first." |
| Loop limit reached without passing | Print gap report. Prompt: "Run /override-design-fidelity to accept current build." |
