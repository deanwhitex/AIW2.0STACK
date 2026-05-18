# /stage10-4b-sop-qa

Invokes `sop-qa-agent` to score the built site against the SOP compliance
checklist. Loops up to 10 times targeting >= 95% compliance. Auto-triggered
after Stage 10.4a passes.

## Usage

```
/stage10-4b-sop-qa
/stage10-4b-sop-qa --client=example-roofing
```

## Prerequisites

| Input | Location | Required |
|-------|----------|---------|
| Built site | `clients/[Client Name]/Pipeline Data/build/` | Yes |
| copy-deck.md | `clients/[Client Name]/Pipeline Data/copy/` | Yes |
| sop-compliance.md checklist | `.claude/checklists/` | Yes |
| pipeline-state stage_10_4a: complete | `logs/pipeline-state.json` | Yes |

## What this command does

1. Reads `.claude/agents/sop-qa-agent.md` end-to-end
2. Reads `.claude/checklists/sop-compliance.md`
3. Runs each checklist item against the build source
4. Scores compliance as a percentage
5. If score < 95% and loop count < 10:
   - Lists failing checklist items
   - Applies targeted fixes
   - Re-scores
6. If score >= 95%: marks `stage_10_4b: complete`
7. If score < 95% after 10 loops: halts, prints compliance report,
   prompts for `/override-sop`

## Critical SOP checks (universal HARD halts)

- Em-dash anywhere in visible copy, alt text, comments, or JSX attributes
- Any surviving `__REQUIRED__*` sentinel in `src/` or `dist/`
- `scripts/validate-brand-dna.mjs` non-zero exit
- Fabricated Google review count or rating

Niche-specific HARD halts (resolved from the active niche's
`templates/{active-niche-slug}/.claude/checklists/sop-compliance.md`):

- CTA label other than `niche-playbook/copy-locks.json -> ctaPrimary`
- Lead form header other than `niche-playbook/copy-locks.json -> formHeader`
- Lead form missing `niche-playbook/copy-locks.json -> formPrivacy`
- Process step count not matching `niche-playbook/process.json -> stepCount`
- Trust signal claim count + badge count not matching `niche-playbook/trust-signals.json -> trustStripCount`

## Loop cap

Maximum 10 loops. Each loop result is logged to `logs/build-log.md`.

## Failure modes

| Condition | Response |
|-----------|----------|
| sop-compliance.md missing | Halt: "Checklist file missing at .claude/checklists/sop-compliance.md" |
| Build folder missing | Halt: "Run /stage10-1-build first." |
| Loop limit reached | Print full compliance report. Prompt: "Run /override-sop to accept." |
