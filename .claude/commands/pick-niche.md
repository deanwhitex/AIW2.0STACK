---
description: Commit to one niche after reviewing the three deep-research syntheses.
---

Gate: `m2b.researchComplete` must be true.

Steps:

1. Read all three syntheses:
```bash
ls research/02-niche-research/
cat research/02-niche-research/*/synthesis.md
```

2. Tell the student: "All three niches researched. Read the syntheses if you haven't. Which one are you committing to and why?"

3. Wait for them to name the niche and give 2 to 3 reasons.

4. Push back briefly: "Anything in the other two syntheses that gives you pause about dropping them? Anything pulling you to a different choice than the scoring suggested?"

5. Lock the niche:
- Write `research/02-niche-decision.md` using framework lines 170 to 196 (the final-pick portion). Include the 5 example businesses they could approach this week (pull from `01-agencies.md` and any local niche knowledge).
- Update `stack-state.json`: set `niche` to the chosen slug, set `m2c.nicheDecided=true`.
- Update `research/_state/project.json` with `chosenNiche`.

6. Trigger Sub-task 8 of the niche researcher: build the starter design template. Invoke `04-niche-researcher` for just Sub-task 8 on the chosen niche.

7. Tell the student: "Locked. Niche template generated at `research/02-niche-research/{slug}/08-starter-template.md`. Next: `/craft-offer`."
