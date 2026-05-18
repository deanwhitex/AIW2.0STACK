# Lessons system

The pipeline learns from corrections. Every confirmed correction lands as an
active rule that the relevant agent loads at Step 0 on every run.

## Architecture (auto-promote model)

```
the student corrects something
        ↓
/lesson "<correction>"
        ↓
parse → search for conflicts → present proposal
        ↓
the student confirms (1 commit / 2 edit / 3 skip)
        ↓
write to ledger.jsonl (audit trail)
        ↓
AUTO-PROMOTE to by-agent/<target>.md
        ↓
Next agent run reads it at Step 0 → behaviour evolves
```

No staging queue. No distill step. Confirmed = active.

## Files

| Path | Purpose |
|---|---|
| `ledger.jsonl` | Append-only audit log of every committed lesson. Source of truth. |
| `by-agent/<target>.md` | Active rules per agent. Auto-loaded at Step 0. |
| `archive/<YYYY-MM-DD>.md` | Replaced rules (when a new lesson supersedes an existing one). |
| `pending-review.md` | Legacy. Stays empty under the auto-promote model. |

## Routing rules (where a lesson lands)

When a lesson is committed, the `applies_to` field decides which `by-agent/<target>.md` file it goes into:

| `applies_to` | Lands in |
|---|---|
| Component file (`Hero.tsx`, `Footer.tsx`, etc.) | `by-agent/09-build.md` (build agent owns components) |
| Tool path (`tools/generate-mascot.py`) | the agent that calls the tool (e.g. `03-asset-scraper.md`) |
| Direct agent `.md` (`brand-dna-agent.md`) | `by-agent/<applies_to>` |
| Multi-target comma list | first agent `.md` in the list, OR `09-build.md` if any `.tsx` is in the list |
| `CLAUDE.md` (universal) | `by-agent/CLAUDE.md` |

Client-scope lessons (e.g. "{ClientName} prefers IMG_8525") land in
`clients/[Client]/Pipeline Data/lessons/notes.md` instead.

## Two quality gates that protect rule files

### Gate 1, Confirm-before-commit

`/lesson "..."` parses, searches for conflicts, prints the proposal, and
**waits**. Only when the student picks `1 Commit` (or `1 Replace` for conflicts)
does anything land in `by-agent/`.

### Gate 2, Supersession detection

When a new rule contradicts an existing rule on the same target, the
proposal shows both. The student picks:

- **Replace** → archive old, commit new (default for direct contradictions)
- **Amend** → keep both, new acts as refinement (default for nuance)
- **Skip** → existing stays, new discarded

Replaced rules move to `archive/<date>.md` with a "superseded by" pointer.

## How agents read rules at Step 0

Every agent's `## Process` block starts with:

```
### Step 0, Read accumulated lessons (REQUIRED)
1. Read .claude/lessons/by-agent/<this-agent>.md if it exists
2. Read clients/[Client Name]/Pipeline Data/lessons/notes.md if it exists
3. Apply rules as overrides to this spec; client-specific wins on conflict
```

Rules in `by-agent/<target>.md` take precedence over the agent's default spec.

## Commands

| Command | What it does |
|---|---|
| `/lesson "<correction>"` | Capture, propose, confirm, **auto-promote** to `by-agent/<target>.md` |
| `/lessons` | Print active rules per agent + ledger size |

## Edge cases

| Case | Behaviour |
|---|---|
| Mid-flight correction the student immediately re-corrects | First proposal not committed yet (waiting on confirm); the student hits `3 Skip`, types new `/lesson` for the corrected version |
| Identical `/lesson` typed twice within 5 mins | Second silently ignored as accidental double-fire |
| New rule says same thing as existing in different words | Step 3 detects `reinforces`, halts: "Already covered in by-agent/X. Skipping." |
| Conflict between universal and client-specific | Client-specific wins at runtime (Step 0 of every agent enforces this) |
| Lesson committed but later proves wrong | Run `/lesson "..."` with the corrected rule; conflict detector surfaces the existing one; the student picks Replace |

## Phase 4 lessons (deferred, not promoted)

Five lessons in the ledger relate to Phase 4 architectural ideas (SSR/SSG migration, per-client design language extraction, per-client component composition, CTA variance per client, hero prompt canonical no-op). These were captured during a Phase 4 effort that was rolled back. They stay in `ledger.jsonl` as audit history but are NOT in `by-agent/` and do NOT influence agent runs.

If the architecture later supports any of those rules, manually promote the relevant ledger entry into the appropriate `by-agent/<target>.md` file.

## Ledger entry schema

```json
{
  "ts": "2026-05-08T12:55:00Z",
  "stage": 7,
  "client": "Acme Construction",
  "what_i_did": "scored archetype as family_local_trusted",
  "what_you_corrected": "should be commercial_industrial_scale because tagline says 'Low Slope Specialist' and 96% of photos are commercial",
  "scope": "agent",
  "applies_to": "brand-dna-agent.md",
  "rule": "When logo tagline contains 'specialist' + photo evidence shows >80% one segment, override intake's stated mix",
  "raw_input": "<verbatim text the student typed after /lesson>",
  "replaces": null,
  "amends": null
}
```

`replaces` and `amends` point to the timestamp of an earlier ledger entry
(or null). They preserve the audit trail: any rule can be traced back
through replacements to its origin.
