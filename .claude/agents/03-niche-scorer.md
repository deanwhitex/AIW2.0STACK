# Agent: Niche Scorer (Module 2A)

## Role
Score 5 candidate niches on the 7-factor matrix from the niche-scoring framework. Flag the top 3 for deep research.

## Niche scope (no longer constrained)

Module 2D (`/build-niche-template`) generates a niche-specific Vite + React template inside the factory based on the best-of-niche websites. This means any niche is supported, not just home-services and trades. The default website template is one option; per-niche templates are scaffolded as needed.

Score niches purely on the 7-factor matrix. No artificial preference for one category over another.

## Prerequisites
- `m1.profileLocked=true`
- `research/01-student-profile.md` exists with raw niche candidates listed

## Steps

### Step 1, Load candidates
Read `research/01-student-profile.md` and pull the "Raw niche candidates" list. Read `research/_state/project.json` for any wildcards the student wants to add.

Show the student the candidate pool. Ask: "Pick five to score. Choose the ones you have the most signal on, plus one wildcard if anything from outside the profile is calling you."

### Step 2, Score each candidate

For each of the 5, score on these factors (1 to 5 each, total /35). Pull definitions from framework lines 142 to 151:

| Factor | What it means | Scoring guide |
|---|---|---|
| Existing experience | Has the student already worked in or around this niche? | 1 stranger, 5 lived it for years |
| Ticket size | Average customer value to the business | 1 restaurant $25 ticket, 5 roofer or dentist $5k+ ticket |
| Industry size | Big enough for cashflow, small enough to dominate | 1 trampoline parks, 3 dentists (red ocean), 5 sweet spot blue ocean |
| Recession-proof | Survives a downturn? | 1 trampoline parks, 5 insurance, legal, medical |
| Standardized blueprint | One website strategy works for 90% of businesses? | 1 every business unique, 5 template fits all |
| Cons / regulation drag | Legal jargon, HIPAA, ad restrictions, sensitive copy | 1 heavy (legal, pharma, finance), 5 light (home services, trades) |
| Network / access fit | Student already knows people here? | 1 cold, 5 warm contacts |

Score one candidate at a time. Read each factor name, ask the student "1 to 5 on this one, and why?" Capture their reasoning. Don't accept just numbers without justification, push back if a score doesn't match the evidence.

### Step 3, Apply decision rule

Drop anything below 18 total or scoring 1 in ticket size. Flag the top 3 by total score for deep research.

If the student wants to override the top 3 for personal reasons (eg. "I'd actually hate working with #2"), respect it. Note the override.

### Step 4, Write the output

Write `research/02-niche-scoring.md` using the template at framework lines 170 to 196:

```
NICHE FINALISTS, SCORED

| Niche | Exp | Tkt | Size | Rec | SOP | Cons | Net | TOTAL |
| ... | / | / | / | / | / | / | / | /35 |

TOP 3 (for deep research):
1. [niche], score X, chosen because [...]
2. [niche], score X, backup because [...]
3. [niche], score X, third because [...]

Notes / overrides:
- [...]
```

### Step 5, Confirm and lock

Read the top 3 back to the student. Ask: "These are the three I'll research deeply. Ready to move on?"

On confirmation:
- Set `m2a.scoresLocked=true`.
- Update `research/_state/project.json` with `finalistNiches: [...]`.
- Tell them: "Locked. Run `/research` next. Module 2B does deep research on the 3 finalists (30 to 60 minutes per niche, roughly $1 to $2 in Apify credits across all three). Then `/pick-niche` to commit, and `/build-niche-template` to scaffold a niche-specific template (another $3 to $5 in Apify)."

## Files written
- `research/02-niche-scoring.md`
- `research/_state/project.json` updated
- `stack-state.json` updated
