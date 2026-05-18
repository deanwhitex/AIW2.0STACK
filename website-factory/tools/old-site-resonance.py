#!/usr/bin/env python3
"""
old-site-resonance.py — Stage 7.5 (template-approach branch)

Visual + content analysis of the client's existing website + GBP/Facebook
presence. Enriches brand-dna with signals that aren't visible in the logo
alone:

- Dominant colors observed on the live site (Pillow color quantization)
- Computed heading + body fonts (Playwright page.evaluate)
- Hero photo style hint (largest above-the-fold image dimensions + treatment)
- Section vocabulary (h1/h2 text + landmark roles)
- Apify GBP scrape (hours, rating, review count, photos, posts)
- Apify Facebook scrape (page intro, recent posts)
- Optional Claude Vision API call: send the desktop screenshot + extracted
  signals, request a voice description, photo style note, and
  theme_mode_recommendation (light | dark)

Output: clients/[X]/Pipeline Data/brand-resonance/resonance.json

Stage 7 brand-dna-agent reads `theme_mode_recommendation` to set
`brandDNA.theme_mode`. Defaults to 'light' if Stage 7.5 was skipped or the
recommendation is missing.

Graceful degradation: if no old website URL is in intake, write
`resonance.json` with `skipped: true` and exit 0. Downstream stages handle
the skip.

Usage:
    python3 tools/old-site-resonance.py --client "Acme Roofing"
    python3 tools/old-site-resonance.py --client "Acme Roofing" --no-vision
    python3 tools/old-site-resonance.py --client "Acme Roofing" --no-apify

Env vars (read from .env at repo root, none required for graceful skip):
    APIFY_API_TOKEN   — for Apify scrapers (optional)
    ANTHROPIC_API_KEY — for Claude Vision (optional)
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
APIFY_TOOL = REPO_ROOT / "tools" / "apify-scrape.py"
ENV_PATH = REPO_ROOT / ".env"


def load_env() -> None:
    """Best-effort .env load (no python-dotenv dep). Overrides empty shell vars
    so an empty ANTHROPIC_API_KEY='' in the shell doesn't shadow the .env value."""
    if not ENV_PATH.exists():
        return
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        k = k.strip()
        v = v.strip().strip('"').strip("'")
        # Override if shell value is empty/missing; otherwise respect shell precedence
        if not os.environ.get(k):
            os.environ[k] = v


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def write_json(path: Path, data: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False))


def out_path(client_name: str) -> Path:
    return REPO_ROOT / "clients" / client_name / "Pipeline Data" / "brand-resonance" / "resonance.json"


def write_skipped(client_name: str, reason: str) -> int:
    write_json(out_path(client_name), {
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "skipped": True,
        "reason": reason,
    })
    print(f"resonance.json written (skipped: {reason})")
    return 0


# --- Apify wrappers ------------------------------------------------------


def run_apify_actor(client_name: str, actor: str, **kwargs: str) -> dict[str, Any] | None:
    """Invoke tools/apify-scrape.py for one actor; return parsed JSON or None on failure."""
    out_dir = REPO_ROOT / "clients" / client_name / "Pipeline Data" / "brand-resonance" / ".apify"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_file = out_dir / f"{actor}.json"
    cmd = ["python3", str(APIFY_TOOL), "--client", client_name, "--actor", actor, "--out", str(out_file)]
    for k, v in kwargs.items():
        cmd += [f"--{k.replace('_', '-')}", v]
    try:
        subprocess.run(cmd, check=True, text=True)
    except subprocess.CalledProcessError as exc:
        print(f"  apify {actor} failed: {exc}", file=sys.stderr)
        return None
    return read_json(out_file)


# --- Playwright analysis -------------------------------------------------


