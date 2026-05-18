#!/usr/bin/env python3
"""
Stage 9 hero image generator for the website factory pipeline.

Niche-agnostic. The active niche template supplies the complete hero
prompt scaffold at
`templates/{active-niche-slug}/niche-playbook/hero-composition.md`
(Module 2D Phase 8 writes this from the top-of-niche reference pool).
This module loads that scaffold, substitutes per-client tokens, and
sends the result to the Gemini Image API. There is no contractor
default; if the per-niche file is missing, the generator halts with
a Module 2D pointer.

Per-niche mood lighting overrides come from
`templates/{active-niche-slug}/niche-playbook/hero-mood-mapping.json`.
Per-niche region defaults come from the optional
`templates/{active-niche-slug}/niche-playbook/hero-regions.json`.

Calls the Gemini Image API directly (replaces the Nano Banana MCP path
for reliability + log visibility).

Usage:
    python3 tools/generate-hero.py --client "Acme Roofing"
    python3 tools/generate-hero.py --client "Acme Construction" --no-owner

Requires:
    pip install google-genai pillow

Reads (from repo root):
    .env                                                       (GEMINI_API_KEY, GEMINI_MODEL)
    stack-state.json                                           (active niche slug)
    templates/{niche-slug}/niche-playbook/hero-composition.md  (required)
    templates/{niche-slug}/niche-playbook/hero-mood-mapping.json (required)
    templates/{niche-slug}/niche-playbook/hero-regions.json    (optional)
    clients/[Client]/Pipeline Data/brand/brand-dna.json        (required)
    clients/[Client]/Pipeline Data/research/research.json      (optional)
    clients/[Client]/Pipeline Data/intake/intake-form.json     (optional)
    clients/[Client]/[Client] Assets/logo/logo.png|svg|jpg     (required)
    clients/[Client]/[Client] Assets/founder-photos/owner.*    (optional)

Writes:
    clients/[Client]/Pipeline Data/hero-image/hero-final-{desktop,mobile}.png
    clients/[Client]/Pipeline Data/hero-image/hero-prompt.md
    clients/[Client]/Pipeline Data/hero-image/hero-metadata.json
    clients/[Client]/Pipeline Data/hero-image/MANUAL-DROP-NEEDED.md   (only if logo missing)
    clients/[Client]/Pipeline Data/hero-image/REGENERATION-NEEDED.md  (only on hard failure)
"""

from __future__ import annotations

import argparse
import io
import json
import os
import re
import shutil
import sys
import time
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent
STACK_STATE_PATH = REPO_ROOT.parent / "stack-state.json"
ENV_PATH = REPO_ROOT / ".env"


class NoHeroCompositionError(RuntimeError):
    """Raised when the active niche template ships no hero-composition.md.

    Stage 9 does not carry a built-in default composition. Module 2D
    must write the file at templates/{niche-slug}/niche-playbook/
    hero-composition.md (Phase 8) from the top-of-niche hero analysis.
    """

# Default desktop landscape and mobile portrait targets used by the website template
# Hero <picture> element. The Gemini Image API does not always honour exact
# pixel dimensions, so the validator allows generous lower bounds. The
# build-from-template step in Stage 10.1 will resize to the final target.
DESKTOP_WIDTH = 1920
DESKTOP_HEIGHT = 1080
MOBILE_WIDTH = 828
MOBILE_HEIGHT = 1200

MAX_RETRIES = 3
BASE_BACKOFF_SEC = 2

DEFAULT_MODEL = "gemini-2.5-flash-image-preview"

# Universal mood fallback. Mood names are niche-neutral; lighting briefs
# describe LIGHT, not subject matter. Per-niche templates override these
# via niche-playbook/hero-mood-mapping.json.
MOOD_LIGHTING_FALLBACK = {
    "golden_hour_warm": "Warm directional light from low angle, long soft shadows, saturated golden tones",
    "overcast_calm": "Soft diffused daylight, muted colors, even shadows, no harsh contrast",
    "stormy_dramatic_dusk": "Low-key dramatic lighting, dark sky with rim light on subjects",
    "bright_midday_clean": "Clean overhead light, crisp shadows, neutral color, full saturation",
    "dawn_soft_optimistic": "Cool soft light from east, gentle gradient sky, hopeful tone",
    "candlelit_intimate": "Warm low-key indoor light, golden glow, soft falloff, intimate mood",
}

