---
description: Produce the content engine brief structured by the seven buckets.
---

Gate: `m3.offerLocked` and `m6.engineStructureLoaded` must both be true.

Invoke the `10-engine-brief-writer` agent at `.claude/agents/10-engine-brief-writer.md`.

Each bucket section is paste-ready text for the live engine dashboard. For `my_voice`, if the student has no existing content, mark `[STUDENT TO POPULATE]` rather than fabricating samples.

Validate every bucket has content or a clear placeholder. Refuse to lock if a required bucket is empty.

Output: `research/output/content-engine-brief.md`. Lock with `m7.engineBriefLocked=true`.
