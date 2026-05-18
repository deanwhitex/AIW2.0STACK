# Niche playbook contract: `copy-blocklist-additions.md`

Niche-specific additions to the universal AI-vocab blocklist at
`website-factory/references/copy/ai-vocab-blocklist.md`. `tools/copy-lint.py
--include-niche {slug}` loads these on top of the universal blocklist.

Optional file, when absent, only the universal blocklist applies.

---

## Format

Follow the same structure as the universal blocklist:

```markdown
# Niche-specific AI-vocab additions: {niche}

## Banned words (single tokens)

\`\`\`
{word}
{word}
\`\`\`

## Banned phrases (multi-word)

\`\`\`
{phrase}
{phrase}
\`\`\`
```

Module 2D parses fenced code blocks under `## Banned words` and `## Banned
phrases` headings.

## How to derive niche-specific bans

For each top-of-pool site, check copy for:
- Words / phrases that appear in low-scoring sites but never in top-of-pool
- Generic vocabulary the niche's authentic practitioners avoid
- Phrases that scream "AI wrote this" specifically for this niche

Common niche-specific bans (illustrative, derive yours from the pool):

**Hospitality:**
- "synergize the guest experience"
- "elevate your stay"
- "world-class amenities"
- "boutique" (often misused; reserve for truly small properties)
- "luxurious accommodations" (replace with specifics)

**E-commerce:**
- "shop our exclusive collection"
- "discover the difference"
- "elevate your wardrobe"
- "curated selection of"
- "unparalleled quality"

**Legal:**
- "navigate the complexities"
- "experienced legal counsel"
- "vigorous representation"
- "complex legal landscape"

**Healthcare:**
- "compassionate care"
- "patient-centered approach"
- "holistic well-being"
- "comprehensive treatment plans"

**Contractor:**
- "quality you can trust"
- "experienced professionals"
- "your trusted contractor"
- "industry-leading expertise"

## Quality bar

Niche-specific bans should each have:
- A clear plain-language substitute
- Evidence the niche's top-of-pool sites avoid it
- Optional note on why it fails for this niche

```markdown
# In comments above the fenced block:

These bans are derived from {N} top-of-pool sites that consistently use
plain-language alternatives. {site-slug} replaces "elevate your stay" with
"sleep in a room someone made for you"; {site-slug} replaces "world-class
amenities" with specific counts ("28 rooms, 4 dining options, 1 spa").
```

## Validation

`tools/copy-lint.py` parses this file's fenced blocks at load time and
appends the patterns to the universal list. Run:

```bash
python3 tools/copy-lint.py --check \
  --include-niche {slug} \
  clients/[Client Name]/Pipeline Data/copy/copy-deck.md
```

to verify the niche additions catch the intended patterns.