# Per-niche region defaults come from the active niche template's optional
# `templates/{niche-slug}/niche-playbook/hero-regions.json`. If the file
# is missing, this universal fallback applies (niche-agnostic region
# descriptors that work for any business that operates in a geographic
# market — no niche-specific architecture or product references).
REGION_DEFAULTS_FALLBACK = {
    "default": {
        "setting_descriptor": "well-kept local setting appropriate to the business's primary market",
        "landscape": "natural greenery and clear sightlines",
        "sky": "bright, well-lit conditions",
        "background": "soft natural background that does not compete with the foreground",
    }
}


def _resolve_active_niche() -> str | None:
    """Read the active niche slug from stack-state.json. Returns None when
    no niche is set."""
    if not STACK_STATE_PATH.exists():
        return None
    try:
        state = json.loads(STACK_STATE_PATH.read_text())
        n = state.get("niche")
        if isinstance(n, str) and n.strip():
            return n.strip()
    except Exception as e:
        print(f"  WARN: could not read {STACK_STATE_PATH}: {e}", file=sys.stderr)
    return None


def _load_niche_hero_composition(niche_slug: str | None) -> str:
    """Read the active niche's hero-composition.md prompt scaffold. Halts
    with a Module 2D pointer when missing.

    The file is a complete Gemini prompt template with {token} placeholders.
    Module 2D Phase 8 writes it from the top-of-niche reference pool's
    hero analysis. There is no contractor default; Stage 9 cannot run
    without it.
    """
    if not niche_slug:
        raise NoHeroCompositionError(
            "No active niche is set in stack-state.json. Run `/pick-niche` "
            "and `/build-niche-template` before Stage 9 (hero image)."
        )
    path = REPO_ROOT / "templates" / niche_slug / "niche-playbook" / "hero-composition.md"
    if not path.exists():
        raise NoHeroCompositionError(
            f"templates/{niche_slug}/niche-playbook/hero-composition.md missing. "
            f"Run `/build-niche-template` to regenerate the niche playbook "
            f"(Module 2D Phase 8 writes this from the top-of-niche hero "
            f"analysis)."
        )
    return path.read_text()


def _load_niche_hero_mood_mapping(niche_slug: str | None) -> dict[str, str]:
    """Read the active niche's hero-mood-mapping.json. Returns a dict of
    {mood_name: lighting_brief}. Falls back to MOOD_LIGHTING_FALLBACK
    when the file is missing (mood lighting is largely niche-neutral).
    """
    if not niche_slug:
        return dict(MOOD_LIGHTING_FALLBACK)
    path = REPO_ROOT / "templates" / niche_slug / "niche-playbook" / "hero-mood-mapping.json"
    if not path.exists():
        return dict(MOOD_LIGHTING_FALLBACK)
    try:
        data = json.loads(path.read_text())
        # Expected shape: { "moods": { "<name>": "<lighting brief>" } } or
        # flat: { "<name>": "<lighting brief>" }
        moods = data.get("moods") if isinstance(data, dict) else None
        if isinstance(moods, dict):
            return {**MOOD_LIGHTING_FALLBACK, **moods}
        if isinstance(data, dict):
            # Treat the top-level dict as the mood map directly
            return {**MOOD_LIGHTING_FALLBACK, **data}
    except Exception as e:
        print(f"  WARN: could not parse hero-mood-mapping.json: {e}", file=sys.stderr)
    return dict(MOOD_LIGHTING_FALLBACK)


