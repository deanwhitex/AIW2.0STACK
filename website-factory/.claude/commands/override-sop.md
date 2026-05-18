# /override-sop

Accepts the current build despite an SOP compliance score below the 95%
target. Use only when the gap is understood and acceptable.

## Usage

```
/override-sop --reason="Blog section omitted by client request; SOP item N/A"
/override-sop --client=example-roofing --reason="..."
```

The `--reason` argument is required. The override will not execute without it.

## What this command does

1. Reads the most recent compliance score from `logs/build-log.md`
2. Requires a `--reason` string
3. Updates `logs/pipeline-state.json`:
   - `stage_10_4b: overridden`
   - Records the score at override time
   - Records the reason
   - Lists the failing checklist items at time of override
4. Appends to `logs/build-log.md`:
   ```
   ## Stage 10.4b, OVERRIDDEN
   Score at override: [score]%
   Failing items: [list]
   Reason: [reason]
   ```
5. Allows the pipeline to continue to Stage 11

## CRITICAL: these SOP items cannot be overridden

The following are hard failures. If any are present, this command
will refuse to run and will print the violating content:

- Em-dash anywhere in visible copy or code
- CTA label other than "__REQUIRED__CTA_PRIMARY__"
- Lead form header other than "__REQUIRED__FORM_HEADER__"
- Fabricated review count or rating (0 set intentionally is not fabricated)
- Process section with wrong step count (must be 6)

Fix these before attempting the override. They are not negotiable.
