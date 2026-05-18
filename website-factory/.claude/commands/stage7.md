# /stage7

Invokes `brand-dna-agent` to extract brand DNA from the client's logo,
research data, and assets, then writes a validated `brand-dna.json`.

## Usage

```
/stage7
/stage7 --client=example-roofing
```

## Prerequisites

| Input | Location | Required |
|-------|----------|---------|
| research-data.json | `clients/[Client Name]/Pipeline Data/research/` | Yes |
| Logo file | `clients/[Client Name]/Pipeline Data/assets/logo/` | Yes |
| research-report.md | `clients/[Client Name]/Pipeline Data/research/` | Yes |
| copy-deck.md | `clients/[Client Name]/Pipeline Data/copy/` | Recommended |

## What this command does

1. Reads `.claude/agents/brand-dna-agent.md` end-to-end
2. Reads `.claude/skills/design-synthesis/SKILL.md`
3. Runs the five-pass extraction process against logo + research + assets
4. Validates the output against `references/schemas/brand-dna.schema.json`
5. Writes `clients/[Client Name]/Pipeline Data/brand/brand-dna.json`
6. Updates `logs/pipeline-state.json` to `stage_7: complete`
7. Appends to `logs/build-log.md`

## Output

```
clients/[Client Name]/Pipeline Data/brand/brand-dna.json
```

## Failure modes

| Condition | Response |
|-----------|----------|
| Logo missing | Halt: "Logo not found at clients/[Client Name]/Pipeline Data/assets/logo/. Drop the file and re-run." |
| research-data.json missing | Halt: "Run /stage2 (research) first." |
| Schema validation fails | Print all failing fields with expected types. Do not write partial output. |
| Confidence < 0.70 on palette | Warn in output and in build-log.md. Write the file but flag for review. |

## After completion

Run `/stage9` (hero image) next, or run `/diagnose-brand-dna` to
inspect confidence scores before proceeding.
