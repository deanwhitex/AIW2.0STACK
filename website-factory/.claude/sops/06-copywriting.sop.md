# 06 - Copywriting SOP

Implements: Stage 6.

## Niche customisation

The voice grammar, CRO patterns, section formulas, locked phrases, owner story
arc, and review guardrails come from the niche playbook:

- `templates/{active-niche-slug}/niche-playbook/copywriting.md`

Module 2D writes this file from the top-of-niche research the student ran. The
copywriting skill (`.claude/skills/copywriting/SKILL.md`) provides the
universal contract. This SOP is the stage-level checklist that enforces both
universal and niche-specific rules at the QA gate.

## Universal procedure

1. Load `templates/{active-niche}/niche-playbook/copywriting.md`. Halt if
   missing (point user at Module 2D).
2. For each page in `strategy/sitemap.json`:
   - Open the matching section formula from the niche playbook
   - Inject variables (company, owner, city, services, voice, target_keyword, h1)
   - Generate copy. Required per page: `page_title` (30–70 chars),
     `h1` (≥10 chars), `meta_description` (150–160 chars), full section copy.
3. **Reviews:**
   - Pull up to 6 real reviews from `research.json.reviewSummary`
   - If real < 3, invoke the objection-review-generator (defined in the niche
     playbook). Generated reviews flagged `is_generated: true`. User must
     approve at the Brand Guide gate.
4. **Resonance integration:** If `social-resonance.json` exists (Stage 15
   pre-run), apply niche playbook's resonance mapping: top pain point → hero
   H1, top objections → sub-H1, top trust signals → reviews, local colour →
   body copy. Never mention brands the client doesn't actually carry.
5. **Universal audit gates (apply regardless of niche):**
   - **AI-vocab audit** against `references/copy/ai-vocab-blocklist.md`:
     ```bash
     python3 tools/copy-lint.py --check \
       clients/[Client Name]/Pipeline Data/copy/copy-deck.md \
       --include-niche {active-niche-slug}
     ```
     Any hit fails the gate. Plus niche playbook's blocklist additions at
     `niche-playbook/copy-blocklist-additions.md` (optional).
   - **Em-dash audit**: zero em-dashes (`,` or `--`) anywhere. The copy-lint
     emits findings; rewrite each as period/comma/colon.
   - **Typographic standards** per `references/copy/typographic-standards.md`:
     curly quotes, en-dashes, ellipsis glyph, tabular nums on numbers.
     `python3 tools/copy-lint.py --fix` rewrites straight quotes in place.
   - **Smart-quote pass**: run `python3 tools/copy-lint.py --fix copy-deck.md`
     before validation.
6. Apply universal CRO golden rules (see master blueprint cross-cutting
   requirements; niche-specific locks come from `niche-playbook/copy-locks.json`).
7. Validate against `copy-deck.schema.json`.

## Pass gate

- Every sitemap page has copy
- Zero `[BRACKET]` placeholders
- `copy-lint --check` returns exit 0 (no hard findings)
- Zero em-dashes
- Title length 30-70, meta description 150-160
- All numeric columns use `tabular-nums`
- All copy uses curly quotes (or copy-lint `--fix` was run)
- Reviews reference at least 2 distinct trust signals from
  `social-resonance.json` (when present)
- Zero mentions of brand names the client doesn't actually carry