def _load_niche_hero_regions(niche_slug: str | None) -> dict[str, dict[str, str]]:
    """Read the active niche's optional hero-regions.json. Returns a dict
    of {region_key: {setting_descriptor, landscape, sky, background}}.
    Falls back to REGION_DEFAULTS_FALLBACK when missing.
    """
    if not niche_slug:
        return dict(REGION_DEFAULTS_FALLBACK)
    path = REPO_ROOT / "templates" / niche_slug / "niche-playbook" / "hero-regions.json"
    if not path.exists():
        return dict(REGION_DEFAULTS_FALLBACK)
    try:
        data = json.loads(path.read_text())
        regions = data.get("regions") if isinstance(data, dict) else None
        if isinstance(regions, dict):
            return {**REGION_DEFAULTS_FALLBACK, **regions}
        if isinstance(data, dict):
            return {**REGION_DEFAULTS_FALLBACK, **data}
    except Exception as e:
        print(f"  WARN: could not parse hero-regions.json: {e}", file=sys.stderr)
    return dict(REGION_DEFAULTS_FALLBACK)


def _sub_hero_tokens(text: str, tokens: dict[str, str]) -> str:
    """Replace {key} placeholders in `text` with values from `tokens`.
    Missing tokens render as the empty string + a stderr warning so the
    audit log captures every unresolved placeholder."""
    def repl(m: "re.Match[str]") -> str:
        key = m.group(1)
        if key in tokens:
            return tokens[key]
        print(f"  WARN: hero-composition token {{{key}}} did not resolve", file=sys.stderr)
        return ""
    return re.sub(r"\{([a-z_]+)\}", repl, text)


def load_env():
    if not ENV_PATH.exists():
        sys.exit(f"ERROR: .env not found at {ENV_PATH}")
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def find_client_paths(client_name: str) -> dict:
    base = REPO_ROOT / "clients" / client_name
    if not base.exists():
        sys.exit(f"ERROR: client folder not found: {base}")
    pipeline = base / "Pipeline Data"
    assets = base / f"{client_name} Assets"
    return {
        "base": base,
        "brand_dna": pipeline / "brand" / "brand-dna.json",
        "research": pipeline / "research" / "research.json",
        "intake": pipeline / "intake" / "intake-form.json",
        "logo_dir": assets / "logo",
        "owner_dir": assets / "founder-photos",
        "out_dir": pipeline / "hero-image",
    }


def find_logo(logo_dir: Path):
    if not logo_dir.exists():
        return None
    for ext in ("png", "svg", "jpg", "jpeg"):
        for p in sorted(logo_dir.glob(f"*.{ext}")):
            return p
    return None


def find_owner_photo(owner_dir: Path):
    """Resolve owner photo with this priority order:
    1. owner.{png,jpg,jpeg} alias (Stage 1 intake creates this from the curated pick)
    2. primary.{png,jpg,jpeg} alias (alternate naming convention)
    3. First file alphabetically as last resort
    Skips any path under a 'truck/' subfolder.
    """
    if not owner_dir.exists():
        return None
    # Priority 1: explicit owner.* / primary.* alias
    for stem in ("owner", "primary"):
        for ext in ("png", "jpg", "jpeg"):
            candidate = owner_dir / f"{stem}.{ext}"
            if candidate.exists():
                return candidate
    # Priority 2: first non-truck photo alphabetically (legacy behaviour)
    for ext in ("png", "jpg", "jpeg"):
        for p in sorted(owner_dir.glob(f"*.{ext}")):
            if "/truck/" in str(p) or "truck" in p.parent.name.lower():
                continue
            return p
    return None


def safe_load_json(path: Path) -> dict:
    if not path.exists():
        return {}
    try:
        return json.loads(path.read_text())
    except json.JSONDecodeError as e:
        print(f"WARNING: bad JSON in {path}: {e}", file=sys.stderr)
        return {}


