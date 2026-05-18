---
description: Print the current active rule set per agent and ledger size
---

# /lessons, Show what the system has learned

Print a summary of the lessons system state. Read-only, no writes.

## Step 1, Show active rules per agent

For each `.md` file in `.claude/lessons/by-agent/`:
- Print the target name (filename minus `.md`)
- Count the `## Rule ` heading occurrences = active rule count
- Show a one-line summary per rule (the **Rule:** line)

Print as:

```
Active rules per agent:

  09-build.md          20 rules
    Rule 1:  Theme system, light + dark, no default ...
    Rule 2:  Available-now pulsating green indicator ...
    ... (truncate after 5 per file with "... and N more")

  brand-dna-agent.md   2 rules
    Rule 1:  When intake.themePreference is 'mix', set theme_toggle: true ...
    Rule 2:  Mascot also drives brand-dna voice ...

  03-asset-scraper.md  1 rule
    Rule 1:  Mascot system: scrape OR generate ...

  08-hero-image.md     1 rule
    Rule 1:  Generate desktop + mobile portrait variants ...
```

If the folder is empty (only `.gitkeep`), print: "No active rules. Use `/lesson \"...\"` to capture corrections."

## Step 2, Show ledger size

Count lines in `.claude/lessons/ledger.jsonl`. Print:

```
Ledger: N total entries (audit trail).
Active rules: M (auto-promoted).
Deferred: K (Phase 4 / no-op, in ledger but not promoted).
```

## Step 3, Suggest next action

- If active rule count is 0: "No active rules yet. Use `/lesson \"...\"` to capture a correction."
- Otherwise: "Use `/lesson \"...\"` to capture more corrections (auto-promotes after your confirm). Conflicts surface for replace/amend choice."
