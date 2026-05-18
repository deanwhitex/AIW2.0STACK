---
description: List every command with its current gate status (runnable or blocked).
---

Read `stack-state.json` to check gates.

Print the command list grouped by stage:

```
AIW 2.0 Stack, Commands

Stage 0: One-time setup
  [runnable / blocked: {gate}] /setup           credentials wizard
  [runnable / blocked: {gate}] /setup-agency    your agency profile (used in every proposal)

Stage 1: Research, Offer, and Template
  [runnable / blocked: {gate}] /discovery
  [runnable / blocked: {gate}] /score-niches
  [runnable / blocked: {gate}] /research
  [runnable / blocked: {gate}] /pick-niche
  [runnable / blocked: {gate}] /build-niche-template
  [runnable / blocked: {gate}] /craft-offer

Stage 2: Website Factory
  [runnable / blocked: {gate}] /load-factory-structure
  [runnable / blocked: {gate}] /generate-wf-brief
  [runnable / blocked: {gate}] /tailor-factory
  [runnable / blocked: {gate}] /run-factory

Stage 3: Content Engine
  [runnable / blocked: {gate}] /load-engine-structure
  [runnable / blocked: {gate}] /generate-ce-brief
  [runnable / blocked: {gate}] /deploy-engine
  [runnable / blocked: {gate}] /walk-engine

Lessons loop
  [runnable / blocked: {gate}] /factory-feedback
  [runnable / blocked: {gate}] /refine-template

Utility
  /start    show what to run next
  /status   show full state
  /help     this command
```

For each command, "runnable" means its gate is satisfied right now. "blocked: gateName" tells the student which gate they need to satisfy first.

Do not modify state.
