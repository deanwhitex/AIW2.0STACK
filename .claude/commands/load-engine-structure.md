---
description: Auto-scan the content-engine tree and write the engine structure doc.
---

Gate: This is auto-runnable any time after `m3.offerLocked` (the factory side doesn't need to be done first). If `factory.deployed=true`, even better.

Invoke the `09-engine-loader` agent at `.claude/agents/09-engine-loader.md`.

Output: `research/_structure/Content_Engine_Structure.md`. Lock with `m6.engineStructureLoaded=true`.