def playwright_analysis(url: str, screenshot_dir: Path) -> dict[str, Any]:
    """Headless Chromium: full-page screenshots + computed font + DOM vocabulary."""
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        print("  playwright not installed; skipping visual analysis", file=sys.stderr)
        return {"skipped": True, "reason": "playwright not installed"}

    screenshot_dir.mkdir(parents=True, exist_ok=True)
    desktop_png = screenshot_dir / "old-site-desktop.png"
    mobile_png = screenshot_dir / "old-site-mobile.png"

    result: dict[str, Any] = {"url": url}

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        try:
            # Desktop pass
            ctx = browser.new_context(viewport={"width": 1440, "height": 900})
            page = ctx.new_page()
            try:
                page.goto(url, timeout=30000, wait_until="networkidle")
            except Exception as e:
                print(f"  desktop nav error: {e}", file=sys.stderr)
            page.screenshot(path=str(desktop_png), full_page=True)
            try:
                fonts = page.evaluate(
                    """() => {
                        const body = document.body && getComputedStyle(document.body).fontFamily || '';
                        const h1 = document.querySelector('h1');
                        const heading = h1 ? getComputedStyle(h1).fontFamily : body;
                        return { body, heading };
                    }"""
                )
                result["fonts"] = fonts
            except Exception as e:
                print(f"  font detection error: {e}", file=sys.stderr)
            try:
                vocab = page.evaluate(
                    """() => {
                        const headings = [...document.querySelectorAll('h1, h2')].map(h => (h.textContent || '').trim()).filter(Boolean).slice(0, 30);
                        const sections = [...document.querySelectorAll('section, [role=main], main, header, footer')].map(el => el.id || el.getAttribute('aria-label') || el.tagName.toLowerCase()).filter(Boolean).slice(0, 20);
                        return { headings, sections };
                    }"""
                )
                result["vocabulary"] = vocab
            except Exception as e:
                print(f"  vocabulary error: {e}", file=sys.stderr)
            try:
                hero = page.evaluate(
                    """() => {
                        const imgs = [...document.images].map(i => ({ w: i.naturalWidth || i.width, h: i.naturalHeight || i.height, src: i.currentSrc || i.src, top: i.getBoundingClientRect().top })).filter(o => o.top < 800).sort((a, b) => (b.w * b.h) - (a.w * a.h));
                        return imgs[0] || null;
                    }"""
                )
                if hero:
                    result["hero_style"] = {
                        "src": hero.get("src"),
                        "width": hero.get("w"),
                        "height": hero.get("h"),
                        "aspect_ratio": round(hero["w"] / hero["h"], 2) if hero.get("w") and hero.get("h") else None,
                    }
            except Exception as e:
                print(f"  hero detection error: {e}", file=sys.stderr)
            ctx.close()

            # Mobile pass (just screenshot, no extra analysis)
            ctx_m = browser.new_context(viewport={"width": 375, "height": 812})
            page_m = ctx_m.new_page()
            try:
                page_m.goto(url, timeout=30000, wait_until="networkidle")
                page_m.screenshot(path=str(mobile_png), full_page=True)
            except Exception as e:
                print(f"  mobile nav error: {e}", file=sys.stderr)
            ctx_m.close()
        finally:
            browser.close()

    if desktop_png.exists():
        result["screenshot_desktop"] = str(desktop_png.relative_to(REPO_ROOT))
        result["dominant_colors"] = quantize_colors(desktop_png)
    if mobile_png.exists():
        result["screenshot_mobile"] = str(mobile_png.relative_to(REPO_ROOT))
    return result


def quantize_colors(image_path: Path, top_n: int = 8) -> list[dict[str, Any]]:
    try:
        from PIL import Image
    except ImportError:
        return []
    img = Image.open(image_path).convert("RGB")
    # Downsample for speed
    img.thumbnail((600, 600))
    pixels = img.getdata()
    counter = Counter(pixels)
    total = sum(counter.values())
    top = counter.most_common(top_n)
    out = []
    for (r, g, b), count in top:
        out.append({
            "hex": f"#{r:02X}{g:02X}{b:02X}",
            "rgb": [r, g, b],
            "weight": round(count / total, 4),
        })
    return out


# --- Claude Vision -------------------------------------------------------