def build_prompt(brand_dna: dict, research: dict, intake: dict, has_owner: bool, client_name: str, variant: str = "desktop", mood_override: str = None, region_override: str = None, niche_slug: str | None = None) -> str:
    """Assemble the Gemini hero-image prompt from the active niche's
    hero-composition.md scaffold + per-client tokens.

    Architecture:
      - The niche's `hero-composition.md` is the COMPLETE prompt body
        scaffold Module 2D wrote from the top-of-niche reference pool.
        It uses {token} placeholders.
      - This function loads the scaffold, substitutes per-client tokens,
        wraps it in variant-specific framing (desktop landscape vs
        mobile portrait, size targets, placement guidance), and appends
        universal anti-slop rules.

    Halts with NoHeroCompositionError when the active niche has not
    shipped a hero-composition.md (no contractor fallback under the
    no-shared-baseline architecture).
    """
    # Resolve active niche + load per-niche assets.
    if niche_slug is None:
        niche_slug = _resolve_active_niche()
    niche_composition_body = _load_niche_hero_composition(niche_slug)
    mood_mapping = _load_niche_hero_mood_mapping(niche_slug)
    regions = _load_niche_hero_regions(niche_slug)

    # Per-client values.
    company = (
        intake.get("company_name")
        or brand_dna.get("company_name")
        or client_name
    )
    city = intake.get("city") or research.get("primary_city", "")
    state = intake.get("state") or research.get("primary_state", "")
    location = ", ".join([x for x in (city, state) if x])

    palette = brand_dna.get("palette", {})
    primary = palette.get("primary", "#1a1a1a")
    accent = palette.get("accent", "#FFD700")
    accent_name = palette.get("accent_name", "gold")

    # Mood lookup: brand-dna.hero.mood -> niche mood mapping -> lighting brief.
    hero_block = brand_dna.get("hero", {}) if isinstance(brand_dna.get("hero"), dict) else {}
    mood = mood_override or hero_block.get("mood", "golden_hour_warm")
    lighting = mood_mapping.get(mood) or mood_mapping.get("golden_hour_warm", "")

    # Region lookup: brand-dna.region -> niche regions -> universal fallback.
    region = region_override or brand_dna.get("region", "default")
    region_data = regions.get(region) or regions.get("default") or REGION_DEFAULTS_FALLBACK["default"]
    # Tolerate both old contractor schema (home/landscaping/sky/background) +
    # new universal schema (setting_descriptor/landscape/sky/background) so
    # legacy hero-regions.json files don't break this run.
    region_setting = region_data.get("setting_descriptor") or region_data.get("setting") or region_data.get("home") or "well-kept local setting"
    region_landscape = region_data.get("landscape") or region_data.get("landscaping") or "natural greenery"
    region_sky = region_data.get("sky") or "bright natural light"
    region_background = region_data.get("background") or "soft natural background"

    photo_style_note = (
        brand_dna.get("photo_style_note")
        or "clean documentary photography, well-lit, clarity over cinematic mood"
    )

    # Owner block: either a per-niche-shaped subject portrait block or a
    # "no people in frame" directive. The niche scaffold may embed the
    # owner block placement guidance via {owner_block}; this function
    # supplies the content.
    if has_owner:
        owner_block = (
            "The founder's actual headshot is attached as a second reference image. "
            "Position the subject per the niche composition above. Casual professional attire, "
            "hands relaxed, natural expression, looking at camera. Studio-quality lighting on the "
            "subject. Reproduce the founder's facial features, hair, and skin tone faithfully "
            "from the reference photo. Do not generate any other people."
        )
    else:
        owner_block = (
            "No people in frame. Do not generate any people, faces, or human figures."
        )

    # Token map applied to the niche scaffold.
    tokens: dict[str, str] = {
        "company": company,
        "client_name": company,
        "location": location or "the business's primary market",
        "city": city,
        "state": state,
        "primary_color": primary,
        "primary": primary,
        "accent_color": accent,
        "accent": accent,
        "accent_name": accent_name,
        "mood": mood,
        "mood_lighting": lighting,
        "lighting": lighting,
        "photo_style_note": photo_style_note,
        "region": region,
        "region_setting": region_setting,
        "region_landscape": region_landscape,
        "region_sky": region_sky,
        "region_background": region_background,
        "owner_block": owner_block,
    }

    # Substitute per-client tokens into the niche scaffold.
    composition_body = _sub_hero_tokens(niche_composition_body, tokens).strip()

    # Variant-specific framing (universal, niche-neutral).
    is_mobile = variant == "mobile"
    if is_mobile:
        framing = (
            f"Photorealistic vertical (portrait) hero image for {company}"
            + (f" serving {location}" if location else "")
            + f". Tall portrait format, approximately {MOBILE_WIDTH}x{MOBILE_HEIGHT} pixels, "
            "aspect ratio close to 3:4. Designed for a mobile phone hero where the focal "
            "point sits in the UPPER TWO-THIRDS of the frame so a lead-capture form can "
            "overlay the lower third without covering the subject."
        )
        composition_rules = (
            "COMPOSITION RULES (mobile)\n"
            "- Focal point lives in the UPPER 60-70 percent of the frame; the LOWER 30 percent must "
            "be calmer (clean foreground or open ground tone) so a lead form can overlay it cleanly\n"
            "- Depth of field: primary subject in sharp focus\n"
            "- No watermarks, no fabricated text outside the brand surfaces the niche scaffold specifies"
        )
    else:
        framing = (
            f"Photorealistic wide-format hero image for {company}"
            + (f" serving {location}" if location else "")
            + f". Landscape format, approximately {DESKTOP_WIDTH}x{DESKTOP_HEIGHT} pixels, "
            "16:9 aspect ratio."
        )
        composition_rules = (
            "COMPOSITION RULES (desktop)\n"
            "- The LEFT 40 percent of the image must have calmer tones, open sky, or negative space "
            "to allow clean text overlay\n"
            "- Depth of field: primary subject in sharp focus\n"
            "- No watermarks, no fabricated text outside the brand surfaces the niche scaffold specifies"
        )

    # Universal anti-slop suffix.
    style_rules = (
        "STYLE\n"
        f"Photo style: {photo_style_note}. Honest, locally-anchored documentary feel. Crisp and "
        "trustworthy without being cinematic or hyper-stylized. Avoid heavy color grading, lens "
        "flares, dramatic haze, or over-saturated commercial gloss. This should look like a real "
        "photo the business would post, not AI art. Avoid AI giveaways: no warped geometry, no "
        "melted edges, no impossibly perfect surfaces, no fabricated text outside the brand "
        "surfaces the niche composition above prescribes."
    )

    # Logo handling (universal — every niche uses the client logo as a
    # multimodal reference; placement comes from the niche scaffold).
    logo_rules = (
        "CRITICAL LOGO HANDLING\n"
        "The company's actual logo is attached as a reference image (subject consistency). Place the "
        "EXACT logo design on the surface the niche composition specifies, as it would naturally "
        f"appear in real life. The logo must be clearly visible and recognizable: reproduce the "
        f"logo's wordmark, lockup, iconography, and {primary} brand colors faithfully. Do NOT invent "
        f"a different logo or alter the colors and shapes. Any background detail beyond the logo is "
        f"clean with {accent} ({accent_name}) accent striping pulled from the actual brand palette. "
        "NO other accent colors."
    )

    # Lighting block (uses the niche's mood mapping).
    lighting_block = f"LIGHTING AND MOOD\n{lighting}."

    return "\n\n".join([
        framing,
        composition_body,
        logo_rules,
        lighting_block,
        composition_rules,
        style_rules,
    ]).strip()


