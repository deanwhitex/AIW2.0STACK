---
description: Score 5 candidate niches on the 7-factor matrix. Flag top 3 for deep research.
---

Gate: `m1.profileLocked` must be true. If not, route to `/discovery`.

Invoke the `03-niche-scorer` agent at `.claude/agents/03-niche-scorer.md`. Use the framework's scoring matrix (lines 142 to 151). One factor at a time per candidate. Push back on scores that don't match evidence.

Output: `research/02-niche-scoring.md`. Lock with `m2a.scoresLocked=true`.
