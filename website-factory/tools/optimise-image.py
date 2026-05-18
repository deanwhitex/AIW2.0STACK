#!/usr/bin/env python3
"""
optimise-image.py

Convert an input image (JPEG/PNG/WebP/SVG) to an optimised WebP at a target
dimension cap with a quality setting. Used by Stage 10.1 (build-from-template)
to swap per-client images into the website template's public/ slots.

Quality-first defaults from Rule 4 in .claude/lessons/by-agent/09-build.md:
  - q=92 for hero, content-area backgrounds, blog covers, project tiles, badges
  - q=88 for owner / team portraits
SVG passes through unchanged (lossless vector). LANCZOS resampling on resize.
Never goes below q=80 — visible photos must look professional.

Usage:
    python3 tools/optimise-image.py <input> <output> [--max-width 1920] [--max-height 1080] [--quality 92]

    # Pass-through SVG
    python3 tools/optimise-image.py logo.svg public/logo.svg

    # Hero image at 1920x1080 max, q=92
    python3 tools/optimise-image.py hero.jpg public/hero-image.webp --max-width 1920 --max-height 1080

    # Mobile hero at 828x1200, q=92
    python3 tools/optimise-image.py hero.jpg public/hero-image-mobile.webp --max-width 828 --max-height 1200

    # Owner portrait at 640x800, q=88
    python3 tools/optimise-image.py owner.png public/owner.webp --max-width 640 --max-height 800 --quality 88
"""

from __future__ import annotations

import argparse
import shutil
import sys
from pathlib import Path

try:
    from PIL import Image
except ImportError:
    print("ERROR: Pillow not installed. Run: pip install Pillow", file=sys.stderr)
    sys.exit(1)


def is_svg(path: Path) -> bool:
    return path.suffix.lower() == ".svg"


def passthrough(input_path: Path, output_path: Path) -> int:
    """Copy file as-is. Used for SVG and any other file we shouldn't recompress."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(input_path, output_path)
    return output_path.stat().st_size


def fit_within(size: tuple[int, int], max_w: int | None, max_h: int | None) -> tuple[int, int]:
    """Scale (w, h) down so it fits inside max_w / max_h while preserving aspect ratio."""
    w, h = size
    if max_w and w > max_w:
        scale = max_w / w
        w = max_w
        h = round(h * scale)
    if max_h and h > max_h:
        scale = max_h / h
        h = max_h
        w = round(w * scale)
    return w, h


def optimise(
    input_path: Path,
    output_path: Path,
    max_width: int | None = None,
    max_height: int | None = None,
    quality: int = 92,
) -> int:
    if quality < 80:
        raise ValueError(f"quality {quality} is below the 80 floor (visible photos must look professional)")

    if is_svg(input_path):
        # SVG goes through unchanged. Output extension forced to .svg.
        if output_path.suffix.lower() != ".svg":
            output_path = output_path.with_suffix(".svg")
        return passthrough(input_path, output_path)

    img = Image.open(input_path)

    # Convert to RGB or RGBA depending on input mode. WebP supports both.
    if img.mode in ("P", "L"):
        img = img.convert("RGBA" if "transparency" in img.info else "RGB")
    elif img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGB")

    # Resize if larger than the cap.
    if max_width or max_height:
        new_size = fit_within(img.size, max_width, max_height)
        if new_size != img.size:
            img = img.resize(new_size, Image.Resampling.LANCZOS)

    # Force .webp extension on output.
    if output_path.suffix.lower() != ".webp":
        output_path = output_path.with_suffix(".webp")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(output_path, "WEBP", quality=quality, method=6)
    return output_path.stat().st_size


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Convert an image to an optimised WebP with quality-first defaults."
    )
    parser.add_argument("input", type=Path, help="Source image (JPEG, PNG, WebP, SVG)")
    parser.add_argument("output", type=Path, help="Target path (extension forced to .webp for raster, .svg for SVG)")
    parser.add_argument(
        "--max-width",
        type=int,
        default=None,
        help="Maximum width in pixels (preserves aspect ratio)",
    )
    parser.add_argument(
        "--max-height",
        type=int,
        default=None,
        help="Maximum height in pixels (preserves aspect ratio)",
    )
    parser.add_argument(
        "--quality",
        type=int,
        default=92,
        help="WebP quality 80-100 (default 92, never below 80)",
    )
    args = parser.parse_args()

    if not args.input.exists():
        print(f"ERROR: input not found: {args.input}", file=sys.stderr)
        return 1

    try:
        size = optimise(args.input, args.output, args.max_width, args.max_height, args.quality)
    except ValueError as exc:
        print(f"ERROR: {exc}", file=sys.stderr)
        return 1

    print(f"optimise-image: {args.input.name} -> {args.output.name} ({size:,} bytes)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
