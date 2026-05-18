#!/usr/bin/env python3
"""
clean-transparent-jpeg.py

Strip a baked-in transparency-checker pattern from a JPEG (or opaque PNG)
and write a real transparent PNG. Trust badges sometimes arrive with the
Photoshop grey/white checker squares saved as opaque pixels because the
source asset was a transparent PNG flattened to JPEG. Without this cleanup,
the checker shows through against any wrapper background (Rule 47).

Algorithm: a pixel is treated as checker fill when
  - it is near-grayscale (max channel - min channel <= rgb-tolerance), AND
  - it is bright (R >= threshold)
Matched pixels get alpha=0; everything else is preserved.

Usage:
  python3 tools/clean-transparent-jpeg.py <input> <output>
                                          [--threshold 195]
                                          [--rgb-tolerance 8]

Example:
  python3 tools/clean-transparent-jpeg.py \
      "clients/Acme Construction/Acme Construction Assets/badges/logo-with-bg.jpg" \
      "clients/Acme Construction/Acme Construction Website/public/badges/logo-clean.png"
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("ERROR: Pillow not installed. Run: pip install Pillow", file=sys.stderr)
    sys.exit(1)


def clean(
    input_path: Path,
    output_path: Path,
    threshold: int = 195,
    rgb_tolerance: int = 8,
) -> int:
    img = Image.open(input_path).convert("RGBA")
    pixels = img.load()
    if pixels is None:
        raise RuntimeError(f"Could not load pixels from {input_path}")
    width, height = img.size
    cleaned = 0
    for y in range(height):
        for x in range(width):
            r, g, b, a = pixels[x, y]
            if a == 0:
                continue
            if (max(r, g, b) - min(r, g, b)) <= rgb_tolerance and r >= threshold:
                pixels[x, y] = (r, g, b, 0)
                cleaned += 1
    output_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(output_path, "PNG")
    return cleaned


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Strip Photoshop transparency-checker pattern from an opaque JPEG/PNG."
    )
    parser.add_argument("input", type=Path, help="Path to source JPEG/PNG with baked checker")
    parser.add_argument("output", type=Path, help="Path to write the cleaned transparent PNG")
    parser.add_argument(
        "--threshold",
        type=int,
        default=195,
        help="Minimum brightness (0-255) for a pixel to be treated as checker fill (default 195)",
    )
    parser.add_argument(
        "--rgb-tolerance",
        type=int,
        default=8,
        help="Max channel spread for near-grayscale detection (default 8)",
    )
    args = parser.parse_args()
    if not args.input.exists():
        print(f"ERROR: input not found: {args.input}", file=sys.stderr)
        return 1
    cleaned = clean(
        args.input,
        args.output,
        threshold=args.threshold,
        rgb_tolerance=args.rgb_tolerance,
    )
    print(f"Cleaned {cleaned} checker pixels: {args.input.name} -> {args.output.name}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