def call_gemini(prompt: str, logo_path: Path, owner_path, model_name: str) -> bytes:
    try:
        from google import genai
        from google.genai import types
    except ImportError:
        sys.exit("ERROR: install google-genai (pip install google-genai)")

    api_key = os.environ.get("GEMINI_API_KEY")
    if not api_key:
        sys.exit("ERROR: GEMINI_API_KEY not in env")

    client = genai.Client(api_key=api_key)

    def _mime(path: Path) -> str:
        suffix = path.suffix.lstrip(".").lower()
        if suffix in ("jpg", "jpeg"):
            return "image/jpeg"
        if suffix == "svg":
            return "image/svg+xml"
        return f"image/{suffix}"

    contents = [prompt]
    contents.append(types.Part.from_bytes(data=logo_path.read_bytes(), mime_type=_mime(logo_path)))
    if owner_path:
        contents.append(types.Part.from_bytes(data=owner_path.read_bytes(), mime_type=_mime(owner_path)))

    last_err = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            response = client.models.generate_content(model=model_name, contents=contents)
            for cand in response.candidates or []:
                for part in cand.content.parts or []:
                    inline = getattr(part, "inline_data", None)
                    if inline and getattr(inline, "data", None):
                        return inline.data
            raise RuntimeError("API returned no image part")
        except Exception as e:
            last_err = e
            if attempt < MAX_RETRIES:
                wait = BASE_BACKOFF_SEC * (2 ** (attempt - 1))
                print(f"[retry {attempt}/{MAX_RETRIES}] {e}; waiting {wait}s", file=sys.stderr)
                time.sleep(wait)
            else:
                raise
    raise RuntimeError(f"Gemini API failed after {MAX_RETRIES} retries: {last_err}")


