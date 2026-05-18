---
description: Capture a correction (with supersession detection + confirmation gate)
---

# /lesson, Capture a correction

User input: $ARGUMENTS

You convert the student's natural-language correction into a structured ledger
entry. **Nothing gets written until the student explicitly confirms.** You also
detect when a new rule contradicts an existing one and propose
replacement, amendment, or discard.

---

## Step 1, Parse the correction

From `$ARGUMENTS`, extract:

| Field | What |
|---|---|
| `what_i_did` | What was wrong (action or output, 1 sentence) |
| `what_you_corrected` | The correction (1 sentence) |
| `rule` | The generalised pattern, must be actionable (1 sentence) |
| `applies_to` | Which agent or skill this maps to. See list below. |
| `scope` | One of `client`, `agent`, `universal`. See definitions below. |
| `stage` | Pipeline stage that was running, or null |
| `client` | The active client name, or null |

### Valid `applies_to` values

**Agents:** `00-intake.md`, `01-research.md`, `02-seo-audit.md`,
`03-asset-scraper.md`, `04-strategy.md`, `05-copy-deck.md`,
`brand-dna-agent.md`, `08-hero-image.md`, `09-build.md`,
`10-personalize.md`, `11-uplift.md`, `12-delivery.md`, `13-deploy.md`,
`14-proposal.md`, `14-template-builder.md`, `design-fidelity-qa-agent.md`, `sop-qa-agent.md`

**Skills:** `design-synthesis`, `copywriting`, `frontend-design`,
`nano-banana`, `seo`, `asset-scraping`, `research`, `proposal-writing`,
`vercel-deploy`, `impeccable`, `taste`, `ui-ux-pro-max`

**Universal:** `CLAUDE.md` (only when the rule applies to every agent on every project)

### Scope definitions

- `client`, applies to one client only (e.g. "David prefers IMG_8525")
- `agent`, applies to every run of one stage agent (e.g. "always weight tagline + photo evidence over intake's stated mix")
- `universal`, applies to every agent on every project (e.g. "never use Inter, DM Sans, or Cormorant fonts")

---

## Step 2, Determine active client + stage

Find the most recently modified `clients/*/Pipeline Data/logs/pipeline-state.json`.
Read it. The `client` field becomes the lesson's `client` field. The
highest `stage_X` not equal to `complete` becomes the lesson's `stage`.

If no client folder exists, set both to null.

---

## Step 3, Search for contradicting or related rules

Search for any existing rule on the same `applies_to` target across:

1. `.claude/lessons/pending-review.md` (queued, not yet promoted)
2. `.claude/lessons/by-agent/<applies_to>` (promoted, auto-loaded)
3. `clients/[Client Name]/Pipeline Data/lessons/notes.md` (client-specific, when scope is `client`)

For each rule found, semantically classify the relationship to the new rule:

| Relationship | Definition |
|---|---|
| `contradicts` | Old says do X in trigger T, new says do Y in trigger T (mutually exclusive) |
| `amends` | New narrows or extends the old (e.g. old: "X always", new: "X except in case W") |
| `reinforces` | Same intent, different wording (treat as duplicate, do not commit) |
| `unrelated` | Different trigger or scope |

If `reinforces` is detected, halt and tell the student:
"This rule is essentially the same as an existing one (`<existing rule text>` in `<file>`). Skipping as duplicate."
Do not proceed to Step 4.

---

## Step 4, Present the proposal to the student and wait

Print one of two blocks based on Step 3.

### Block A, no conflict

```
PROPOSED LESSON

Scope:       <client|agent|universal>
Applies to:  <target>
Rule:        <generalised rule>
What I did:  <description>
Original:    <verbatim user text>

[1] Commit  (default)
[2] Edit    (tell me what to change, I'll re-propose)
[3] Skip    (this was an in-flight correction, not a real lesson)

the student?
```

### Block B, conflict detected

```
CONFLICT on <target>

EXISTING RULE (location: <file>, captured <timestamp>):
  "<existing rule text>"

NEW RULE:
  "<new rule text>"

Relationship: <contradicts | amends>

[1] Replace  (archive existing, commit new) ← default for `contradicts`
[2] Amend    (keep both, mark new as exception/refinement) ← default for `amends`
[3] Skip     (existing stays, discard this one)

the student?
```

**Stop here. Wait for the student's response.** Do not write anything yet.

---

## Step 5, Act on the student's response

| Response | Action |
|---|---|
| `1` or `commit` (Block A) | Proceed to Step 6, write to ledger + pending-review |
| `1` or `replace` (Block B) | Archive existing, then proceed to Step 6 with `replaces` field set |
| `2` or `edit` (Block A) | Ask "What should change?" then re-run from Step 1 with the edit |
| `2` or `amend` (Block B) | Proceed to Step 6 with `amends` field set; do NOT archive existing |
| `3` or `skip` | Print "Lesson skipped, nothing written." and stop |

