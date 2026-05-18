---
description: Walk through pasting the content engine brief into the seven dashboard buckets.
---

Gate: `engine.deployed` must be true.

Invoke the `12-engine-context-walker` agent at `.claude/agents/12-engine-context-walker.md`.

Walks bucket-by-bucket in this order: my_business, instructions, my_voice, expert_brain, inspiration, video_ideas, feedback. Confirms each paste before moving on. Logs to `deployments/engine/context-paste.log`.

After all seven buckets, runs a sample generation to verify the context is working.

Lock with `engine.contextPasted=true`.