def validate_image(image_bytes: bytes, variant: str = "desktop") -> tuple[bool, str]:
    if len(image_bytes) < 10_000:
        return False, f"image too small ({len(image_bytes)} bytes)"
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes))
        w, h = img.size
        if variant == "mobile":
            # Mobile must be portrait-leaning and ≥ 800x1000
            if w < 600 or h < 800:
                return False, f"mobile dimensions too small: {w}x{h}"
            if w >= h:
                return False, f"mobile must be portrait, got landscape {w}x{h}"
        else:
            if w < 1000 or h < 500:
                return False, f"desktop dimensions too small: {w}x{h}"
        sample = list(img.convert("RGB").resize((10, 10)).getdata())
        unique = {tuple(p) for p in sample}
        if len(unique) < 3:
            return False, "image appears to be a solid color"
    except ImportError:
        pass
    return True, "ok"


def write_text(path: Path, content: str):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content)


def _is_quota_error(err: Exception) -> bool:
    """Detect Gemini quota / rate-limit / billing errors from the exception message."""
    msg = str(err).lower()
    return any(token in msg for token in (
        "429",
        "resource_exhausted",
        "rate limit",
        "quota",
        "billing",
        "insufficient",
    ))


def _pick_fallback_photo(paths: dict, variant: str) -> Path | None:
    """Pick the best available scraped/dropped photo to use as a hero placeholder
    when Gemini generation fails (free-tier quota, network outage, etc).
    Preference order: hero-context > projects > project-images > owner.
    Variant hint (`desktop` | `mobile`) is currently informational only; image
    orientation is left to the PIL resize step in Stage 10.1.
    """
    candidate_dirs: list[Path] = []
    photos = paths.get("owner_dir")  # this is assets/photos/ per find_client_paths
    if photos:
        candidate_dirs.extend([
            photos / "hero-context",
            photos / "projects",
            photos,
            photos / "team",
        ])
    # Newer Stage 4 layouts that drop assets into different folders.
    base = paths.get("base") or paths.get("out_dir", Path(".")).parent
    if base:
        for sub in ("project-images", "founder-photos"):
            candidate_dirs.append(base / sub)

    seen: set[str] = set()
    for dir_path in candidate_dirs:
        if not dir_path or not dir_path.exists():
            continue
        for p in sorted(dir_path.iterdir()):
            if not p.is_file():
                continue
            if p.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
                continue
            key = p.name.lower()
            if key in seen:
                continue
            seen.add(key)
            return p
    return None


def _write_fallback_image(fallback_src: Path, output_path: Path) -> int:
    """Copy a scraped photo into the hero output path. Returns byte count.
    Stage 10.1 (build-from-template.py) handles the WebP conversion + resize."""
    output_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(fallback_src, output_path)
    return output_path.stat().st_size


