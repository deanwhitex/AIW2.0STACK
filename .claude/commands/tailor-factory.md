---
description: Register the active niche with the factory chrome: trust badges, CLAUDE.md orientation, copy-deck lessons seed. Does not touch universal SOPs (Module 2D owns the per-niche layer).
---

Gates: `m5.factoryBriefLocked` AND `m2d.templateBuilt` AND `factory.generated` must all be true.

If any gate is false, halt and tell the student to run the missing module. Module 2D's `/build-niche-template` must have completed (factory.generated = true) before this agent runs; this agent depends on the per-niche playbook + SOPs Module 2D wrote.

Invoke the `08-factory-tailor` agent at `.claude/agents/08-factory-tailor.md`.

Rewrites only these files (3 total):
1. `templates/{niche-slug}/niche-playbook/trust-signals.json`, add niche-specific badges from research
2. `website-factory/CLAUDE.md`, orientation only — title + top paragraph + niche-template pointer line
3. `website-factory/.claude/lessons/by-agent/05-copy-deck.md`, seed niche voice rules for the build agent

The agent does NOT touch universal SOPs (`website-factory/.claude/sops/`), universal checklists (`website-factory/.claude/checklists/`), or the per-niche template at `templates/{niche-slug}/`. Those are owned by Module 2D, which writes per-niche SOPs + agents + checklists at `templates/{niche-slug}/.claude/`. The QA agents merge the universal layer with the per-niche layer at runtime; factory-tailor's job is only to register the niche with the factory chrome.

Verify only the listed files changed. Lock with `factory.tailored=true`.
