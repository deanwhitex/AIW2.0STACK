#!/usr/bin/env python3
"""
Stage 10.2 Lighthouse LCP guard for website factory pipeline (SOP 14).

Runs Lighthouse mobile against the locally booted Vite dev server. If LCP
exceeds the target, downgrades the hero image quality progressively until
the budget is met or the retry cap is exhausted.

Usage:
    # Inside the client website folder, with `npm run dev` already running:
    python3 tools/check-lcp.py --client "Acme Roofing" --target 2000

    # Override port (default 5173):
    python3 tools/check-lcp.py --client "X" --port 3000

    # Custom retry count:
    python3 tools/check-lcp.py --client "X" --max-retries 3

Requires:
    - Node + npx (for Lighthouse)
    - Pillow (for image downgrade)
    - Dev server already running locally (the agent boots it)

Outputs:
    clients/[Client]/Pipeline Data/logs/lcp-report.json
    Possibly mutated: clients/[Client]/[Client] Website/public/hero-final.png
"""

import argparse
import json
import shutil
import subprocess
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

DEFAULT_TARGET_MS = 2000
DEFAULT_PORT = 5173
DEFAULT_MAX_RETRIES = 3
QUALITY_STEP = 12  # quality drop per retry, starting from 90


def run_lighthouse(url: str) -> float:
    """Run Lighthouse mobile, return LCP in ms. Raises on error."""
    out_path = Path("/tmp") / f"lh-{int(time.time())}.json"
    cmd = [
        "npx", "--yes", "lighthouse@latest",
        url,
        "--only-categories=performance",
        "--form-factor=mobile",
        "--throttling-method=simulate",
        "--output=json",
        f"--output-path={out_path}",
        "--quiet",
        "--chrome-flags=--headless --no-sandbox",
    ]
    print(f"[lh] running against {url} (this takes ~30s)", file=sys.stderr)
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    if result.returncode != 0:
        raise RuntimeError(f"Lighthouse exit {result.returncode}: {result.stderr[-400:]}")
    data = json.loads(out_path.read_text())
    lcp = float(data["audits"]["largest-contentful-paint"]["numericValue"])
    out_path.unlink(missing_ok=True)
    return lcp


def downgrade_hero(client: str, quality: int) -> bool:
    """Re-encode hero-final.png at lower quality. Returns True if changed."""
    try:
        from PIL import Image
    except ImportError:
        sys.exit("ERROR: install pillow (pip install pillow)")

    candidates = [
        REPO_ROOT / "clients" / client / f"{client} Website" / "public" / "hero-final.png",
        REPO_ROOT / "clients" / client / f"{client} Website" / "public" / "hero-final.jpg",
    ]
    src = next((p for p in candidates if p.exists()), None)
    if not src:
        print(f"[warn] no hero file at expected paths", file=sys.stderr)
        return False

    img = Image.open(src).convert("RGB")
    backup = src.with_suffix(src.suffix + ".original")
    if not backup.exists():
        shutil.copy(src, backup)

    out = src.with_suffix(".jpg")
    img.save(out, format="JPEG", quality=quality, optimize=True, progressive=True)
    if out != src:
        src.unlink(missing_ok=True)  # remove the .png since we now have .jpg
    print(f"[downgrade] hero re-saved at quality={quality} → {out.name}", file=sys.stderr)
    return True


def main():
    parser = argparse.ArgumentParser(description="Lighthouse LCP guard")
    parser.add_argument("--client", required=True)
    parser.add_argument("--port", type=int, default=DEFAULT_PORT)
    parser.add_argument("--target", type=int, default=DEFAULT_TARGET_MS, help="LCP budget in ms")
    parser.add_argument("--max-retries", type=int, default=DEFAULT_MAX_RETRIES)
    args = parser.parse_args()

    url = f"http://localhost:{args.port}"
    log_dir = REPO_ROOT / "clients" / args.client / "Pipeline Data" / "logs"
    log_dir.mkdir(parents=True, exist_ok=True)

    history = []
    quality = 90
    for attempt in range(1, args.max_retries + 1):
        try:
            lcp = run_lighthouse(url)
        except Exception as e:
            history.append({"attempt": attempt, "error": str(e)})
            print(f"[error] {e}", file=sys.stderr)
            break
        history.append({"attempt": attempt, "lcp_ms": round(lcp, 0), "quality": quality})
        print(f"[lh] attempt {attempt}: LCP={lcp:.0f}ms (target {args.target}ms)", file=sys.stderr)

        if lcp <= args.target:
            print(f"[pass] LCP {lcp:.0f}ms within budget {args.target}ms", file=sys.stderr)
            (log_dir / "lcp-report.json").write_text(json.dumps({"final": "pass", "history": history}, indent=2))
            return

        if attempt < args.max_retries:
            quality -= QUALITY_STEP
            print(f"[retry] downgrading hero quality to {quality} and re-checking", file=sys.stderr)
            downgrade_hero(args.client, quality)

    print(f"[fail] LCP still {lcp:.0f}ms after {args.max_retries} attempts (budget {args.target}ms)", file=sys.stderr)
    (log_dir / "lcp-report.json").write_text(json.dumps({"final": "fail_over_budget", "history": history}, indent=2))
    sys.exit(1)


if __name__ == "__main__":
    main()