def _generate_variant(variant: str, brand_dna: dict, research: dict, intake: dict, owner, has_owner: bool, logo: Path, client_name: str, model_name: str, out_dir: Path, mood_override: str = None, region_override: str = None, paths: dict = None, allow_fallback: bool = True) -> tuple[Path, dict, str]:
    """Generate one variant (desktop or mobile). Returns (output_path, info_dict, prompt_text).

    Fallback behavior: when `allow_fallback=True` (the default), the function
    falls back to the best-available scraped photo if Gemini generation
    exhausts retries OR returns a quota-related error. A MANUAL-DROP-NEEDED
    note is written so the student knows to swap in a real hero later. The
    pipeline does NOT halt on fallback; only when no scraped photo is
    available does the function raise.
    """
    prompt = build_prompt(brand_dna, research, intake, has_owner, client_name, variant=variant, mood_override=mood_override, region_override=region_override)

    image_bytes = None
    last_reason = ""
    quota_error_seen = False
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            candidate_bytes = call_gemini(prompt, logo, owner, model_name)
            ok, reason = validate_image(candidate_bytes, variant=variant)
            if ok:
                image_bytes = candidate_bytes
                break
            last_reason = reason
            print(f"[{variant} validation retry {attempt}/{MAX_RETRIES}] {reason}", file=sys.stderr)
        except Exception as e:
            last_reason = str(e)
            if _is_quota_error(e):
                # Quota / rate-limit. Retrying won't help. Break out and try fallback.
                quota_error_seen = True
                print(f"[{variant}] quota error: {e}", file=sys.stderr)
                break
            if attempt == MAX_RETRIES:
                if allow_fallback and paths is not None:
                    break  # fall through to fallback below
                write_text(
                    out_dir / f"REGENERATION-NEEDED-{variant}.md",
                    f"# Hero {variant} generation failed\n\n```\n{e}\n```\n\n## Filled prompt\n\n{prompt}\n",
                )
                raise

    if image_bytes is None:
        if allow_fallback and paths is not None:
            fallback = _pick_fallback_photo(paths, variant)
            if fallback is not None:
                output_path = out_dir / f"hero-final-{variant}.png"
                size = _write_fallback_image(fallback, output_path)
                reason_line = "free-tier quota exhausted" if quota_error_seen else f"generation failed: {last_reason}"
                write_text(
                    out_dir / f"MANUAL-DROP-NEEDED-hero-{variant}.md",
                    (
                        f"# Hero {variant} fallback in use\n\n"
                        f"Stage 9 could not generate a fresh hero image ({reason_line}). "
                        f"The build is using a scraped placeholder so the pipeline can continue:\n\n"
                        f"- Fallback source: `{fallback.relative_to(REPO_ROOT)}`\n"
                        f"- Output: `{output_path.relative_to(REPO_ROOT)}`\n\n"
                        f"## How to replace\n\n"
                        f"1. Top up Gemini billing OR resolve the failure cause.\n"
                        f"2. Re-run `python3 tools/generate-hero.py --client \"{client_name}\" --variant {variant}`.\n"
                        f"3. The fresh hero will overwrite this placeholder.\n\n"
                        f"## Filled prompt (for manual swap-in)\n\n{prompt}\n"
                    ),
                )
                info = {
                    "variant": variant,
                    "size_bytes": size,
                    "width": 0,
                    "height": 0,
                    "path": str(output_path.relative_to(REPO_ROOT)),
                    "fallback": True,
                    "fallback_source": str(fallback.relative_to(REPO_ROOT)),
                }
                print(f"  {variant}: FALLBACK -> {output_path.name} (from {fallback.name})", file=sys.stderr)
                return output_path, info, prompt
        write_text(
            out_dir / f"REGENERATION-NEEDED-{variant}.md",
            f"# Hero {variant} validation kept failing\n\nLast reason: {last_reason}\n\n## Filled prompt\n\n{prompt}\n",
        )
        raise RuntimeError(f"{variant} validation failed {MAX_RETRIES} times: {last_reason}")

    output_path = out_dir / f"hero-final-{variant}.png"
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(image_bytes)

    try:
        from PIL import Image
        img = Image.open(io.BytesIO(image_bytes))
        w, h = img.size
    except Exception:
        w, h = 0, 0

    info = {
        "variant": variant,
        "size_bytes": len(image_bytes),
        "width": w,
        "height": h,
        "path": str(output_path.relative_to(REPO_ROOT)),
    }
    print(f"  {variant}: {output_path.name} ({w}x{h}, {len(image_bytes):,} bytes)", file=sys.stderr)
    return output_path, info, prompt