---

## Step 6, Commit (only after the student confirmed)

### 6a, Append to ledger.jsonl

Append exactly one line to `.claude/lessons/ledger.jsonl`:

```json
{"ts":"<ISO 8601 UTC>","stage":<int|null>,"client":"<string|null>","what_i_did":"<string>","what_you_corrected":"<string>","scope":"<client|agent|universal>","applies_to":"<filename or 'CLAUDE.md'>","rule":"<string>","raw_input":"<original $ARGUMENTS>","replaces":"<ts of replaced entry, if any>","amends":"<ts of amended entry, if any>"}
```

Always include `replaces` and `amends` fields, set to `null` when not applicable.

### 6b, AUTO-PROMOTE to .claude/lessons/by-agent/<target>.md

Skip the pending-review queue. Lessons commit straight to active rules.

Resolve the target file using this routing:

| `applies_to` value | Lands in |
|---|---|
| Component file (`Hero.tsx`, `Footer.tsx`, or any per-niche component name) | `by-agent/09-build.md` (build agent owns components) |
| Tool path (`tools/generate-mascot.py`) | the agent that calls the tool: `tools/generate-mascot.py` -> `03-asset-scraper.md`, `tools/generate-hero.py` -> `08-hero-image.md`, `tools/apify-scrape.py` -> `01-research.md` |
| Direct agent `.md` (`brand-dna-agent.md`, `09-build.md`) | `by-agent/<applies_to>` |
| Multi-target comma list | first agent `.md` in the list, OR `09-build.md` if any `.tsx` is in the list |
| `CLAUDE.md` (universal) | `by-agent/CLAUDE.md` |

Append the rule to that file as a new `## Rule N` block following the format below. If the file does not exist, create it with the header template.

```markdown
# Promoted rules for `<target>`

Auto-loaded by this agent at Step 0 (per the universal Step 0 lesson-load convention).
Each rule below was captured via `/lesson` and confirmed by the student. Apply on every run.

**Rule count:** <updated total>

---

## Rule N

- Captured: <ts>
- Scope: <scope>
- Origin: <client name or n/a>
- Original applies_to: `<applies_to>` (only show if different from target, e.g., a `Hero.tsx` rule consolidated into `09-build.md`)

**Rule:** <generalised rule>

**What I would have done by default:** <what_i_did>

> Amends ledger entry `<amends ts>`. (only if amends is set)

---
```

After writing, update the `**Rule count:** N` header to the new total (count `## Rule ` heading occurrences).

### 6c, If scope is `client`, also write to client-specific notes

If `scope == "client"` AND client field is not null:

1. Ensure folder exists: `clients/[Client Name]/Pipeline Data/lessons/`
2. Append the same markdown block to `clients/[Client Name]/Pipeline Data/lessons/notes.md`
3. If notes.md does not exist, create it with header:
   ```
   # Client-specific corrections, [Client Name]

   These corrections apply to this client only. Auto-loaded by every
   agent at Step 0.

   ---
   ```

### 6d, If Replace was chosen, archive the existing rule

1. Append the existing entry to `.claude/lessons/archive/YYYY-MM-DD.md`
   (create file with header `# Archived lessons, YYYY-MM-DD` if missing)
2. Add a "superseded by" pointer to the archived entry:
   ```
   - **Superseded by:** <new lesson timestamp> on <date>
   ```
3. Remove the existing entry from its source file (`by-agent/<target>.md` or `notes.md`)

### 6e, If Amend was chosen

Do not archive the existing entry. The new entry's `amends` field points
to the existing one. Both apply at runtime; the agent reads both and
treats the newer one as a refinement of the older one.

---

## Step 7, Confirm to the student

Print one of:

```
Lesson committed and PROMOTED.

Scope:       <scope>
Applies to:  <target>
Promoted to: .claude/lessons/by-agent/<target>.md
Rule:        <rule>

Total active rules in <target>: <updated count>
```

```
Lesson committed (replaces existing rule on <target>).
Archived: .claude/lessons/archive/YYYY-MM-DD.md
Active rule count in <target>: <updated count>
```

```
Lesson committed (amends existing rule on <target>).
Both rules now apply; the new one acts as a refinement.
Active rule count in <target>: <updated count>
```

```
Lesson skipped, nothing written.
```

The lesson is now LIVE, the next time the target agent runs, its Step 0 will load this rule.

---

## Idempotency note

If `$ARGUMENTS` is identical (verbatim) to a recent entry in the ledger
(within last 5 minutes), treat as accidental double-fire and skip silently
with: "Just captured this, ignoring duplicate."
