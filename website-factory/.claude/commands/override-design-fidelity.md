# /override-design-fidelity

Accepts the current build despite a design fidelity QA score below the
0.90 target. Use only when the gap is understood and acceptable.

## Usage

```
/override-design-fidelity --reason="Hero section font size differs from mockup; accepted"
/override-design-fidelity --client=example-roofing --reason="..."
```

The `--reason` argument is required. The override will not execute without it.

## What this command does

1. Reads the most recent fidelity score from `logs/build-log.md`
2. Requires a `--reason` string describing why the gap is acceptable
3. Updates `logs/pipeline-state.json`:
   - `stage_10_4a: overridden`
   - Records the score at override time
   - Records the reason
4. Appends to `logs/build-log.md`:
   ```
   ## Stage 10.4a, OVERRIDDEN
   Score at override: [score]
   Reason: [reason]
   ```
5. Allows the pipeline to continue to Stage 10.4b

## When to use this

- The visual gap is in a section that will be updated in a future round
- The per-niche template reference diverged from what the client approved verbally
- The fidelity loop fixed the critical sections; the remaining gap is
  in a low-priority area (e.g. footer fine-print)

## When NOT to use this

- If hero, above-the-fold content, or primary CTA sections are failing
- If the gap would be visible to the client on delivery

## Does not reset QA loops. The score is permanent in the log.
