# Platform logo assets

These three SVGs are the **multi-color exception** to the global rule that
every visual element in the design system uses one accent color.

## Why these are exceptions

DESIGN_EVOLUTION.md locks the design system to a single accent color per
client, with all icons rendered as thin-line monochrome Heroicons.

These three logos are exempt because they're **brand identifiers owned by
external parties** (Google, Meta, Better Business Bureau). Recoloring them
would:

1. Violate each platform's brand guidelines
2. Reduce trust signals (homeowners scan for the actual logos they recognize)
3. Make review pills look fake (a monochrome Google G doesn't read as Google)

## When these are used

- `ReviewPill.tsx` (Hero), three pills below H1 showing platform + rating
- `ReviewCard.tsx` (Reviews section), small platform badge above stars
- `Footer.tsx` trust row, small platform marks beside ratings

## When these are NOT used

These are the ONLY exceptions. Multi-color is otherwise forbidden:

- ❌ Multi-color manufacturer badges (HAAG, Owens Corning, etc.), these
  ship in monochrome variants from references/assets/badges/
- ❌ Multi-color brand mascots, replaced with monochrome silhouettes
- ❌ Multi-color iconography elsewhere on the site

The design-synthesis skill enforces this in Stage 7. The SOP QA agent
checks for violations in Stage 10.4b.

## Files

| File | Source | License |
|------|--------|---------|
| `google-logo.svg` | Google brand resources | Trademark of Google LLC |
| `facebook-logo.svg` | Meta brand resources | Trademark of Meta Platforms, Inc. |
| `bbb-logo.svg` | BBB accredited business mark | Trademark of Council of BBB |

These are stylized representations sized for use in trust-signal contexts
(review pills, badges). For attribution-grade usage (e.g. "Powered by
Google" placements), use the official assets from each platform's brand
center.
