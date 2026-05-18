---
description: Run the Module 1 self-interview to surface raw niche candidates.
---

Gate: `setup.complete` must be true in `stack-state.json`. If not, route back to `/setup`.

Invoke the `02-discovery-interviewer` agent at `.claude/agents/02-discovery-interviewer.md`. Follow the 7-section framework at `research/_framework/Student_Research_System.md` lines 56 to 91. One question at a time. Echo back. Probe specifics. Refuse vague answers.

Output: `research/01-student-profile.md`. Lock with `m1.profileLocked=true`.