def claude_vision_brief(screenshot_path: Path, signals: dict[str, Any]) -> dict[str, Any] | None:
    """Send the desktop screenshot + extracted signals to Claude, get back voice + photo style + theme_mode_recommendation."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        print("  ANTHROPIC_API_KEY not set; skipping Claude Vision", file=sys.stderr)
        return None
    try:
        import anthropic  # type: ignore
    except ImportError:
        print("  anthropic SDK not installed (pip install anthropic); skipping Claude Vision", file=sys.stderr)
        return None
    if not screenshot_path.exists():
        return None

    import base64
    img_b64 = base64.standard_b64encode(screenshot_path.read_bytes()).decode("ascii")

    prompt = (
        "You're analysing a roofing contractor's existing website for brand resonance signals.\n\n"
        "Extracted signals from the page:\n"
        f"```json\n{json.dumps(signals, indent=2)[:3000]}\n```\n\n"
        "Please reply with STRICT JSON (no markdown fences) shaped like this:\n"
        "{\n"
        '  "voice_description": "<one paragraph describing the brand voice tone, register, and personality based on what you see>",\n'
        '  "photo_style_note": "<one sentence describing the dominant photo treatment: warm/clean/cinematic/utility/etc.>",\n'
        '  "theme_mode_recommendation": "light" | "dark"\n'
        "}\n\n"
        "Base the theme_mode_recommendation on the actual lightness of the site you can see. "
        "Light if most surfaces are white / cream / pale. Dark if most surfaces are navy / black / deep tones."
    )

    client = anthropic.Anthropic(api_key=api_key)
    try:
        msg = client.messages.create(
            model="claude-sonnet-4-6",
            max_tokens=600,
            messages=[
                {
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {"type": "base64", "media_type": "image/png", "data": img_b64}},
                        {"type": "text", "text": prompt},
                    ],
                }
            ],
        )
    except Exception as e:
        print(f"  Claude Vision API error: {e}", file=sys.stderr)
        return None

    text = msg.content[0].text if msg.content else ""
    # Trim any accidental markdown fences
    text = text.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        print(f"  Claude returned non-JSON: {text[:200]!r}", file=sys.stderr)
        return None


# --- Main ----------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description="Stage 7.5: brand resonance from old website + GBP + Facebook + Claude Vision.")
    parser.add_argument("--client", required=True)
    parser.add_argument("--no-apify", action="store_true", help="Skip Apify scrapers")
    parser.add_argument("--no-vision", action="store_true", help="Skip Claude Vision call")
    parser.add_argument("--url-override", help="Use this URL instead of intake-form.json's website")
    args = parser.parse_args()

    load_env()
    paths = {
        "base": REPO_ROOT / "clients" / args.client,
        "intake": REPO_ROOT / "clients" / args.client / "Pipeline Data" / "intake" / "intake-form.json",
        "screenshot_dir": REPO_ROOT / "clients" / args.client / "Pipeline Data" / "brand-resonance" / "screenshots",
    }

    if not paths["base"].exists():
        print(f"ERROR: client folder not found: {paths['base']}", file=sys.stderr)
        return 1

    intake = read_json(paths["intake"])

    # Resolve old-site URL — accept multiple intake-form schemas
    url = (
        args.url_override
        or intake.get("business", {}).get("website")
        or intake.get("website")
        or intake.get("websiteUrl")  # canonical Stage 1 schema (template-approach)
    )
    if not url:
        return write_skipped(args.client, "no website URL in intake-form.json")

    print(f"=== Stage 7.5 brand resonance for '{args.client}' ===")
    print(f"  url: {url}")

    resonance: dict[str, Any] = {
        "captured_at": datetime.now(timezone.utc).isoformat(),
        "client": args.client,
        "url": url,
        "skipped": False,
    }

    # 1. Apify scrapes (parallel-ish — sequential here since each calls apify-scrape.py once)
    if not args.no_apify and os.environ.get("APIFY_API_TOKEN"):
        print("\n[1/3] Apify scrapers")
        gbp_query = f"{intake.get('business', {}).get('legal_name', args.client)} {intake.get('business', {}).get('city', '')} {intake.get('business', {}).get('state', '')}".strip()
        if gbp_query:
            print(f"  google-places: {gbp_query}")
            gbp = run_apify_actor(args.client, "google-places", query=gbp_query)
            if gbp:
                resonance["apify_gbp"] = gbp
        fb_url = intake.get("social", {}).get("facebook")
        if fb_url:
            print(f"  facebook: {fb_url}")
            fb = run_apify_actor(args.client, "facebook", pages=fb_url)
            if fb:
                resonance["apify_facebook"] = fb
        print(f"  website: {url}")
        site = run_apify_actor(args.client, "website", urls=url)
        if site:
            resonance["apify_website"] = site
    else:
        print("\n[1/3] Apify skipped (no token or --no-apify)")

    # 2. Playwright screenshots + DOM analysis
    print("\n[2/3] Playwright analysis")
    visual = playwright_analysis(url, paths["screenshot_dir"])
    resonance["visual"] = visual

    # 3. Claude Vision brief
    desktop_png = paths["screenshot_dir"] / "old-site-desktop.png"
    if not args.no_vision:
        print("\n[3/3] Claude Vision brief")
        signals = {
            "url": url,
            "fonts": visual.get("fonts"),
            "vocabulary": visual.get("vocabulary"),
            "hero_style": visual.get("hero_style"),
            "dominant_colors": visual.get("dominant_colors"),
            "gbp_rating": resonance.get("apify_gbp", {}).get("rating") if "apify_gbp" in resonance else None,
            "gbp_review_count": resonance.get("apify_gbp", {}).get("reviewsCount") if "apify_gbp" in resonance else None,
        }
        brief = claude_vision_brief(desktop_png, signals)
        if brief:
            resonance.update({
                "voice_description": brief.get("voice_description"),
                "photo_style_note": brief.get("photo_style_note"),
                "theme_mode_recommendation": brief.get("theme_mode_recommendation"),
            })
    else:
        print("\n[3/3] Claude Vision skipped (--no-vision)")

    # Default theme_mode_recommendation if Claude didn't run: derive from dominant colors
    if "theme_mode_recommendation" not in resonance:
        colors = visual.get("dominant_colors", [])
        if colors:
            top_color = colors[0]
            r, g, b = top_color["rgb"]
            avg = (r + g + b) / 3
            resonance["theme_mode_recommendation"] = "dark" if avg < 128 else "light"
        else:
            resonance["theme_mode_recommendation"] = "light"

    write_json(out_path(args.client), resonance)
    print(f"\nresonance.json written: {out_path(args.client)}")

    # Update pipeline state
    state_path = REPO_ROOT / "clients" / args.client / "Pipeline Data" / "logs" / "pipeline-state.json"
    state = read_json(state_path)
    state["stage_7_5"] = "complete"
    state["stage_7_5_completed_at"] = datetime.now(timezone.utc).isoformat()
    write_json(state_path, state)

    return 0


if __name__ == "__main__":
    sys.exit(main())
