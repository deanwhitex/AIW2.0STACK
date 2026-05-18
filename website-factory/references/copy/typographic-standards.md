# Typographic Standards (Foundation)

Universal typographic rules that apply to every niche template's rendered copy.
Loaded by `tools/copy-lint.py` and enforced at Stage 10b QA.

Source: `research/_framework/web-design-research-2026-05.md`, tactic 6 + section
6 (Typography + spacing).

## 1. Quotes

- **Curly quotes** for everything. Open `"` close `"` for double; open `'`
  close `'` for single.
- Never `"` or `'` (the straight ASCII substitutes).
- Apostrophes use the same closing-single `'` glyph (`don't`, `it's`).

## 2. Dashes

- **En dash `–`** for number ranges and connections: `2010–2024`, `Mon–Fri`,
  `North–South`.
- **Em dash `,`** is **banned** in delivered copy across this stack. Replace
  with one of:
  - A period (split into two sentences)
  - A comma (when introducing a brief aside)
  - A colon (when introducing a list or elaboration)

## 3. Ellipsis

- The ellipsis glyph `…` (Unicode U+2026), not three periods `...`.
- Preferred only at the end of trailing thought. Don't pad mid-sentence.

## 4. Tabular numerals

Apply `font-variant-numeric: tabular-nums` (Tailwind: `tabular-nums`) to:

- Prices and currency values in pricing tables
- Statistics in trust strips and capacity numbers
- Dates and times
- Phone numbers in body copy (not nav, where size is small enough)
- Any aligned numeric column

This makes "1,250" and "9,847" align vertically, a craft signal premium
readers register without naming.

## 5. Spacing and rhythm

- Body line-height: **1.55–1.65** (tactic 4). The Tailwind utility
  `leading-body` (1.6) is the default.
- Headline line-height: **1.05–1.1** for display sizes (40px+). Use
  `leading-display` (1.05) or `leading-display-tight` (1.1).
- Letter-spacing: large headlines (40px+) tighten to `tracking-display`
  (-0.025em). Eyebrows tighten to uppercase 12-14px with
  `tracking-eyebrow` (+0.12em).
- Paragraph max-width: **65–72 characters** per line. Use
  `max-w-prose` (Tailwind extended to 68ch) or the `.prose-narrow` utility.

## 6. Smart quotes in generated copy

When the copy-deck agent generates copy, it produces curly quotes natively.
For copy authored in markdown that the build agent renders, the build step
runs a smart-quote pass:

- Pairs of double quotes → curly equivalent
- Pairs of single quotes → curly equivalent
- Single apostrophe within a word → closing-single

The pass is implemented in `tools/copy-lint.py` as a non-failing fixer.
Copy-lint can run in two modes:
- `--check` (default in CI): fails if straight quotes are present
- `--fix`: rewrites straight quotes to curly in-place

## 7. Pre-render smoke

Stage 10b SOP QA agent runs:

```bash
python3 tools/copy-lint.py --check clients/[Client Name]/Pipeline Data/copy/copy-deck.md
```

A failed check halts the QA gate. Re-run the copy-deck agent with the
specific finding, or run `--fix` and re-validate.