def main():
    parser = argparse.ArgumentParser(description="Generate Stage 9 hero image(s) via Gemini API")
    parser.add_argument("--client", required=True, help="Client folder name (e.g. 'Acme Roofing')")
    parser.add_argument("--no-owner", action="store_true", help="Force skip founder cutout even if photo exists")
    parser.add_argument(
        "--variant",
        choices=("desktop", "mobile", "both"),
        default="both",
        help="Which variant to generate (default: both)",
    )
    parser.add_argument(
        "--mood",
        choices=tuple(MOOD_LIGHTING_FALLBACK.keys()),
        default=None,
        help="Override brand-dna hero.mood for this run (does not mutate brand-dna.json). Choices reflect the universal mood fallback set; per-niche templates may add more via hero-mood-mapping.json.",
    )
    parser.add_argument(
        "--region",
        choices=tuple(REGION_DEFAULTS_FALLBACK.keys()),
        default=None,
        help="Override brand-dna region for this run (does not mutate brand-dna.json). Choices reflect the universal region fallback set; per-niche templates may add more via hero-regions.json.",
    )
    parser.add_argument(
        "--no-fallback",
        action="store_true",
        help="Disable the scraped-photo fallback when Gemini generation fails. By default, when Gemini hits quota or otherwise fails, the script uses the best available client photo as a placeholder + writes MANUAL-DROP-NEEDED so the pipeline can continue.",
    )
    args = parser.parse_args()

    load_env()
    paths = find_client_paths(args.client)
    out_dir = paths["out_dir"]

    logo = find_logo(paths["logo_dir"])
    if not logo:
        write_text(
            out_dir / "MANUAL-DROP-NEEDED.md",
            f"# Logo missing\n\nNo logo found in {paths['logo_dir']}.\nDrop a PNG/SVG and re-run Stage 9.\n",
        )
        sys.exit(f"ERROR: no logo at {paths['logo_dir']}")

    owner = None if args.no_owner else find_owner_photo(paths["owner_dir"])

    brand_dna = safe_load_json(paths["brand_dna"])
    research = safe_load_json(paths["research"])
    intake = safe_load_json(paths["intake"])

    if not brand_dna:
        sys.exit(f"ERROR: brand-dna.json missing or invalid at {paths['brand_dna']}")

    has_owner = owner is not None

    print(f"Generating hero for {args.client}", file=sys.stderr)
    print(f"  Logo: {logo.name}", file=sys.stderr)
    print(f"  Founder: {owner.name if owner else '(none, anchor-object only)'}", file=sys.stderr)
    print(f"  Mood: {brand_dna.get('hero', {}).get('mood', 'golden_hour_warm')}", file=sys.stderr)
    print(f"  Region: {brand_dna.get('region', 'default')}", file=sys.stderr)
    print(f"  Variant: {args.variant}", file=sys.stderr)

    model_name = os.environ.get("GEMINI_MODEL", DEFAULT_MODEL)

    variants_to_run = ["desktop", "mobile"] if args.variant == "both" else [args.variant]
    results = {}
    prompts = {}
    final_output = None

    for v in variants_to_run:
        output_path, info, prompt = _generate_variant(
            v, brand_dna, research, intake, owner, has_owner, logo, args.client, model_name, out_dir,
            mood_override=args.mood, region_override=args.region,
            paths=paths, allow_fallback=not args.no_fallback,
        )
        results[v] = info
        prompts[v] = prompt
        final_output = output_path

    # Combined prompt audit file: include each variant's prompt
    prompt_md_parts = [f"# Hero prompts for {args.client}\n"]
    for v in variants_to_run:
        prompt_md_parts.append(f"\n## {v.upper()} variant\n\n{prompts[v]}\n")
    write_text(out_dir / "hero-prompt.md", "\n".join(prompt_md_parts))

    metadata = {
        "client": args.client,
        "logo_used": str(logo.relative_to(REPO_ROOT)),
        "owner_used": str(owner.relative_to(REPO_ROOT)) if owner else None,
        "mood": brand_dna.get("hero", {}).get("mood", "golden_hour_warm"),
        "region": brand_dna.get("region", "default"),
        "variants": results,
        "model": model_name,
        "ts": int(time.time()),
    }
    write_text(out_dir / "hero-metadata.json", json.dumps(metadata, indent=2))

    if final_output is not None:
        print(f"DONE -> {out_dir}", file=sys.stderr)
        print(str(final_output))


if __name__ == "__main__":
    main()
