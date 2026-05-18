---
description: Print the full state of the stack: gates, credentials, deployments, factory runs.
---

Read `stack-state.json`. Pretty-print it back to the student in this format:

```
AIW 2.0 Stack Status

Student: {studentName or "not yet captured"}
Niche: {niche or "not yet chosen"}
Current module: {module}

Gates:
  [ok / x] setup.complete
  [ok / x] m1.profileLocked
  [ok / x] m2a.scoresLocked
  [ok / x] m2b.researchComplete
  [ok / x] m2c.nicheDecided
  [ok / x] m2d.templateBuilt
  [ok / x] m3.offerLocked
  [ok / x] m4.factoryStructureLoaded
  [ok / x] m5.factoryBriefLocked
  [ok / x] factory.tailored
  [ok / x] factory.deployed
  [ok / x] m6.engineStructureLoaded
  [ok / x] m7.engineBriefLocked
  [ok / x] engine.deployed
  [ok / x] engine.contextPasted

Credentials:
  [✓ / ✗] anthropic, apify, supabase, vercel, github
  (optional: assemblyAi, gemini)

Deployments:
  Factory: {url or "not yet deployed"}
  Engine: {url or "not yet deployed"}

Factory runs: {count}
Last run: {client name + date or "none"}

Next command: {run /start to get the recommendation}
```

Use checkmarks for ✓ and "x" for false gates (no emojis, use plain "[ok]" and "[ ]" if needed).

Do not modify state.
