#!/usr/bin/env python3
"""
qualify-photos.py — Stage 4 photo qualification step (Vision-based).

Looks at every photo harvested for a client and judges:
  - category: project | team | owner | marketing | logo | skip
  - quality_score: 1-10 (composition, resolution, professional appeal)
  - keep: true|false
  - reason: one-line justification

Reads:
  clients/[X]/[X] Assets/photos/projects/*.{jpg,png,webp}
  clients/[X]/[X] Assets/photos/team/*
  clients/[X]/[X] Assets/founder-photos/*

Writes:
  clients/[X]/[X] Assets/photos/qualification.json — full verdict per file
  clients/[X]/[X] Assets/photos/_skipped/ — photos auto-rejected (with --apply)

Optionally MOVES (with --apply):
  - Bad photos → photos/_skipped/
  - Misclassified team photos in projects/ → team/
  - Misclassified owner photos in projects/team/ → founder-photos/

Usage:
    python3 tools/qualify-photos.py --client "Acme Roofing & Exteriors"
    python3 tools/qualify-photos.py --client "Acme Roofing & Exteriors" --apply
    python3 tools/qualify-photos.py --client "Acme Roofing & Exteriors" --no-vision  # rule-only fallback

Cost (Claude Sonnet Vision, ~5KB image): ~$0.003 per photo. Typical client
with 8 photos = $0.024. Cached per file md5 in qualification.json.

Env vars (loaded from .env at repo root):
    ANTHROPIC_API_KEY — required for Vision; --no-vision falls back to filename heuristics

Dependencies: anthropic SDK + Pillow.
"""

from __future__ import annotations

import argparse
import base64
import hashlib
import io
import json
import os
import shutil
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = REPO_ROOT / ".env"

VISION_MODEL = "claude-sonnet-4-6"
MAX_DIM = 1568  # Claude Vision works well below ~2K px; resize larger images
JPEG_QUALITY = 80


def load_env() -> None:
    """Best-effort .env load that overrides empty shell vars."""
    if not ENV_PATH.exists():
        return
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        if not os.environ.get(k):
            os.environ[k] = v


def md5_file(path: Path) -> str:
    h = hashlib.md5()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def resize_for_vision(path: Path) -> bytes:
    """Open image, resize so longest side <= MAX_DIM, return JPEG bytes."""
    from PIL import Image
    img = Image.open(path).convert("RGB")
    if max(img.size) > MAX_DIM:
        img.thumbnail((MAX_DIM, MAX_DIM), Image.LANCZOS)
    buf = io.BytesIO()
    img.save(buf, "JPEG", quality=JPEG_QUALITY, optimize=True)
    return buf.getvalue()


def filename_heuristic(filename: str) -> dict[str, Any]:
    """Rule-only fallback when Vision is unavailable."""
    f = filename.lower()
    if any(k in f for k in ["logo", "icon", "watermark", "badge"]):
        return {"category": "logo", "quality_score": 2, "keep": False, "reason": "Filename suggests logo/branding asset, not project work."}
    if any(k in f for k in ["owner", "founder", "ceo"]):
        return {"category": "owner", "quality_score": 7, "keep": True, "reason": "Filename suggests owner/founder portrait."}
    if any(k in f for k in ["team", "crew", "staff", "group"]):
        return {"category": "team", "quality_score": 7, "keep": True, "reason": "Filename suggests team photo."}
    if any(k in f for k in ["event", "show", "booth", "tent", "tradeshow"]):
        return {"category": "marketing", "quality_score": 4, "keep": False, "reason": "Filename suggests marketing/event photo, not a project."}
    return {"category": "project", "quality_score": 6, "keep": True, "reason": "Filename neutral, default category project."}


