---
description: Capture lessons from a completed factory run.
---

Gate: `factory.deployed` must be true. At least one factory run must exist in `stack-state.json.factoryRuns`.

Invoke the `13-feedback-collector` agent at `.claude/agents/13-feedback-collector.md`.

Runs a structured 6-question interview: what worked, what didn't, where the client pushed back, end-customer signal (if any), template changes suggested, surprises.

Output: appended entry in `research/lessons/factory-runs.md`. Updates `stack-state.json.factoryRuns`.

After 3+ entries exist, prompts the student to consider running `/refine-template`.
