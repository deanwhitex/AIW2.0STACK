---
description: Produce the website factory brief from research, offer, and factory structure.
---

Gate: `m3.offerLocked` and `m4.factoryStructureLoaded` must both be true.

Invoke the `07-factory-brief-writer` agent at `.claude/agents/07-factory-brief-writer.md`.

Ask the student for client-specific data (business name, URL, phone, location) if a real client is lined up. Otherwise mark fields `[MISSING]`.

Validate every required field from `research/_structure/Website_Factory_Structure.md` is either filled or marked `[MISSING]`. Do not lock if any required field is silently blank.

Output: `research/output/website-factory-brief.md`. Lock with `m5.factoryBriefLocked=true`.
