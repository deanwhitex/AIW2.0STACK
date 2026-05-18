---
description: Run Apify-driven deep niche research on the 3 finalists. Eight sub-tasks per niche.
---

Gate: `m2a.scoresLocked` must be true and `credentials.apify` must be true. If not, route to `/score-niches` or `/setup`.

Invoke the `04-niche-researcher` agent at `.claude/agents/04-niche-researcher.md`. Use the `apify-niche-research` skill for actor invocations.

For each of the 3 finalists, produce sub-task files 01 to 07 in `research/02-niche-research/{slug}/`. Sub-task 8 (starter design template) runs only after `/pick-niche` for the chosen niche.

Every analysis targets the **end customer** of the niche business, not the niche business itself.

Expected Apify cost: $1 to $2 per niche pass. Three niches total fits the $5 student budget (free credit at signup). Log every actor invocation to `logs/apify-runs.jsonl`.

Output: `research/02-niche-research/{slug}/` per niche, plus `synthesis.md`. Lock with `m2b.researchComplete=true`.