def qualify_with_vision(client, image_bytes: bytes, filename: str, hint: str) -> dict[str, Any]:
    """Send image + structured prompt to Claude Vision; return verdict dict."""
    prompt = (
        f"You're qualifying a photo from a roofing contractor's image library for use on their new website.\n"
        f"Source folder hint: {hint}.\n"
        f"Filename: {filename}\n\n"
        "Categorize the photo and judge whether it's worth using on the public site. "
        "Reply ONLY with a strict JSON object (no markdown, no commentary) shaped:\n"
        "{\n"
        '  "category": "project" | "team" | "owner" | "marketing" | "logo" | "skip",\n'
        '  "quality_score": 1-10 (10 = magazine-quality professional, 1 = unusable),\n'
        '  "keep": true | false,\n'
        '  "reason": "one short sentence in plain English"\n'
        "}\n\n"
        "Categories explained:\n"
        "  - project: a finished or in-progress roof / exterior installation, suitable for a project gallery.\n"
        "  - team: multiple crew members, work-attire group shots.\n"
        "  - owner: a single owner / founder portrait suitable for an About / Founder section.\n"
        "  - marketing: tradeshow booths, brand banners, promotional shots (NOT real work).\n"
        "  - logo: a brand logo, icon, watermark, or graphic mark (NOT a photograph).\n"
        "  - skip: low quality, off-brand, unrelated, or otherwise not usable.\n\n"
        "Set keep=false for: logo files, marketing/event shots, blurry / low-resolution / pixelated photos, "
        "photos showing damage that's not labeled as in-progress, anything that doesn't help sell the brand."
    )

    img_b64 = base64.standard_b64encode(image_bytes).decode("ascii")
    msg = client.messages.create(
        model=VISION_MODEL,
        max_tokens=400,
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "image", "source": {"type": "base64", "media_type": "image/jpeg", "data": img_b64}},
                    {"type": "text", "text": prompt},
                ],
            }
        ],
    )
    text = msg.content[0].text if msg.content else ""
    text = text.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        return {"category": "skip", "quality_score": 0, "keep": False, "reason": f"Vision returned non-JSON: {text[:80]!r}"}


def collect_photos(client_root: Path) -> list[tuple[Path, str]]:
    """Return [(path, source_folder_hint)] for every image in the relevant folders."""
    out = []
    base = client_root / f"{client_root.name} Assets"
    folders = [
        (base / "photos" / "projects", "projects pool — homeowner-facing finished/in-progress roof + exterior installations"),
        (base / "photos" / "team", "team pool — group shots of the crew"),
        (base / "founder-photos", "founder pool — single owner portrait"),
        (base / "photos", "general photos folder"),
    ]
    for folder, hint in folders:
        if not folder.exists():
            continue
        for ext in ("*.jpg", "*.jpeg", "*.png", "*.webp"):
            for p in sorted(folder.glob(ext)):
                # Skip files in subfolders (already covered above)
                if p.parent != folder:
                    continue
                out.append((p, hint))
    return out


