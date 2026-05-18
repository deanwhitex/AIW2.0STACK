#!/usr/bin/env python3
"""
extract-niche-design-tokens.py

Reads the per-niche capture data Module 2D Phase 2 wrote to
`research/02-niche-research/{slug}/templates/raw/{site-slug}/` plus the
winner-pick file at `templates/pick.json`, and emits a structured
`niche-design-tokens.json` that the scaffolder consumes.

Inputs (per-site, written by Phase 2 Apify capture):
  - desktop.png, mobile.png         (full-page screenshots)
  - colors.json                     (top-N colors by pixel coverage)
  - fonts.json                      (Google Fonts + webfonts loaded)
  - css.json                        (computed styles excerpt)
  - dom.html                        (full DOM dump)

Inputs (winner pick, written by Phase 4):
  - templates/pick.json             (which site to use as the source for each
                                     of: heroFrom, sectionOrderFrom,
                                     typographyFrom, colorSystemFrom, etc.)

Output:
  research/02-niche-research/{slug}/niche-design-tokens.json

The output schema is intentionally lean. It carries only the values the
scaffolder needs to stamp tailwind.config.js + brand-dna.js, plus signals
the Phase 6 generation step uses to pick variants. Richer prose lives in
`09-template-spec.md` written by Phase 5a.

Usage:
  python3 tools/extract-niche-design-tokens.py --slug auto-detailing

  python3 tools/extract-niche-design-tokens.py --slug test \\
    --raw-dir /tmp/test-capture \\
    --pick /tmp/test-pick.json \\
    --out /tmp/test-tokens.json
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
STACK_ROOT = REPO_ROOT.parent


def _safe_json_load(path: Path) -> dict | list:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError:
        return {}


def _normalize_hex(value: str) -> str | None:
    """Return a `#rrggbb` lowercased string or None when the input is not a
    valid hex literal. Accepts `#rgb`, `#rrggbb`, `rgb(...)`, `rgba(...)`."""
    if not isinstance(value, str):
        return None
    v = value.strip().lower()
    if v.startswith("#"):
        if len(v) == 4:  # #rgb
            return "#" + "".join(c * 2 for c in v[1:])
        if len(v) == 7 and all(c in "0123456789abcdef" for c in v[1:]):
            return v
        return None
    if v.startswith("rgb"):
        # Best effort: extract the first three integer channels.
        inner = v.split("(", 1)[1].rsplit(")", 1)[0]
        parts = [p.strip() for p in inner.split(",")][:3]
        try:
            r, g, b = (int(p) for p in parts)
            return f"#{r:02x}{g:02x}{b:02x}"
        except Exception:
            return None
    return None


def _pick_palette(colors_data: list | dict) -> dict[str, str]:
    """Build a brand-dna palette block from a colors.json list of
    {color, count} or {color, weight} entries sorted by pixel coverage.
    Heuristic: darkest = primary, brightest non-grey = accent."""
    if isinstance(colors_data, dict):
        colors_data = colors_data.get("colors") or []
    if not isinstance(colors_data, list):
        return {}

    parsed: list[tuple[str, int, int, int]] = []
    for entry in colors_data:
        if not isinstance(entry, dict):
            continue
        hex_val = _normalize_hex(entry.get("color") or entry.get("hex") or "")
        if not hex_val:
            continue
        r = int(hex_val[1:3], 16)
        g = int(hex_val[3:5], 16)
        b = int(hex_val[5:7], 16)
        parsed.append((hex_val, r, g, b))

    if not parsed:
        return {}

    def luminance(rgb: tuple[int, int, int, int]) -> float:
        _, r, g, b = rgb
        return 0.2126 * r + 0.7152 * g + 0.0722 * b

    def saturation(rgb: tuple[int, int, int, int]) -> int:
        _, r, g, b = rgb
        return max(r, g, b) - min(r, g, b)

    # Primary = darkest with reasonable saturation (avoid near-black noise).
    primary_candidates = [c for c in parsed if luminance(c) < 80]
    primary = (sorted(primary_candidates, key=lambda c: saturation(c), reverse=True)[0]
               if primary_candidates else parsed[0])

    # Accent = brightest with strong saturation.
    accent_candidates = [c for c in parsed if saturation(c) > 60 and luminance(c) > 100]
    accent_candidates.sort(key=lambda c: (saturation(c), luminance(c)), reverse=True)
    accent = accent_candidates[0] if accent_candidates else parsed[-1]

    # Light + dark accent shades. Cheap HSL-free approximation: scale RGB.
    def shade(hex_val: str, factor: float) -> str:
        h = hex_val.lstrip("#")
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        return f"#{min(255, max(0, int(r * factor))):02x}{min(255, max(0, int(g * factor))):02x}{min(255, max(0, int(b * factor))):02x}"

    return {
        "primary": primary[0],
        "primary_dark": shade(primary[0], 0.75),
        "primary_slate": shade(primary[0], 1.20),
        "accent": accent[0],
        "accent_light": shade(accent[0], 1.20),
        "accent_dark": shade(accent[0], 0.80),
        "neutral": "#94a3b8",
        "neutral_dim": "#475569",
        "silver": "#cbd5e1",
        "ink": shade(primary[0], 0.85),
    }


def _pick_typography(fonts_data: list | dict) -> dict[str, str]:
    """Pick heading + body fonts. Heuristic: a serif or display font for
    heading, a sans-serif for body. fonts.json is typically a list of
    {family, weights} loaded by the site."""
    if isinstance(fonts_data, dict):
        fonts_data = fonts_data.get("fonts") or []
    if not isinstance(fonts_data, list):
        return {}

    serif_signals = ("playfair", "fraunces", "cormorant", "ibm plex serif", "lora", "merriweather", "spectral", "bodoni", "didot", "old standard", "newsreader")
    display_signals = ("oswald", "anton", "bebas", "abril", "playfair display", "alfa slab", "archivo black")
    sans_default = ("inter", "manrope", "dm sans", "work sans", "general sans", "outfit")

    heading: str | None = None
    body: str | None = None
    for f in fonts_data:
        if not isinstance(f, dict):
            continue
        family = (f.get("family") or "").strip()
        if not family:
            continue
        low = family.lower()
        if heading is None and any(s in low for s in serif_signals + display_signals):
            heading = family
        if body is None and any(s in low for s in sans_default):
            body = family

    # Fall back to the first two families if signals didn't match.
    families = [f.get("family") for f in fonts_data if isinstance(f, dict) and f.get("family")]
    heading = heading or (families[0] if families else "Inter")
    body = body or (families[1] if len(families) > 1 else heading)

    return {
        "heading": heading,
        "body": body,
        "headingFontUrl": f"{heading.replace(' ', '+')}:wght@400;500;600;700;800",
        "bodyFontUrl": f"{body.replace(' ', '+')}:wght@400;500;600;700",
    }


def _pick_motion(pick: dict) -> dict:
    """Cheap heuristic: 'energetic' for trade/service niches, 'restrained'
    elsewhere. The agent overrides via 09-template-spec.md when it has
    better signal."""
    notes = (pick.get("studentNotes") or "").lower()
    if any(k in notes for k in ("luxury", "boutique", "hospitality", "premium", "editorial")):
        return {"preset": "restrained", "stagger_ms": 90, "duration_ms": 600}
    return {"preset": "energetic", "stagger_ms": 50, "duration_ms": 400}


def _pick_theme_mode(pick: dict) -> str:
    """Default to 'light' unless the pick metadata clearly signals dark."""
    notes = (pick.get("studentNotes") or "").lower()
    if "dark" in notes or "moody" in notes:
        return "dark"
    return "light"


def _resolve_source_dir(raw_dir: Path, site_slug: str) -> Path:
    candidate = raw_dir / site_slug
    if candidate.exists():
        return candidate
    # Fall back to the first sub-dir if the slug doesn't match.
    for child in raw_dir.iterdir():
        if child.is_dir():
            return child
    return raw_dir


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract niche design tokens from Phase 2 capture data")
    parser.add_argument("--slug", required=True, help="Niche slug (e.g. auto-detailing)")
    parser.add_argument("--raw-dir", type=Path, default=None, help="Override the captures directory (default: research/02-niche-research/{slug}/templates/raw/)")
    parser.add_argument("--pick", type=Path, default=None, help="Override the pick.json path (default: research/02-niche-research/{slug}/templates/pick.json)")
    parser.add_argument("--out", type=Path, default=None, help="Override output path (default: research/02-niche-research/{slug}/niche-design-tokens.json)")
    args = parser.parse_args()

    research_root = STACK_ROOT / "research" / "02-niche-research" / args.slug
    raw_dir = args.raw_dir or (research_root / "templates" / "raw")
    pick_path = args.pick or (research_root / "templates" / "pick.json")
    out_path = args.out or (research_root / "niche-design-tokens.json")

    if not raw_dir.exists():
        sys.exit(f"ERROR: capture dir not found: {raw_dir}")

    pick = _safe_json_load(pick_path)
    if not pick:
        print(f"  WARN: pick.json missing or invalid; using first captured site as winner", file=sys.stderr)

    color_source_slug = (pick.get("components") or {}).get("colorSystemFrom") or pick.get("winner")
    typo_source_slug = (pick.get("components") or {}).get("typographyFrom") or pick.get("winner")

    # Fall back to the first sub-dir under raw_dir when the pick doesn't name a slug.
    color_dir = _resolve_source_dir(raw_dir, color_source_slug or "")
    typo_dir = _resolve_source_dir(raw_dir, typo_source_slug or "")

    print(f"=== Extracting niche design tokens for '{args.slug}' ===")
    print(f"  capture dir:   {raw_dir.relative_to(STACK_ROOT)}")
    print(f"  color source:  {color_dir.relative_to(STACK_ROOT)}")
    print(f"  typo source:   {typo_dir.relative_to(STACK_ROOT)}")

    colors_data = _safe_json_load(color_dir / "colors.json")
    fonts_data = _safe_json_load(typo_dir / "fonts.json")

    palette = _pick_palette(colors_data) if colors_data else {}
    typography = _pick_typography(fonts_data) if fonts_data else {}

    if not palette:
        print(f"  WARN: palette extraction returned empty; downstream scaffolder will leave palette sentinels in place", file=sys.stderr)
    if not typography:
        print(f"  WARN: typography extraction returned empty; downstream scaffolder will leave typography sentinels in place", file=sys.stderr)

    tokens = {
        "niche_slug": args.slug,
        "extractedAt": datetime.now(timezone.utc).isoformat(),
        "winner": pick.get("winner"),
        "componentSources": pick.get("components"),
        "palette": palette,
        "typography": typography,
        "motion": _pick_motion(pick),
        "theme_mode": _pick_theme_mode(pick),
        "shape_motif": (pick.get("components") or {}).get("shapeMotif") or "polygon",
        "sources": {
            "raw_dir": str(raw_dir.relative_to(STACK_ROOT)),
            "color_dir": str(color_dir.relative_to(STACK_ROOT)),
            "typo_dir": str(typo_dir.relative_to(STACK_ROOT)),
            "pick": str(pick_path.relative_to(STACK_ROOT)) if pick_path.exists() else None,
        },
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(json.dumps(tokens, indent=2))
    print(f"\nDONE -> {out_path.relative_to(STACK_ROOT)}")
    print(f"  palette keys: {sorted(palette.keys())}")
    print(f"  typography:   {typography.get('heading')} / {typography.get('body')}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
