# /approve-brand-dna

Approval gate used when Stage 7 halts with `stage_7: pending_review` (aggregate
confidence below 0.70).

Run this after reviewing `clients/[Client Name]/Pipeline Data/brand/extraction-report.md`
and confirming the brand DNA is acceptable to proceed with.

## Usage

```
/approve-brand-dna
```

To override with manual edits:
```
/approve-brand-dna --override
```

Use `--override` when you have manually edited `brand-dna.json` to fix specific
fields flagged in the extraction report.

## Checks

1. `extraction-report.md` exists (confirms Stage 7 ran and halted correctly)
2. `brand-dna.json` exists and validates against `references/schemas/brand-dna.schema.json`
3. `pipeline-state.json` shows `stage_7: pending_review`

## On pass

Update `clients/[Client Name]/Pipeline Data/logs/pipeline-state.json`:
```json
{ "stage_7": "complete" }
```

Append to `clients/[Client Name]/Pipeline Data/logs/build-log.md`:
```
## Stage 7, Brand DNA Approved
Status: complete (human-approved after low-confidence extraction)
```

Then automatically fire Stage 9 (hero image generation).

## On fail

Print which check failed and what to resolve. Do not update pipeline state.