def main() -> int:
    parser = argparse.ArgumentParser(description="Qualify per-client harvested photos via Claude Vision.")
    parser.add_argument("--client", required=True)
    parser.add_argument("--apply", action="store_true", help="Move bad photos into _skipped/, auto-rehome misclassified ones")
    parser.add_argument("--no-vision", action="store_true", help="Skip Claude Vision; use filename heuristics only")
    parser.add_argument("--force", action="store_true", help="Re-qualify even if cached verdict exists")
    args = parser.parse_args()

    load_env()

    client_root = REPO_ROOT / "clients" / args.client
    if not client_root.exists():
        print(f"ERROR: client folder not found: {client_root}", file=sys.stderr)
        return 1

    photos = collect_photos(client_root)
    if not photos:
        print(f"  no photos found under {client_root}/{args.client} Assets/")
        return 0

    print(f"=== Qualifying {len(photos)} photos for '{args.client}' ===")

    # Cache file
    cache_path = client_root / f"{args.client} Assets" / "photos" / "qualification.json"
    cache: dict[str, Any] = {}
    if cache_path.exists() and not args.force:
        try:
            cache = json.loads(cache_path.read_text()).get("by_md5", {})
        except json.JSONDecodeError:
            cache = {}

    # Optional Vision client
    vision_client = None
    if not args.no_vision:
        api_key = os.environ.get("ANTHROPIC_API_KEY")
        if not api_key:
            print("  WARN: ANTHROPIC_API_KEY not set; falling back to filename heuristics", file=sys.stderr)
        else:
            try:
                import anthropic
                vision_client = anthropic.Anthropic(api_key=api_key)
            except ImportError:
                print("  WARN: anthropic SDK not installed; falling back to heuristics", file=sys.stderr)

    verdicts: list[dict[str, Any]] = []
    by_md5: dict[str, dict[str, Any]] = {}
    cost_estimate = 0.0

    for path, hint in photos:
        md5 = md5_file(path)
        rel = str(path.relative_to(client_root))
        if md5 in cache:
            verdict = cache[md5]
            print(f"  ✓ cached:  {rel}  → {verdict.get('category')}  q={verdict.get('quality_score')}  keep={verdict.get('keep')}")
        elif vision_client:
            try:
                img_bytes = resize_for_vision(path)
                verdict = qualify_with_vision(vision_client, img_bytes, path.name, hint)
                cost_estimate += 0.003
                print(f"  ✓ vision:  {rel}  → {verdict.get('category')}  q={verdict.get('quality_score')}  keep={verdict.get('keep')}  ({verdict.get('reason', '')[:60]})")
            except Exception as e:
                print(f"  ✗ vision FAILED for {rel}: {e}", file=sys.stderr)
                verdict = filename_heuristic(path.name)
                verdict["reason"] = f"Vision error, filename fallback: {verdict['reason']}"
        else:
            verdict = filename_heuristic(path.name)
            print(f"  ✓ filename:  {rel}  → {verdict.get('category')}  q={verdict.get('quality_score')}  keep={verdict.get('keep')}")

        verdict["path"] = rel
        verdict["filename"] = path.name
        verdict["md5"] = md5
        verdicts.append(verdict)
        by_md5[md5] = verdict

    # Write cache + report
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps({
        "_meta": {
            "client": args.client,
            "vision_used": vision_client is not None,
            "vision_cost_estimate_usd": round(cost_estimate, 4),
            "count": len(verdicts),
            "kept": sum(1 for v in verdicts if v.get("keep")),
            "skipped": sum(1 for v in verdicts if not v.get("keep")),
        },
        "verdicts": verdicts,
        "by_md5": by_md5,
    }, indent=2))
    print(f"\n  wrote {cache_path}")
    print(f"  estimated cost: ${cost_estimate:.4f}")

    # --apply: move bad photos to _skipped/, misclassified to correct folders
    if args.apply:
        base = client_root / f"{args.client} Assets"
        skipped_dir = base / "photos" / "_skipped"
        skipped_dir.mkdir(parents=True, exist_ok=True)
        moves = 0
        for v in verdicts:
            src = client_root / v["path"]
            if not src.exists():
                continue
            target = None
            if not v.get("keep"):
                target = skipped_dir / v["filename"]
            else:
                cat = v.get("category")
                if cat == "team" and "/team/" not in str(src):
                    target = base / "photos" / "team" / v["filename"]
                elif cat == "owner" and "/founder-photos/" not in str(src):
                    target = base / "founder-photos" / v["filename"]
                elif cat == "project" and "/projects/" not in str(src):
                    target = base / "photos" / "projects" / v["filename"]
            if target and target.parent != src.parent:
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(src), str(target))
                print(f"  → moved {src.name}: {src.parent.name} → {target.parent.name}")
                moves += 1
        print(f"\n  applied {moves} moves")

    return 0


if __name__ == "__main__":
    sys.exit(main())
