---
description: Build the offer pack: positioning sentence, stage check, 3 cold DM versions, 5 personalized prospect DMs.
---

Gate: `m2d.templateBuilt` must be true (Module 2D produces the niche template the offer is anchored to).

Invoke the `05-offer-architect` agent at `.claude/agents/05-offer-architect.md`. Follow framework Module 3 (lines 201 to 277).

Pull customer language verbatim from `research/02-niche-research/{slug}/02-customer-voice.md`. Pull trust priorities from `05-trust-signals.md`. Personalize the 5 prospect DMs against real websites of the 5 example businesses from the niche decision.

Output: `research/03-offer-pack.md`. Lock with `m3.offerLocked=true`.
