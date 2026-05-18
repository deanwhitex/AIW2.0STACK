#!/usr/bin/env python3
"""
Derive per-client accent color stops from brand-dna.palette.accent.

Replaces hardcoded the website template defaults (#DFCA9A / #A07830 / #5C3A0D) with
luminance-aware light / mid / dark variants derived from the actual client
accent. This is what makes one client's gold visually distinct from another.

Usage:
    python3 tools/derive-accent-stops.py --client "Acme Roofing"
    python3 tools/derive-accent-stops.py --hex "#b8860b"          # one-shot
    python3 tools/derive-accent-stops.py --client "Acme Construction" --write

When --write is set, the script also patches brand-dna.json in place to
add palette.accent_light / accent_mid / accent_dark, plus brand-override-stops.css
under Pipeline Data/brand/ for inspection.

Math:
  - Convert hex → HSL
  - light = +18% L, slightly desaturated (-8% S)
  - mid   = -22% L, more saturated (+6% S)
  - dark  = -42% L, more saturated (+8% S)
  - Clamp L to [4, 96], S to [0, 100]
  - Convert back to hex
"""

import argparse
import colorsys
import json
import re
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

HEX_RE = re.compile(r"^#?([0-9A-Fa-f]{6})$")


def hex_to_rgb(hex_str: str) -> tuple[float, float, float]:
    m = HEX_RE.match(hex_str.strip())
    if not m:
        raise ValueError(f"invalid hex: {hex_str}")
    h = m.group(1)
    return (
        int(h[0:2], 16) / 255.0,
        int(h[2:4], 16) / 255.0,
        int(h[4:6], 16) / 255.0,
    )


def rgb_to_hex(r: float, g: float, b: float) -> str:
    return "#{:02X}{:02X}{:02X}".format(
        max(0, min(255, round(r * 255))),
        max(0, min(255, round(g * 255))),
        max(0, min(255, round(b * 255))),
    )


def shift_hsl(hex_str: str, dl_pct: float, ds_pct: float) -> str:
    r, g, b = hex_to_rgb(hex_str)
    h, l, s = colorsys.rgb_to_hls(r, g, b)
    new_l = max(0.04, min(0.96, l + dl_pct / 100))
    new_s = max(0.0, min(1.0, s + ds_pct / 100))
    nr, ng, nb = colorsys.hls_to_rgb(h, new_l, new_s)
    return rgb_to_hex(nr, ng, nb)


def derive_stops(accent_hex: str) -> dict:
    return {
        "accent": accent_hex.upper() if accent_hex.startswith("#") else f"#{accent_hex.upper()}",
        "accent_light": shift_hsl(accent_hex, +18, -8),
        "accent_mid": shift_hsl(accent_hex, -22, +6),
        "accent_dark": shift_hsl(accent_hex, -42, +8),
    }


def hex_to_rgb_triple_string(hex_str: str) -> str:
    r, g, b = hex_to_rgb(hex_str)
    return f"{round(r * 255)}, {round(g * 255)}, {round(b * 255)}"


def emit_css(stops: dict) -> str:
    lines = [
        ":root {",
        f"  --color-accent:        {stops['accent']};",
        f"  --color-accent-light:  {stops['accent_light']};",
        f"  --color-accent-mid:    {stops['accent_mid']};",
        f"  --color-accent-dark:   {stops['accent_dark']};",
        f"  --rgb-accent:          {hex_to_rgb_triple_string(stops['accent'])};",
        f"  --rgb-accent-mid:      {hex_to_rgb_triple_string(stops['accent_mid'])};",
        f"  --rgb-accent-dark:     {hex_to_rgb_triple_string(stops['accent_dark'])};",
        "}",
    ]
    return "\n".join(lines) + "\n"


def main():
    parser = argparse.ArgumentParser(description="Derive per-client accent stops")
    parser.add_argument("--client", help="Client folder name (reads brand-dna.json)")
    parser.add_argument("--hex", help="Direct hex input (one-shot, no client needed)")
    parser.add_argument("--write", action="store_true", help="Patch brand-dna.json + emit CSS file")
    args = parser.parse_args()

    if args.hex:
        stops = derive_stops(args.hex)
        print(json.dumps(stops, indent=2))
        print()
        print(emit_css(stops))
        return

    if not args.client:
        sys.exit("ERROR: provide --client or --hex")

    brand_dna_path = REPO_ROOT / "clients" / args.client / "Pipeline Data" / "brand" / "brand-dna.json"
    if not brand_dna_path.exists():
        sys.exit(f"ERROR: brand-dna.json not found at {brand_dna_path}")

    brand_dna = json.loads(brand_dna_path.read_text())
    palette = brand_dna.get("palette", {})
    accent = palette.get("accent")
    if not accent:
        sys.exit("ERROR: brand-dna.palette.accent missing")

    stops = derive_stops(accent)
    print(json.dumps(stops, indent=2))
    print()
    print(emit_css(stops))

    if args.write:
        # Patch brand-dna.json
        palette["accent"] = stops["accent"]
        palette["accent_light"] = stops["accent_light"]
        palette["accent_mid"] = stops["accent_mid"]
        palette["accent_dark"] = stops["accent_dark"]
        brand_dna["palette"] = palette
        brand_dna_path.write_text(json.dumps(brand_dna, indent=2))
        print(f"[written] {brand_dna_path}", file=sys.stderr)

        # Emit CSS preview file for inspection
        css_path = brand_dna_path.parent / "accent-stops.preview.css"
        css_path.write_text(emit_css(stops))
        print(f"[written] {css_path}", file=sys.stderr)


if __name__ == "__main__":
    main()
