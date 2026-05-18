#!/usr/bin/env python3
"""
build-from-template.py — Stage 10.1

Clones the active niche template at `templates/{niche-slug}/` (generated
by Module 2D via `/build-niche-template`) to `clients/[X]/[X] Website/`,
composes a per-client `src/config/brand-dna.js` from upstream pipeline
data, copies + optimises per-client assets, runs `npm install && npm
run build`, then validates the dist for sentinels and forbidden strings.

There is no shared baseline template; if `templates/{niche-slug}/` is
missing or carries a `GENERATION-FAILED.md` marker, Stage 10.1 halts
cleanly via `NoNicheTemplateError`.

Usage:
    python3 tools/build-from-template.py --client "Client Name"
    python3 tools/build-from-template.py --client "Client Name" --skip-install
    python3 tools/build-from-template.py --client "Client Name" --dry-run

Reads (per client):
    clients/[X]/Pipeline Data/intake/intake-form.json
    clients/[X]/Pipeline Data/research/research.json
    clients/[X]/Pipeline Data/strategy/strategy.json
    clients/[X]/Pipeline Data/copy/copy-deck.md
    clients/[X]/Pipeline Data/brand/brand-dna.json
    clients/[X]/Pipeline Data/brand-resonance/resonance.json     (optional)
    clients/[X]/Pipeline Data/hero-image/hero-final-desktop.png  (Stage 9)
    clients/[X]/Pipeline Data/hero-image/hero-final-mobile.png   (Stage 9)
    clients/[X]/[X] Assets/logo/*
    clients/[X]/[X] Assets/photos/owner.{jpg,png,webp}           (optional)
    clients/[X]/[X] Assets/photos/team/*                         (optional)
    clients/[X]/[X] Assets/photos/projects/*                     (optional)
    templates/{niche-slug}/niche-playbook/trust-signals.json     (badge lookup)
    references/assets/platforms/{google,facebook,bbb}-logo.svg

Writes:
    clients/[X]/[X] Website/                  (clone of templates/{niche-slug}/)
    clients/[X]/[X] Website/src/config/brand-dna.js       (composed)
    clients/[X]/[X] Website/public/                       (per-client assets)
    clients/[X]/[X] Website/dist/                         (npm run build output)
    clients/[X]/Pipeline Data/logs/build-log.md           (appended)
    clients/[X]/Pipeline Data/logs/pipeline-state.json    (stage_10_1 status)

Validator fails closed on:
    - any __REQUIRED__SOMETHING__ sentinel surviving in src/config/brand-dna.js
    - any FORBIDDEN_STRINGS entry in dist/index.html or dist/assets/*.css/*.js
"""

from __future__ import annotations

import argparse
import json
import os
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
TEMPLATES_DIR = REPO_ROOT / "templates"
TRUST_BADGES_DIR = REPO_ROOT / "references" / "trust-badges"
PLATFORMS_DIR = REPO_ROOT / "references" / "assets" / "platforms"
OPTIMISE_TOOL = REPO_ROOT / "tools" / "optimise-image.py"
STACK_STATE_PATH = REPO_ROOT.parent / "stack-state.json"


class NoNicheTemplateError(RuntimeError):
    """Raised when Stage 10.1 cannot find a per-niche template to build from.

    There is no shared baseline. Every niche must be generated end-to-end
    by Module 2D's `/build-niche-template` before Stage 10.1 can run.
    """


def resolve_active_template(cli_niche: str | None) -> tuple[Path, str]:
    """Pick the per-niche template directory for this build.

    Resolution order:
      1. --niche CLI argument (explicit override)
      2. Stack-root `stack-state.json` -> `niche` (set by Module 2C `/pick-niche`)

    Halts with NoNicheTemplateError when no per-niche template is
    available, when the candidate template has no package.json, or when
    it carries a `GENERATION-FAILED.md` marker. There is no fallback.
    """
    candidates: list[str] = []
    if cli_niche:
        candidates.append(cli_niche)
    if STACK_STATE_PATH.exists():
        try:
            state = json.loads(STACK_STATE_PATH.read_text())
            n = state.get("niche")
            if isinstance(n, str) and n.strip():
                candidates.append(n.strip())
        except Exception as e:
            print(f"  WARN: could not read {STACK_STATE_PATH}: {e}", file=sys.stderr)

    if not candidates:
        raise NoNicheTemplateError(
            "No active niche is set. Run `/pick-niche` and then "
            "`/build-niche-template` before Stage 10.1."
        )

    for slug in candidates:
        normalised = slug.lower().replace(" ", "-").replace("_", "-")
        for candidate in {slug, normalised}:
            tdir = TEMPLATES_DIR / candidate
            if not (tdir / "package.json").exists():
                continue
            failed_marker = tdir / "GENERATION-FAILED.md"
            if failed_marker.exists():
                raise NoNicheTemplateError(
                    f"Niche template '{candidate}' has GENERATION-FAILED.md. "
                    f"Inspect {failed_marker.relative_to(REPO_ROOT)} and re-run "
                    f"`/build-niche-template` after addressing the failure."
                )
            return tdir, candidate

    raise NoNicheTemplateError(
        f"No per-niche template found at templates/{candidates[0]}/. "
        f"Run `/build-niche-template` to generate it from captured niche "
        f"research."
    )


def niche_playbook_dir(niche_slug: str) -> Path | None:
    """Return the niche-playbook directory for the active niche, or None
    when the playbook hasn't been generated yet."""
    p = TEMPLATES_DIR / niche_slug / "niche-playbook"
    return p if p.exists() else None

# Patterns that must NOT appear in the rendered per-client dist/. Items are
# compiled to regex via re.compile() at scan time. The universal entry catches
# surviving fully-formed __REQUIRED__SOMETHING__ sentinels (the bare word
# __REQUIRED__ in a code comment intentionally does NOT match, so a developer
# can document the convention without tripping the scanner).
#
# Niche templates may extend this list at runtime by appending values from
# their niche-playbook (e.g. names of reference clients the template was
# derived from). The build halts if any entry matches the dist tree.
FORBIDDEN_PATTERNS = [
    r"__REQUIRED__[A-Z0-9_]+__",
]

# Back-compat alias for any external caller that imports the old name.
FORBIDDEN_STRINGS = FORBIDDEN_PATTERNS


# ----- helpers ------------------------------------------------------------


def slug_dir(name: str) -> str:
    return name


def client_paths(client_name: str) -> dict[str, Path]:
    base = REPO_ROOT / "clients" / client_name
    site = base / f"{client_name} Website"
    assets = base / f"{client_name} Assets"
    pipe = base / "Pipeline Data"
    return {
        "base": base,
        "site": site,
        "assets": assets,
        "pipe": pipe,
        "intake": pipe / "intake" / "intake-form.json",
        "research": pipe / "research" / "research.json",
        "raw_google": pipe / "research" / "raw-google.json",
        "raw_facebook": pipe / "research" / "raw-facebook.json",
        "raw_websites": pipe / "research" / "raw-websites.json",
        "strategy": pipe / "strategy" / "strategy.json",
        "sitemap": pipe / "strategy" / "sitemap.json",
        "copy_deck": pipe / "copy" / "copy-deck.md",
        "brand_dna_json": pipe / "brand" / "brand-dna.json",
        "resonance": pipe / "brand-resonance" / "resonance.json",
        "hero_desktop": pipe / "hero-image" / "hero-final-desktop.png",
        "hero_mobile": pipe / "hero-image" / "hero-final-mobile.png",
        "logo_dir": assets / "logo",
        "owner_photo_dir": assets / "photos",
        "team_dir": assets / "photos" / "team",
        "projects_dir": assets / "photos" / "projects",
        # Alternate Stage 4 asset layouts (newer client folder structures):
        # founder-photos/ holds owner OR team-group photo, project-images/ holds projects,
        # client_badges/ holds per-client manufacturer SVGs harvested from the client site.
        "founder_dir": assets / "founder-photos",
        "project_images_dir": assets / "project-images",
        "client_badges_dir": assets / "badges",
        "build_log": pipe / "logs" / "build-log.md",
        "pipeline_state": pipe / "logs" / "pipeline-state.json",
    }


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def run(cmd: list[str], cwd: Path | None = None, check: bool = True) -> subprocess.CompletedProcess:
    print(f"$ {' '.join(cmd)}")
    return subprocess.run(cmd, cwd=cwd, check=check, text=True, capture_output=False)


# ----- step 1, clone template --------------------------------------------


def clone_template(site_dir: Path, source_template: Path) -> None:
    if site_dir.exists():
        print(f"site dir already exists, removing: {site_dir}")
        shutil.rmtree(site_dir)
    site_dir.parent.mkdir(parents=True, exist_ok=True)

    def ignore(_dir: str, names: list[str]) -> list[str]:
        return [n for n in names if n in {"node_modules", "dist", ".git", "niche-playbook"}]

    shutil.copytree(source_template, site_dir, ignore=ignore)
    print(f"cloned {source_template.relative_to(REPO_ROOT)} -> {site_dir}")


def copy_playbook_badges(niche_slug: str | None, site_dir: Path) -> int:
    """Copy `templates/{niche-slug}/niche-playbook/trust-badges/*` into
    `site_dir/public/badges/`. Returns badge count copied. No-op when the
    active build is the default template (no playbook).
    """
    playbook = niche_playbook_dir(niche_slug)
    if not playbook:
        return 0
    src = playbook / "trust-badges"
    if not src.exists():
        return 0
    dst = site_dir / "public" / "badges"
    dst.mkdir(parents=True, exist_ok=True)
    count = 0
    for badge_path in src.iterdir():
        if badge_path.is_file() and badge_path.suffix.lower() in {".svg", ".png", ".webp", ".jpg", ".jpeg"}:
            shutil.copyfile(badge_path, dst / badge_path.name)
            count += 1
    return count


def copy_client_photos_to_public(paths: dict[str, Path], site_dir: Path) -> dict[str, int]:
    """Copy scraped/dropped client photos into the per-client public/ tree so
    the niche-template's <img src='/work/...' /> + '/team/...' references resolve.

    Source layouts supported (any may be present):
      - assets/photos/projects/*  -> public/work/
      - assets/project-images/*   -> public/work/
      - assets/photos/team/*      -> public/team/
      - assets/founder-photos/*   -> public/team/ (legacy)

    Stage 9 hero outputs are handled separately by copy_hero_images (existing).
    """
    counts = {"work": 0, "team": 0}
    work_dst = site_dir / "public" / "work"
    team_dst = site_dir / "public" / "team"

    work_sources = [paths.get("projects_dir"), paths.get("project_images_dir")]
    for src in work_sources:
        if src and src.exists():
            work_dst.mkdir(parents=True, exist_ok=True)
            for p in src.iterdir():
                if p.is_file() and p.suffix.lower() in {".webp", ".jpg", ".jpeg", ".png"}:
                    shutil.copyfile(p, work_dst / p.name)
                    counts["work"] += 1

    team_sources = [paths.get("team_dir"), paths.get("founder_dir")]
    for src in team_sources:
        if src and src.exists():
            team_dst.mkdir(parents=True, exist_ok=True)
            for p in src.iterdir():
                if p.is_file() and p.suffix.lower() in {".webp", ".jpg", ".jpeg", ".png"}:
                    shutil.copyfile(p, team_dst / p.name)
                    counts["team"] += 1

    return counts


# ----- step 2, compose brand-dna.js ---------------------------------------
#
# Upstream stage outputs the compose function reads (and which fields each owns):
#
# - Pipeline Data/intake/intake-form.json  (Stage 1, 00-intake.md)
#   Keys: businessName, websiteUrl, phone, phoneNormalised, email, submittedAt
#   This is the LEAN intake — most data comes from research, not intake.
#
# - Pipeline Data/research/research.json  (Stage 2, 01-research.md)
#   Keys (per the research SKILL.md + 01-research.md pass gate):
#     businessName
#     googleReviewCount, googleRating
#     facebookReviewCount, facebookRating, facebookUrl
#     ownerName, ownerStory
#     hasMascot
#     businessModel.primaryFocus       (retail | insurance | both)
#     marketSegment.primaryFocus       (residential | commercial | both)
#     manufacturerCerts.{gaf, owens_corning, certainteed, tamko, ...}
#     specialOffers.{...}
#     financing.offered (bool)
#     brandGuidelines.hasFormalGuide
#     business_hours.{open, close, tz}
#     owner_cutout_url
#     brandVoice.keywords[]
#     serviceAreas[]
#     reviews[] (full review array)
#   GBP-specific keys may live under top-level (flat) OR nested under
#   `gbp.{...}` depending on agent output convention. The lookup helper
#   `pick_first` tolerates both.
#
# - Pipeline Data/strategy/strategy.json  (Stage 5, 04-strategy.md)
#   Keys: target_market, positioning, differentiators, primary_keywords,
#         secondary_keywords, competitor_gaps, services[], service_areas[]
#
# - Pipeline Data/brand/brand-dna.json  (Stage 7, brand-dna-agent.md)
#   Keys (post template-approach rewrite — schema at references/schemas/):
#     palette.{primary, primary_dark, accent, accent_light, accent_mid,
#              accent_dark, neutral, neutral_dim, ink, silver}
#     typography.{heading, body, headingFontUrl, bodyFontUrl}
#     theme_mode (light | dark)
#     voice_register (commercial | family | premium)
#     shape_motif (one of 13 patterns)
#     certifications.{gaf, owens_corning, certainteed, tamko, mule_hide, ...}
#     founder.{name, title, story, photo_filename, years_experience}
#     contact.{phone, email, address, address_url, hours}
#     hero.{eyebrow, headline, tagline, mood}
#     company_tagline
#
# - Pipeline Data/brand-resonance/resonance.json  (Stage 7.5, optional)
#   Keys: voice_description, photo_style_note, dominant_colors,
#         theme_mode_recommendation
#
# - Pipeline Data/copy/copy-deck.md  (Stage 6, 05-copy-deck.md)
#   Markdown, not JSON — section copy lives here. compose_brand_dna does
#   NOT parse this file directly; the copy-deck-agent should structure copy
#   into brand-dna.json under `copy.*` keys before this stage runs.


def pick_first(*candidates: Any) -> Any:
    """Return the first non-empty, non-None candidate. Empty string + dict + list count as empty."""
    for c in candidates:
        if c is None:
            continue
        if isinstance(c, str) and not c.strip():
            continue
        if isinstance(c, (list, dict)) and not c:
            continue
        return c
    return None


def get_path(obj: dict[str, Any], path: str, default: Any = None) -> Any:
    """Read 'a.b.c' style paths from a nested dict, tolerating missing nodes."""
    cur: Any = obj
    for key in path.split("."):
        if isinstance(cur, dict) and key in cur:
            cur = cur[key]
        else:
            return default
    return cur


def _parse_copy_deck(path: Path) -> dict[str, Any]:
    """Parse the Stage 6 copy-deck.md into structured per-page sections.

    The copy deck uses H2 headers like:
        ## RESIDENTIAL ROOFING (/services/residential-roofing)
        ## KELLER (/service-area/keller)
        ## BLOG: HOW TO SPOT HAIL DAMAGE ON YOUR ROOF (/blog/spot-hail-damage-on-your-roof)
        ## HOME (/)
        ## SERVICE PAGES                              <- skipped (separator)
        ## LOCATION PAGES                             <- skipped (separator)
        ## BLOG POSTS                                 <- skipped (separator)

    Returns:
        {
          "services":  { slug -> { title, body, faq[], related[] } },
          "locations": { slug -> { city, headline, subheadline, body, adjacent_cities[] } },
          "blogs":     { slug -> { title, hook, body, byline } },
        }

    Each `body` is plain markdown with `## ` H2 headings, `- ` bullets, and
    `*emphasis*` spans, ready for the React MarkdownBody renderer.
    """
    import re

    out = {"services": {}, "locations": {}, "blogs": {}, "home": {}}
    if not path.exists():
        return out

    text = path.read_text()
    # Split on H2 boundaries while keeping them
    parts = re.split(r"(?m)^## ", text)
    if not parts:
        return out

    SEPARATOR_HEADERS = {
        "service pages", "location pages", "blog posts",
        "reviews (master list)", "metadata",
    }

    for part in parts[1:]:  # parts[0] is the preamble before the first ##
        # First line is the heading; the rest is the body
        lines = part.split("\n", 1)
        heading = lines[0].strip()
        body_raw = lines[1] if len(lines) > 1 else ""

        # Skip separator headers (no slug)
        if heading.lower().strip() in SEPARATOR_HEADERS:
            continue

        # Extract slug from "(/path)" suffix
        slug_match = re.search(r"\(([^)]+)\)\s*$", heading)
        # Stage 6 sometimes writes the homepage section as `## Homepage` without
        # a trailing (/...) marker. Recognise that variant so the homepage FAQ
        # extractor can still run.
        if not slug_match:
            heading_norm = heading.strip().lower()
            if heading_norm in {"homepage", "home page", "home", "/", "/home"}:
                full_path = "/"
                title = "Home"
            else:
                continue
        else:
            full_path = slug_match.group(1).strip()
            title = re.sub(r"\s*\([^)]+\)\s*$", "", heading).strip()
            # Strip "BLOG: " prefix from blog titles
            title = re.sub(r"^BLOG:\s+", "", title, flags=re.IGNORECASE).strip()

        # Process the body: convert H3-with-bullet-list pattern into clean markdown.
        # The copy-deck uses:
        #   ### Section name
        #   - Field label: value
        #   - Field label: value
        # We convert each ### into ## and each "- Field label: value" into either
        # a clean paragraph (if value is prose) or a list item (if part of a list group).
        body = _normalise_section_body(body_raw)

        if full_path.startswith("/services/"):
            slug = full_path.replace("/services/", "").strip("/")
            # Pull FAQ Q/A pairs out of the body markdown so they can render in
            # a structured FAQAccordion at the end of the service page instead
            # of as flat ## + paragraph markdown that duplicates the accordion.
            stripped_body, faq_items = _extract_faq_from_body(body)
            out["services"][slug] = {"title": title, "body": stripped_body, "faq": faq_items}
        elif full_path.startswith("/service-area/"):
            slug = full_path.replace("/service-area/", "").strip("/")
            # Pull headline + subheadline from the Hero block, plus adjacent cities from body
            hero_h1 = _extract_field(body_raw, "H1 (bold)") or title
            hero_sub = _extract_field(body_raw, "Sub-H1") or ""
            adjacent = _extract_adjacent_cities(body_raw)
            out["locations"][slug] = {
                "city": title.title(),
                "slug": slug,
                "headline": hero_h1.replace("**", "").strip(),
                "subheadline": hero_sub.strip(),
                "body": body,
                "adjacent_cities": adjacent,
            }
        elif full_path.startswith("/blog/"):
            slug = full_path.replace("/blog/", "").strip("/")
            hook = _extract_field(body_raw, "Hook paragraph") or ""
            byline = _extract_field(body_raw, "Byline") or ""
            out["blogs"][slug] = {
                "title": title.title(),
                "hook": hook,
                "byline": byline,
                "body": body,
            }
        elif full_path == "/":
            # Capture the homepage FAQ block so the FAQ component renders the
            # copy-deck's actual Q/A pairs instead of the bad default fallback.
            # Stage 6 copy-decks write FAQ entries as:
            #   FAQ N
            #   - Q: ...
            #   - A: ...
            faq_items: list[dict[str, str]] = []
            faq_pattern = re.compile(
                r"^FAQ\s+\d+\s*\n+\s*-\s*Q:\s*(?P<q>.+?)\s*\n+\s*-\s*A:\s*(?P<a>.+?)(?=\n\s*\n|\n+(?:FAQ\s+\d+|###|##|\Z))",
                re.MULTILINE | re.DOTALL,
            )
            for m in faq_pattern.finditer(body_raw):
                q_text = re.sub(r"\s+", " ", m.group("q")).strip()
                a_text = re.sub(r"\s+", " ", m.group("a")).strip()
                if q_text and a_text:
                    faq_items.append({"q": q_text.upper(), "a": a_text})
            out["home"]["faq"] = faq_items

    # Merge sub-service slugs into umbrella service body when strategy
    # consolidates 8 services -> 3 (residential umbrella, commercial, exterior).
    # Lesson Rule 49 (09-build.md): legacy copy-decks still ship 8 H2 sections;
    # the merger folds the sub-service bodies into the relevant umbrella so
    # SEO long-tail intent (storm damage, insurance claim, inspection) lands on
    # the umbrella page instead of disappearing entirely. The umbrella page
    # picks up additional H2 sections derived from each sub-service body.
    out["services"] = _merge_subservice_slugs(out["services"])
    return out


# Canonical sub-service merger: maps an umbrella slug -> list of legacy
# sub-service slugs whose copy-deck body should be folded in. Order matters:
# the merge appends in this order beneath the umbrella's own body.
SUB_SERVICE_MERGE_MAP: dict[str, list[str]] = {
    "residential-roofing": [
        "storm-damage-restoration",
        "insurance-claims-assistance",
        "insurance-claims",
        "roof-inspections",
        "residential-roof-repair",
        "impact-resistant-shingles",
    ],
    "commercial-roofing": [
        "commercial-roof-maintenance",
        "tpo-roofing",
        "metal-roofing",
        "flat-roofing",
    ],
    "exterior-services": [
        "gutters",
        "gutter-installation",
        "siding",
        "siding-installation",
        "exterior-painting",
        "exterior-paint",
    ],
}


def _merge_subservice_slugs(services: dict[str, dict]) -> dict[str, dict]:
    """Fold sub-service bodies into umbrella service bodies and merge FAQs.

    For each umbrella slug in SUB_SERVICE_MERGE_MAP whose sub-slugs ARE present
    in the parsed copy-deck:
      1. Synth an empty umbrella entry if missing (e.g. exterior-services with
         only gutters + siding + painting in the copy-deck).
      2. For each sub-slug, wrap its body in HTML comment markers
         `<!-- SUBSERVICE_START: <Title> -->` / `<!-- SUBSERVICE_END -->`.
         The renderer in ServiceDetailPage picks these up and wraps each block
         in a visually-distinct sub-service zone (gold rule, eyebrow, larger
         heading) so the page reads as zones instead of one stacked stream.
      3. Merge each sub's parsed `faq[]` into the umbrella's `faq[]`,
         de-duplicated by question text (case-insensitive).
      4. Drop the sub-slug from the services dict.

    If no sub-slugs match (e.g. the copy-deck already ships only umbrella
    sections), this is a no-op.
    """
    if not services:
        return services
    for umbrella, sub_slugs in SUB_SERVICE_MERGE_MAP.items():
        present_subs = [s for s in sub_slugs if s in services]
        if not present_subs:
            continue
        if umbrella not in services:
            services[umbrella] = {
                "title": umbrella.replace("-", " ").title(),
                "body": "",
                "faq": [],
            }
        umbrella_entry = services[umbrella]
        umbrella_entry.setdefault("faq", [])
        merged_body = umbrella_entry.get("body", "") or ""
        merged_faq: list[dict[str, str]] = list(umbrella_entry.get("faq") or [])
        seen_q = {item["q"].lower().strip() for item in merged_faq}
        for sub_slug in present_subs:
            sub = services.get(sub_slug)
            if not sub:
                continue
            sub_title = sub.get("title", sub_slug.replace("-", " ").title())
            # Title-case the sub-title nicely (was UPPER from the H2 heading)
            sub_title_clean = " ".join(
                w if w.isupper() and len(w) <= 3 else w.capitalize()
                for w in sub_title.split()
            )
            sub_body = (sub.get("body", "") or "").strip()
            # Drop a leading ## H2 that duplicates the title
            if sub_body.startswith("## "):
                first_nl = sub_body.find("\n")
                sub_body = sub_body[first_nl + 1:].strip() if first_nl != -1 else ""
            if sub_body:
                merged_body = (
                    merged_body.rstrip()
                    + f"\n\n<!-- SUBSERVICE_START: {sub_title_clean} -->\n\n"
                    + sub_body
                    + f"\n\n<!-- SUBSERVICE_END -->"
                )
            # Pull each sub's FAQ items into the umbrella faq, de-duped
            for item in (sub.get("faq") or []):
                qkey = item.get("q", "").lower().strip()
                if not qkey or qkey in seen_q:
                    continue
                seen_q.add(qkey)
                merged_faq.append(item)
            del services[sub_slug]
        umbrella_entry["body"] = merged_body
        umbrella_entry["faq"] = merged_faq
    return services


def _extract_faq_from_body(body: str) -> tuple[str, list[dict[str, str]]]:
    """Extract FAQ Q/A pairs out of an already-normalised body markdown.

    The body that emerges from `_normalise_section_body` represents copy-deck
    `### Service FAQ` blocks as either:

      Format A (bold-question then paragraph answer):
        ## Common Questions

        **Will my insurance cover a new roof?**

        It depends on whether the damage is from a covered peril.

        **Can you match my existing shingle colour?**

        For repairs, usually yes...

      Format B (list-item with bold question + inline answer):
        ## Common Questions

        - **Will my insurance cover a new roof?** It depends on whether...
        - **Can you match my existing shingle colour?** For repairs, usually yes...

      Format C (paragraph pairs without bolding, as Stage 6 currently writes
      from the `Q1:` / `A1:` bullet pattern):
        ## Common Questions

        Will my insurance cover a new roof?

        It depends on whether the damage is from a covered peril.

    The function:
      1. Locates any H2 whose title matches faq/frequently asked/common questions/
         service faq (case-insensitive).
      2. Parses every Q/A pair inside that section (until next ## or end of body).
      3. Strips the entire FAQ block out of the returned body.
      4. Returns (stripped_body, [{q, a}, ...]).

    Multiple FAQ sections in the same body (e.g. after sub-service merge) are
    all collected; the body is left with NONE remaining.
    """
    import re

    if not body:
        return body, []

    faq_pat = re.compile(r"^##\s+(faq|frequently asked questions?|common questions?|service faq)\s*$", re.IGNORECASE)
    lines = body.split("\n")
    # Find every FAQ-block boundary
    faq_blocks: list[tuple[int, int]] = []  # (start_line_inclusive, end_line_exclusive)
    i = 0
    while i < len(lines):
        if faq_pat.match(lines[i].strip()):
            start = i
            j = i + 1
            while j < len(lines) and not lines[j].lstrip().startswith("## "):
                j += 1
            faq_blocks.append((start, j))
            i = j
        else:
            i += 1

    if not faq_blocks:
        return body, []

    items: list[dict[str, str]] = []
    seen_questions: set[str] = set()

    def _push(q_raw: str, a_raw: str) -> None:
        q = q_raw.strip().rstrip(":").rstrip(".").strip()
        # Strip surrounding bold/italic markdown
        q = re.sub(r"^\*+|\*+$", "", q).strip()
        # Restore terminal punctuation: questions should end with ?
        if q and not q.endswith("?"):
            q = q + "?"
        a = a_raw.strip()
        if not q or not a:
            return
        key = q.lower()
        if key in seen_questions:
            return
        seen_questions.add(key)
        items.append({"q": q, "a": a})

    for start, end in faq_blocks:
        block_lines = lines[start + 1:end]  # skip the H2 itself
        # First, try Format B (list bullets with inline answer)
        bullet_pat = re.compile(r"^\s*-\s*\*\*(.+?)\*\*\s*[:\-—]?\s*(.*)$")
        any_bullet = False
        for bl in block_lines:
            bm = bullet_pat.match(bl)
            if bm:
                any_bullet = True
                _push(bm.group(1), bm.group(2))
        if any_bullet:
            continue

        # Format A or C: walk paragraph-by-paragraph (blank-line separated)
        paragraphs: list[str] = []
        buf: list[str] = []
        for bl in block_lines:
            if bl.strip() == "":
                if buf:
                    paragraphs.append(" ".join(buf).strip())
                    buf = []
            else:
                buf.append(bl.strip())
        if buf:
            paragraphs.append(" ".join(buf).strip())

        # Pair questions with answers. A question paragraph is one wrapped in
        # **bold** OR one ending with "?" OR one short and clearly interrogative.
        k = 0
        while k < len(paragraphs):
            p = paragraphs[k]
            # Skip stray Sub-H2 prose lines
            if not p:
                k += 1
                continue
            # Strip surrounding bold/italic for detection
            stripped = re.sub(r"^\*+|\*+$", "", p).strip()
            is_bold = p.startswith("**") and p.endswith("**")
            looks_like_question = is_bold or stripped.endswith("?")
            if looks_like_question and k + 1 < len(paragraphs):
                _push(stripped, paragraphs[k + 1])
                k += 2
            else:
                k += 1

    # Strip every FAQ block out of the body (work backwards so indices stay valid)
    new_lines = lines[:]
    for start, end in reversed(faq_blocks):
        # Also drop any trailing blank lines immediately after the FAQ block
        e = end
        while e < len(new_lines) and not new_lines[e].strip():
            e += 1
        del new_lines[start:e]
    # Collapse runs of blank lines to at most one
    cleaned: list[str] = []
    blank_run = False
    for ln in new_lines:
        if ln.strip() == "":
            if not blank_run:
                cleaned.append("")
            blank_run = True
        else:
            cleaned.append(ln)
            blank_run = False
    return "\n".join(cleaned).strip(), items


def _extract_field(body_raw: str, label: str) -> str:
    """Pull a single 'Label: value' line out of the raw section text."""
    import re
    m = re.search(rf"(?im)^-?\s*{re.escape(label)}\s*:\s*(.+?)$", body_raw, re.MULTILINE)
    return m.group(1).strip() if m else ""


def _extract_adjacent_cities(body_raw: str) -> list[str]:
    """Find an 'Adjacent city links: A, B, C' line and return the list."""
    raw = _extract_field(body_raw, "Adjacent city links")
    if not raw:
        return []
    return [c.strip() for c in raw.split(",") if c.strip()]


def _normalise_section_body(body_raw: str) -> str:
    """Convert copy-deck section structure into renderable markdown.

    Input pattern:
        ### Section heading
        - Field label: value
        - Body: long prose paragraph
        - Body paragraph 1: ...
        - Body paragraph 2: ...
        - H2: heading text
        - Sub-H2: subheading text

    Output:
        ## Section heading

        long prose paragraph

        ...

    We strip the redundant micro-labels (H1/H2/Sub-H1/Sub-H2/Body/Body paragraph N
    /Hero CTA / Hero benefit chip / Meta / Page title / Meta description / etc),
    keeping the actual prose as paragraphs separated by blank lines.
    """
    import re

    # H3 section names that contain no useful render content (Meta, Hero, etc.) —
    # we DROP these entirely, since the content underneath is structural metadata
    # already surfaced via the page hero or meta tags above.
    skip_h3_sections = {
        "meta", "hero", "nav", "topbar", "hero contact form", "footer",
        "contact form", "service ctas", "service cta", "location cta",
        "map block", "ctabanner", "cta banner",
        "trustsstrip (press + credentials)", "truststrip (press + credentials)",
        "owner section cta",
    }

    # Working-title rename map. Stage 6 copy-deck uses internal labels like
    # "Problem-Aware Intro" or "Pricing Transparency" so the writer knows the
    # function of each section. Those internal labels are NOT user-facing
    # headings — promote the prose to a more natural h2 (or strip the
    # heading entirely with empty string ""). Add new mappings here when a
    # new working-title leaks into a service-detail page.
    rename_h3 = {
        "problem-aware intro": "",  # drop heading, just render the prose
        "problem aware intro": "",
        "what's different about us": "What Makes Us Different",
        "what's different": "What Makes Us Different",
        "what we do differently": "What Makes Us Different",
        "pricing transparency": "What This Costs",
        "pricing": "What This Costs",
        "transparent pricing": "What This Costs",
        "faq — plain english": "Common Questions",
        "faq plain english": "Common Questions",
        "frequently asked questions": "Common Questions",
        "faq": "Common Questions",
        "service faq": "Common Questions",
        "common questions": "Common Questions",
        "process overview": "How It Works",
        "our process": "How It Works",
        "service overview": "",  # drop heading, prose becomes the lead
        "intro": "",
        "introduction": "",
        "lead paragraph": "",
        "what to expect": "What You Should Expect",
        "next steps": "Your Next Step",
        "call to action": "",  # CTAs are rendered separately
        # Internal copy-deck working titles that must NEVER reach a user-facing
        # H2. Stage 6 sometimes leaves these in service / about / location
        # bodies as section labels for the writer's reference. Drop the
        # heading entirely and promote the prose to a lead paragraph.
        "audience reframe": "",
        "audience audit": "",
        "voice lock": "",
        "voice notes": "",
        "tone notes": "",
        "page brief": "",
        "brief": "",
        "working title": "",
        "section notes": "",
        "editorial notes": "",
    }

    # Bullet-line label prefixes whose VALUES we drop entirely.
    skip_label_prefixes = (
        "Page title", "Meta description", "H1", "Sub-H1", "Hero CTA",
        "Hero benefit chip", "Hero benefit", "Field label", "Field placeholder",
        "Submit button", "Privacy line", "Thank-you message", "Logo",
        "Strip intro", "Aggregate line", "See-all button", "Review pill",
        "Form pre-headline", "Form sub-text", "Primary CTA button",
        "Secondary CTA", "CTA button", "Owner section CTA",
        "Map caption", "Quote attribution", "Adjacent city links",
        "Available-now phrase", "Primary nav CTA", "Nav phone", "Nav items",
        "License badge", "Quantified trust line",
        "Service tile", "Byline",
    )

    # Pre-pass: split into section blocks bounded by ### headings, so we can drop
    # entire empty/structural sections instead of leaving stranded `## X` headings.
    section_pat = re.compile(r"^### (.+)$", re.MULTILINE)
    sections: list[tuple[str, str]] = []  # (h3_title, body_text)
    matches = list(section_pat.finditer(body_raw))
    if not matches:
        sections.append(("", body_raw))
    else:
        # Body before first ### -> attached to ""
        if matches[0].start() > 0:
            sections.append(("", body_raw[:matches[0].start()]))
        for i, m in enumerate(matches):
            title = m.group(1).strip()
            title = re.sub(r"\s*\([^)]+\)\s*$", "", title)
            body_start = m.end()
            body_end = matches[i + 1].start() if i + 1 < len(matches) else len(body_raw)
            sections.append((title, body_raw[body_start:body_end]))

    out_blocks: list[str] = []
    pending_label_title: str | None = None  # for "Reason 1 title" -> "Reason 1 body" pairing

    for h3_title, sec_body in sections:
        # Drop sections with no useful content
        if h3_title.lower() in skip_h3_sections:
            continue

        # Rename working-title sections to user-facing headings (or drop the
        # heading entirely when value is "" so the body promotes naturally).
        rename_to = rename_h3.get(h3_title.lower())
        if rename_to is not None:
            h3_title = rename_to

        # Convert this section's body into a list of (kind, text) blocks
        section_blocks: list[tuple[str, str | list[str]]] = []
        bullet_buffer: list[str] = []  # accumulate consecutive title-only bullets into a list

        def flush_bullets():
            if bullet_buffer:
                section_blocks.append(("list", bullet_buffer.copy()))
                bullet_buffer.clear()

        for raw_line in sec_body.splitlines():
            line = raw_line.rstrip()
            if not line.strip():
                continue
            m = re.match(r"^-\s+([^:]+?):\s*(.+)$", line)
            if not m:
                # Non-bullet free-text line
                flush_bullets()
                section_blocks.append(("p", line))
                continue
            label = m.group(1).strip()
            value = m.group(2).strip().replace("**", "")
            if any(label.startswith(p) for p in skip_label_prefixes):
                continue
            # Q1: question text  /  A1: answer text  -> promote to bold-question
            # paragraph followed by a plain paragraph so the FAQ extractor
            # downstream can pair them and so the renderer (if extraction misses)
            # at least surfaces the question prominently.
            q_match = re.match(r"^Q\d+$", label, re.IGNORECASE)
            a_match = re.match(r"^A\d+$", label, re.IGNORECASE)
            if q_match:
                flush_bullets()
                # Ensure trailing question mark
                qv = value.rstrip(".").rstrip("?").strip() + "?"
                section_blocks.append(("p", f"**{qv}**"))
                continue
            if a_match:
                flush_bullets()
                section_blocks.append(("p", value))
                continue
            # Promote H2/Sub-H2 lines
            if label == "H2" or label.startswith("H2"):
                flush_bullets()
                section_blocks.append(("h2", value.replace("*", "")))
                continue
            if label.startswith("Sub-H2"):
                flush_bullets()
                section_blocks.append(("p", value))
                continue
            # Long-form prose lines — definitely paragraphs, not bullets
            if label.startswith("Body") or label in ("Hook paragraph", "Intro paragraph", "Vision", "Mission", "Story paragraph 1", "Story paragraph 2"):
                flush_bullets()
                section_blocks.append(("p", value))
                continue
            if label.startswith("Quote"):
                flush_bullets()
                section_blocks.append(("p", f"*\"{value}\"*"))
                continue
            # "Reason 1 title" / "Damage type 1 title" / "Decision point 1 title" /
            # "Option 1 title" / "Tile 1 title" — pair with the body that follows.
            if re.search(r"\b(title)\b", label, re.IGNORECASE):
                pending_label_title = value
                continue
            if re.search(r"\b(body)\b", label, re.IGNORECASE) and pending_label_title:
                flush_bullets()
                section_blocks.append(("p", f"*{pending_label_title}.* {value}"))
                pending_label_title = None
                continue
            # Bare list item (e.g. simple bullet with title only)
            bullet_buffer.append(value)
        flush_bullets()

        # If the section produced no rendered blocks, skip the H3 too
        if not section_blocks:
            continue

        # Emit the H3 as a ## heading, then the blocks
        if h3_title:
            out_blocks.append(("h2", h3_title))
        for kind, payload in section_blocks:
            out_blocks.append((kind, payload))

    # Render
    rendered: list[str] = []
    for kind, payload in out_blocks:
        if kind == "h2":
            rendered.append(f"## {payload}")
        elif kind == "list":
            rendered.append("\n".join(f"- {item}" for item in payload))
        else:  # 'p'
            rendered.append(payload)

    # Drop consecutive duplicate H2s (which can happen when an H3 then an H2 line
    # both contain the same heading text)
    deduped: list[str] = []
    for blk in rendered:
        if deduped and blk.startswith("## ") and deduped[-1].startswith("## "):
            # Replace the previous heading with the more specific one
            deduped[-1] = blk
            continue
        if not deduped or deduped[-1] != blk:
            deduped.append(blk)
    return "\n\n".join(deduped).strip()


def _build_press_logos(research: dict[str, Any], brand_dna_in: dict[str, Any]) -> list[dict[str, str]]:
    """Build a text-only fallback for the TrustStrip when no manufacturer cert
    badges are available. Sources:
      - research.press[]                 -> "Featured in <publication>"
      - research.licenseNumber           -> "<state> RCAT Licensed #..."  (already prefixed)
      - research.yearFounded             -> "Family-Owned Since 2018"

    Google review rating + count are intentionally NOT included here. Hero
    already shows a 4.9★ Google + Facebook pill cluster, and TrustStrip's
    rotating claims carry the same signal. A third surface repeating "4.9★ on
    Google (63 verified reviews)" reads as filler. Only render the Google line
    if NO other press/license/tenure credential exists, so the press strip
    isn't empty for clients without press coverage.
    """
    logos: list[dict[str, str]] = []
    press = research.get("press") or []
    for p in press:
        if isinstance(p, str) and p.strip():
            logos.append({"label": p.strip().upper()})

    license_full = research.get("license") or get_path(brand_dna_in, "trust.license_number") or ""
    license_num = research.get("licenseNumber") or ""
    if license_full:
        logos.append({"label": str(license_full).upper()})
    elif license_num:
        logos.append({"label": f"LICENSED #{license_num}".upper()})

    year = research.get("yearFounded") or research.get("founding_year")
    if year:
        logos.append({"label": f"FAMILY-OWNED SINCE {year}".upper()})

    # Last-resort fallback: only emit Google review credential when the press
    # strip would otherwise be empty (no press, no license, no tenure).
    if not logos:
        rating = research.get("googleRating") or get_path(brand_dna_in, "trust.google_rating")
        count = research.get("googleReviewCount") or get_path(brand_dna_in, "trust.google_review_count")
        if rating and count:
            logos.append({"label": f"{rating}★ ON GOOGLE ({count} VERIFIED REVIEWS)".upper()})

    return logos


def _compose_real_reviews(paths: dict[str, Path], rating_fallback: float = 5.0) -> list[dict[str, Any]]:
    """Pull verbatim reviews from the Apify raw scrapes per 05-copy-deck.md Rule 2.

    Reads `raw-google.json` (Apify google-maps-scraper items[0].reviews) and
    `raw-facebook.json` (Apify facebook-reviews-scraper items[*]) when present.
    Filters per the rule: 5-star, specific praise, recent (2024+), real first
    + last name, mix of services. Returns 6-8 reviews biased toward the
    higher-volume platform. Output shape per review:
      {author, source, rating, text, date}
    where `source` is "google" | "facebook" so downstream Reviews.jsx can
    badge per-platform.

    Returns empty list when both scrapes are unavailable; the caller decides
    whether to log a warning or render the section empty.
    """
    import re

    google = read_json(paths.get("raw_google", Path("/nonexistent")))
    facebook = read_json(paths.get("raw_facebook", Path("/nonexistent")))

    # Google reviews live at items[0].reviews per the Apify schema
    g_reviews_raw: list[dict[str, Any]] = []
    g_items = google.get("items") if isinstance(google, dict) else []
    if isinstance(g_items, list) and g_items:
        first = g_items[0]
        if isinstance(first, dict) and isinstance(first.get("reviews"), list):
            g_reviews_raw = first["reviews"]

    # Facebook reviews: structure varies. Apify facebook-reviews-scraper emits
    # items[*] as flat review objects; native_fallback variants carry a
    # metadata-only items[0] with no review text (filtered out below).
    f_reviews_raw: list[dict[str, Any]] = []
    f_items = facebook.get("items") if isinstance(facebook, dict) else []
    if isinstance(f_items, list):
        for it in f_items:
            if isinstance(it, dict) and (it.get("text") or it.get("review")):
                f_reviews_raw.append(it)

    specific_kw = re.compile(
        r"\b(fair|honest|professional|recommend|craftsmanship|quality|excellent|"
        r"gutter|siding|window|chimney|insulation|shingle|slate|roof|"
        r"insurance|claim|estimate|fast|quick|crew|team|owner|leak|repair|"
        r"replace|install)\b",
        re.I,
    )

    def _is_real_name(name: str) -> bool:
        if not name:
            return False
        n = name.strip().lower()
        if not n or n == "google user" or n.startswith("a ") or len(n) < 4:
            return False
        parts = name.strip().split()
        return len(parts) >= 2

    def _parse_date(r: dict[str, Any]) -> str:
        return (
            r.get("publishedAtDate")
            or r.get("date")
            or r.get("publishDate")
            or "0000-00-00"
        )

    def _filter(raw_list: list[dict[str, Any]], source_label: str) -> list[dict[str, Any]]:
        out = []
        for r in raw_list:
            text = (r.get("text") or r.get("review") or "").strip()
            if not text or len(text) < 60 or len(text) > 400:
                continue
            stars = r.get("stars") or r.get("rating") or r.get("starRating") or 0
            try:
                stars_n = int(float(stars))
            except (TypeError, ValueError):
                stars_n = 0
            if stars_n != 5:
                continue
            name = (r.get("name") or r.get("reviewerName") or r.get("author") or "").strip()
            if not _is_real_name(name):
                continue
            if not specific_kw.search(text):
                continue
            date = _parse_date(r)[:10]
            if not date.startswith(("2024", "2025", "2026")):
                continue
            out.append({
                "author": name,
                "source": source_label,
                "rating": 5,
                "text": text.replace("\n", " ").strip()[:280].strip(),
                "date": date,
            })
        # Sort newest-first
        out.sort(key=lambda r: r["date"], reverse=True)
        return out

    g_filtered = _filter(g_reviews_raw, "google")
    f_filtered = _filter(f_reviews_raw, "facebook")

    if not g_filtered and not f_filtered:
        return []

    # Pick 6 from the higher-volume platform + 2 from the other when possible.
    # Mix the per-platform count proportionally to total reviews.
    # Capped at 8 total to match 05-copy-deck.md Rule 2 default.
    chosen = []
    if len(g_filtered) >= len(f_filtered):
        chosen.extend(g_filtered[:6])
        chosen.extend(f_filtered[:2])
    else:
        chosen.extend(f_filtered[:6])
        chosen.extend(g_filtered[:2])

    # Pad from the bigger pool if we ended below 6
    while len(chosen) < 6 and len(g_filtered) > len(chosen):
        nxt = g_filtered[len(chosen)] if len(chosen) < len(g_filtered) else None
        if not nxt or any(c["text"] == nxt["text"] for c in chosen):
            break
        chosen.append(nxt)

    return chosen[:8]


def _compose_services_from_website_scrape(paths: dict[str, Path]) -> list[dict[str, Any]]:
    """Extract distinct services from the Apify website scrape per 01-research.md Rule 1.

    Reads `raw-websites.json` items[0] (the client's own site) for
    `primaryServices[]`. Bundles synonyms into canonical trade categories
    (roof-* -> roofing, attic-insulation -> insulation, etc.) so distinct
    nav-level trades stay distinct (per 04-strategy.md Rule 2) but minor
    sub-service variants don't fragment the array.

    Returns a list of `{name, slug, blurb, url}` entries the build composer can
    drop into brandDNA.services[].
    """
    websites = read_json(paths.get("raw_websites", Path("/nonexistent")))
    items = websites.get("items") if isinstance(websites, dict) else []
    if not isinstance(items, list) or not items:
        return []

    # The client's own site is whichever item has isClient=True (Apify
    # convention) or is the first entry that holds primaryServices.
    client_item = None
    for it in items:
        if isinstance(it, dict) and it.get("isClient") and it.get("primaryServices"):
            client_item = it
            break
    if not client_item:
        for it in items:
            if isinstance(it, dict) and it.get("primaryServices"):
                client_item = it
                break
    if not client_item:
        return []

    primary = client_item.get("primaryServices") or []
    base_url = client_item.get("url") or ""
    if not isinstance(primary, list) or not primary:
        return []

    # Canonical trade buckets, contractor / home-services default.
    # For non-contractor niches, the per-niche playbook at
    # `templates/{active-niche-slug}/niche-playbook/` may supply its own
    # service taxonomy; this function returns an empty list when none of
    # the keywords below match the client's primary services, which is the
    # graceful-degrade path for unrelated niches.
    BUCKETS = [
        {
            "slug": "roofing",
            "name": "Roofing",
            "keywords": ["roof", "shingle", "slate", "metal", "tile", "tpo", "leak", "fascia"],
            "blurb": "Roof installation, repair, inspection, and leak detection.",
        },
        {
            "slug": "siding",
            "name": "Siding",
            "keywords": ["siding", "vinyl", "fiber cement", "cladding"],
            "blurb": "Siding installation and repair; energy-efficient cladding.",
        },
        {
            "slug": "windows",
            "name": "Windows",
            "keywords": ["window"],
            "blurb": "Window replacement, repair, and installation.",
        },
        {
            "slug": "gutters",
            "name": "Gutters",
            "keywords": ["gutter", "downspout"],
            "blurb": "Gutters, gutter guards, and downspout systems.",
        },
        {
            "slug": "insulation",
            "name": "Insulation",
            "keywords": ["insulation", "attic"],
            "blurb": "Attic insulation for year-round energy efficiency.",
        },
        {
            "slug": "chimneys",
            "name": "Chimneys",
            "keywords": ["chimney"],
            "blurb": "Chimney repair, repointing, and waterproofing.",
        },
    ]
    # Track which buckets actually surface from the client's primary service list
    found = {}  # slug -> dict
    for raw in primary:
        if not isinstance(raw, str) or not raw.strip():
            continue
        low = raw.lower()
        for b in BUCKETS:
            if any(k in low for k in b["keywords"]):
                if b["slug"] not in found:
                    found[b["slug"]] = {
                        "name": b["name"],
                        "slug": b["slug"],
                        "blurb": b["blurb"],
                        "url": f"{base_url.rstrip('/')}/{b['slug']}/",
                        "icon_name": _service_icon(b["slug"]),
                    }
                break

    # Preserve the order from BUCKETS (Roofing first, etc.)
    return [found[b["slug"]] for b in BUCKETS if b["slug"] in found]


def _service_icon(slug: str) -> str:
    """Map a service slug to a the website template icon registry key."""
    MAP = {
        "roofing": "home",
        "siding": "layout-grid",
        "windows": "rectangle-horizontal",
        "gutters": "minus",
        "insulation": "wind",
        "chimneys": "building",
    }
    return MAP.get(slug, "home")


def compose_brand_dna(client_name: str, paths: dict[str, Path]) -> dict[str, Any]:
    """
    Read every upstream pipeline output for this client and return the brand-dna
    object that gets serialised to src/config/brand-dna.js.

    Field-resolution strategy: every per-client value tries multiple field paths
    via pick_first(). If all paths are empty, the value falls back to a
    `__REQUIRED__` sentinel that the validator (inject-theme.mjs prebuild hook)
    catches loudly so the failure surfaces with a precise field path. Edit the
    upstream stage that owns the missing field, OR add a new path candidate
    here if a stage's schema legitimately diverged.
    """
    intake = read_json(paths["intake"])
    research = read_json(paths["research"])
    strategy = read_json(paths["strategy"])
    sitemap = read_json(paths["sitemap"])
    # Merge sitemap.blog_posts into strategy so _build_blog_posts() finds them
    if sitemap.get("blog_posts") and not strategy.get("blog_posts"):
        strategy["blog_posts"] = sitemap["blog_posts"]
    brand_dna_in = read_json(paths["brand_dna_json"])
    resonance = read_json(paths["resonance"])
    copy_sections = _parse_copy_deck(paths["copy_deck"])

    REQ = "__REQUIRED__"

    palette = brand_dna_in.get("palette", {})
    typography = brand_dna_in.get("typography", {})

    # Company identity
    company_name = pick_first(
        intake.get("businessName"),
        get_path(intake, "business.legal_name"),
        intake.get("company_name"),
        research.get("businessName"),
        get_path(research, "gbp.name"),
        client_name,
    )
    short_name = company_name.split(" ")[0] if company_name else client_name

    # Contact
    phone = pick_first(
        intake.get("phone"),
        get_path(intake, "business.phone"),
        research.get("phone"),
        get_path(research, "gbp.phone"),
        get_path(brand_dna_in, "contact.phone"),
        REQ,
    )
    phone_normalised = pick_first(
        intake.get("phoneNormalised"),
        get_path(brand_dna_in, "contact.phoneTelLink"),
    )
    if phone_normalised:
        phone_tel_link = phone_normalised if phone_normalised.startswith("+") else f"+1{phone_normalised}"
    elif phone and phone != REQ:
        digits = "".join(c for c in str(phone) if c.isdigit())
        phone_tel_link = f"+1{digits}" if digits else REQ
    else:
        phone_tel_link = REQ
    email = pick_first(
        intake.get("email"),
        get_path(intake, "business.email"),
        research.get("email"),
        get_path(brand_dna_in, "contact.email"),
        REQ,
    )

    # Address (research may store it flat OR nested under gbp OR as a single fullAddress string)
    street = pick_first(get_path(research, "gbp.street"), research.get("street"), get_path(brand_dna_in, "address.street"))
    city = pick_first(get_path(research, "gbp.city"), research.get("city"), get_path(brand_dna_in, "address.city"))
    state = pick_first(get_path(research, "gbp.state"), research.get("state"), get_path(brand_dna_in, "address.state"))
    zip_code = pick_first(get_path(research, "gbp.zip"), research.get("zip"), get_path(brand_dna_in, "address.zip"))
    address_full = pick_first(
        get_path(research, "gbp.address"),
        research.get("fullAddress"),
        research.get("address"),
        get_path(brand_dna_in, "contact.address"),
        get_path(intake, "business.address"),
    )
    if not address_full and street:
        address_full = f"{street}, {city}, {state} {zip_code}".strip(", ")
    # PARSE address_full when individual fields are missing (e.g. "8376 Davis Blvd suite 249, North Richland Hills, TX 76182")
    if address_full and (not street or not city or not state or not zip_code):
        import re
        m = re.match(r"^(.+?),\s*(.+?),\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\s*$", address_full.strip())
        if m:
            street = street or m.group(1).strip()
            city = city or m.group(2).strip()
            state = state or m.group(3).strip()
            zip_code = zip_code or m.group(4).strip()

    # Hours
    hours_obj = pick_first(brand_dna_in.get("hours"), research.get("business_hours"))
    if isinstance(hours_obj, dict) and "open" in hours_obj and "close" in hours_obj:
        # Legacy flat shape: {"open": "07:00", "close": "17:00", "tz": "America/Phoenix"}
        weekday = {"dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], "opens": hours_obj["open"], "closes": hours_obj["close"]}
        display = [
            {"label": "Monday – Friday", "value": f"{hours_obj['open']} – {hours_obj['close']}"},
        ]
        hours_block = {"weekday": weekday, "saturday": None, "display": display, "emergencyBadge": None}
    elif isinstance(hours_obj, dict) and "weekday" in hours_obj:
        # Already in template shape
        hours_block = hours_obj
    else:
        # Sensible default
        hours_block = {
            "weekday": {"dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"], "opens": "07:00", "closes": "17:00"},
            "saturday": None,
            "display": [],
            "emergencyBadge": get_path(research, "specialOffers.emergencyLabel") or (get_path(research, "specialOffers.emergency") and "24/7 Emergency Service Available") or None,
        }

    # Reviews + social
    google_count = pick_first(research.get("googleReviewCount"), get_path(research, "gbp.review_count"), 0)
    google_rating = pick_first(research.get("googleRating"), get_path(research, "gbp.rating"), 5.0)
    fb_count = pick_first(research.get("facebookReviewCount"), get_path(research, "social.facebook_review_count"), 0)
    fb_rating = pick_first(research.get("facebookRating"), get_path(research, "social.facebook_rating"), 5.0)
    fb_url = pick_first(research.get("facebookUrl"), get_path(research, "social.facebook_url"))
    fb_reviews_url = pick_first(get_path(research, "social.facebook_reviews_url"), f"{fb_url}/reviews" if fb_url else None)
    # Reviews — verbatim Google + Facebook per 05-copy-deck.md Rule 2.
    # Priority: brand-dna seed -> research.reviews -> real Apify raw scrapes.
    # NEVER fabricate placeholder reviews per Rule 2.
    review_items = pick_first(get_path(brand_dna_in, "reviews.items"), research.get("reviews")) or []
    if not review_items:
        review_items = _compose_real_reviews(paths, rating_fallback=google_rating)
    if not review_items:
        print("[WARN] No verbatim reviews available (Apify raw-google/raw-facebook empty). Reviews.jsx will render nothing.", flush=True)

    # Founder
    founder_name = pick_first(research.get("ownerName"), get_path(brand_dna_in, "founder.name"), REQ)
    founder_title = pick_first(get_path(brand_dna_in, "founder.title"), "Founder & CEO")
    founder_story = pick_first(research.get("ownerStory"), get_path(brand_dna_in, "founder.story")) or ""

    # Services — sourcing chain per 01-research.md Rule 1 + 04-strategy.md Rule 2:
    # 1. research.services_offered[]  (Apify website scrape, every distinct trade)
    # 2. strategy.services[]          (Stage 5 strategy.json)
    # 3. brand_dna_in.services        (manual brand-dna.json overlay)
    # 4. raw-websites.json fallback   (primaryServices from Apify, last resort)
    # Distinct trade categories (siding, windows, etc.) NEVER merge into a
    # generic exterior-services umbrella — Rule 2 in 04-strategy.md is explicit.
    services_offered = research.get("services_offered") if isinstance(research.get("services_offered"), list) else None
    services_from_strategy = strategy.get("services") if isinstance(strategy.get("services"), list) else None
    services_from_brand = brand_dna_in.get("services") if isinstance(brand_dna_in.get("services"), list) else None

    if services_offered and len(services_offered) >= 3:
        services = services_offered
    elif services_from_strategy and len(services_from_strategy) >= 3:
        services = services_from_strategy
    elif services_from_brand and len(services_from_brand) >= 1:
        services = services_from_brand
    else:
        # Last-resort: extract from the raw Apify website scrape
        from_scrape = _compose_services_from_website_scrape(paths)
        services = from_scrape or services_from_strategy or services_from_brand or []
    service_areas = pick_first(strategy.get("service_areas"), research.get("serviceAreas")) or []

    # Enrich each service with the markdown body parsed from copy-deck (Stage 6).
    # Tolerates Stage 5 vs Stage 6 slug naming drift: if the exact slug isn't found
    # in the copy-deck, fall back to a fuzzy prefix/contains match. This handles
    # cases like strategy=insurance-claims-assistance vs copy-deck=insurance-claims.
    copy_service_keys = list((copy_sections.get("services") or {}).keys())

    def _match_service_section(svc_slug: str) -> dict | None:
        sec = copy_sections.get("services", {}).get(svc_slug)
        if sec:
            return sec
        for cand in copy_service_keys:
            if svc_slug.startswith(cand) or cand.startswith(svc_slug) or svc_slug.replace("-", "") == cand.replace("-", ""):
                fuzzy = copy_sections["services"].get(cand)
                if fuzzy:
                    return fuzzy
        return None

    for svc in services:
        slug = svc.get("slug")
        if not slug:
            continue
        sec = _match_service_section(slug)
        if not sec:
            continue
        if not svc.get("body") and sec.get("body"):
            svc["body"] = sec["body"]
        # Propagate parsed FAQ from copy-deck. The umbrella merge step in
        # _merge_subservice_slugs has already folded each sub-service's FAQ
        # into the umbrella entry's faq[] (de-duped by question), so the umbrella
        # service inherits the full union of FAQ items across its sub-services.
        if not svc.get("faq") and sec.get("faq"):
            svc["faq"] = sec["faq"]

    # Location pages (per /service-area/[slug]) — full markdown body + adjacent cities
    location_pages = list((copy_sections.get("locations") or {}).values())

    # Trust badges (resolved from templates/{niche-slug}/niche-playbook/trust-signals.json by certifications)
    certifications = pick_first(brand_dna_in.get("certifications"), research.get("manufacturerCerts")) or {}

    brand_dna = {
        "meta": {
            "title": pick_first(
                get_path(brand_dna_in, "meta.title"),
                f"{company_name}" + (f" | {city}, {state}" if city and state else ""),
            ),
            "description": pick_first(
                get_path(brand_dna_in, "meta.description"),
                REQ,
            ),
        },
        "company": {
            "name": company_name,
            "shortName": short_name,
            "tagline": pick_first(
                brand_dna_in.get("company_tagline"),
                brand_dna_in.get("tagline"),
                get_path(strategy, "positioning.tagline"),
                REQ,
            ),
            "url": pick_first(intake.get("websiteUrl"), get_path(intake, "business.website"), REQ),
            "licenseNumber": pick_first(get_path(brand_dna_in, "trust.license_number"), get_path(intake, "business.license_number"), None),
            "description": pick_first(
                brand_dna_in.get("description"),
                get_path(strategy, "positioning.description"),
                strategy.get("primary_positioning"),
                research.get("brandVoice"),
                f"Local {city or 'DFW'} roofing contractor. Licensed, family-owned, insurance-claim experts." if city else None,
                REQ,
            ),
            "serviceRegion": pick_first(
                strategy.get("service_region"),
                strategy.get("target_market"),
                strategy.get("region_marketing"),
                research.get("region_marketing"),
                f"Greater {city}" if city else None,
                f"{city}, {state}" if city and state else None,
                REQ,
            ),
        },
        "contact": {
            "phone": phone,
            "phoneTelLink": phone_tel_link,
            "email": email,
            "googleMapsUrl": pick_first(get_path(research, "gbp.maps_url"), research.get("googleMapsUrl"), research.get("address_url")),
            "mapsEmbedUrl": pick_first(
                get_path(research, "gbp.maps_embed_url"),
                research.get("mapsEmbedUrl"),
                research.get("googleMapsEmbedUrl"),
                get_path(brand_dna_in, "contact.google_maps_embed_url"),
                # Last resort: derive a basic embed URL from address (no API key required)
                f"https://maps.google.com/maps?q={address_full.replace(' ', '+').replace('&', '%26') if address_full else (city + '+' + state if city and state else 'roofing+contractor')}&output=embed",
            ),
        },
        "address": {
            "street": street or REQ,
            "city": city or REQ,
            "state": state or REQ,
            "zip": zip_code or REQ,
            "full": address_full or REQ,
            "lat": pick_first(get_path(research, "gbp.lat"), research.get("lat"), None),
            "lng": pick_first(get_path(research, "gbp.lng"), research.get("lng"), None),
        },
        "hours": hours_block,
        # Programmatic open/close detection for the available-now indicator.
        # useAvailableNow.js reads this; the `hours` block above is for human
        # display + JSON-LD. Both must be present; they encode the same calendar
        # in two different shapes.
        "businessHours": _compose_business_hours(brand_dna_in, hours_block),
        # Social platform URLs. Footer.jsx renders an icon ONLY for keys with a
        # non-empty URL, so platforms not in the source data simply produce no
        # dead/invisible icon. Add new platforms here when scraped or supplied
        # by intake — keys must match SOCIAL_ICON_MAP in Footer.jsx (facebook,
        # instagram, youtube, twitter, linkedin, tiktok).
        "social": {
            "facebook": fb_url,
            "facebookReviews": fb_reviews_url,
            "instagram": pick_first(
                get_path(brand_dna_in, "social.instagram"),
                get_path(intake, "social.instagram"),
                get_path(research, "social.instagram"),
                "",
            ),
            "youtube": pick_first(
                get_path(brand_dna_in, "social.youtube"),
                get_path(intake, "social.youtube"),
                get_path(research, "social.youtube"),
                "",
            ),
            "twitter": pick_first(
                get_path(brand_dna_in, "social.twitter"),
                get_path(intake, "social.twitter"),
                get_path(research, "social.twitter"),
                "",
            ),
            "linkedin": pick_first(
                get_path(brand_dna_in, "social.linkedin"),
                get_path(intake, "social.linkedin"),
                get_path(research, "social.linkedin"),
                "",
            ),
            "tiktok": pick_first(
                get_path(brand_dna_in, "social.tiktok"),
                get_path(intake, "social.tiktok"),
                get_path(research, "social.tiktok"),
                "",
            ),
        },
        "team": {
            "founder": {
                "name": founder_name,
                "displayName": founder_name.upper() if founder_name and founder_name != REQ else REQ,
                "title": founder_title,
                "yearsExp": pick_first(get_path(brand_dna_in, "founder.years_experience"), get_path(brand_dna_in, "trust.years_in_business"), REQ),
                "expLabel": "YEARS OF EXPERIENCE",
            },
            "founders": pick_first(brand_dna_in.get("founders"), [founder_name] if founder_name and founder_name != REQ else []),
        },
        "theme_mode": pick_first(brand_dna_in.get("theme_mode"), get_path(resonance, "theme_mode_recommendation"), "light"),
        "voice_register": pick_first(brand_dna_in.get("voice_register"), "family"),
        "shape_motif": pick_first(brand_dna_in.get("shape_motif"), "polygon"),
        # Corner overlays per brand-dna-agent.md Rule 5 + 09-build.md Rule 58.
        # Motif mirrors shape_motif by default. Color is the per-client accent.
        # Opacity default 0.08 (low ambient brand texture).
        "corner_overlay": {
            "motif": pick_first(
                get_path(brand_dna_in, "corner_overlay.motif"),
                brand_dna_in.get("shape_motif"),
                "polygon",
            ),
            "color": pick_first(
                get_path(brand_dna_in, "corner_overlay.color"),
                palette.get("accent"),
                "#94A3B8",
            ),
            "opacity": pick_first(
                get_path(brand_dna_in, "corner_overlay.opacity"),
                0.08,
            ),
        },
        "palette": {
            "primary": palette.get("primary", REQ),
            "primary_dark": pick_first(palette.get("primary_dark"), palette.get("secondary"), REQ),
            "primary_slate": pick_first(palette.get("primary_slate"), palette.get("primary"), REQ),
            "accent": palette.get("accent", REQ),
            "accent_light": palette.get("accent_light", REQ),
            "accent_dark": palette.get("accent_dark", REQ),
            "neutral": pick_first(palette.get("neutral"), palette.get("muted"), REQ),
            "neutral_dim": pick_first(palette.get("neutral_dim"), palette.get("muted"), palette.get("neutral"), REQ),
            "silver": pick_first(palette.get("silver"), "#C0C6CF"),
            "ink": pick_first(palette.get("ink"), palette.get("text_body"), palette.get("primary_dark"), palette.get("secondary"), REQ),
        },
        "typography": {
            "heading": typography.get("heading", REQ),
            "body": typography.get("body", REQ),
            "headingFontUrl": pick_first(typography.get("headingFontUrl"), typography.get("heading_url"), REQ),
            "bodyFontUrl": pick_first(typography.get("bodyFontUrl"), typography.get("body_url"), REQ),
        },
        "reviews": {
            "rating": google_rating,
            "googleCount": google_count,
            "facebookCount": fb_count,
            "totalReviewCount": (google_count or 0) + (fb_count or 0),
            "googleLabel": "Google Reviews",
            "facebookLabel": "Facebook Reviews",
            "googleStat": f"Google {google_rating} ★ ({google_count})",
            "facebookStat": f"Facebook {fb_rating} ★ ({fb_count})",
            "items": review_items,
        },
        "services": services,
        "serviceAreas": [a.upper() if isinstance(a, str) else (a.get("city") or "").upper() for a in service_areas],
        "trust_badges": resolve_trust_badges(certifications),
        "press_logos": _build_press_logos(research, brand_dna_in),
        "location_pages": location_pages,
        "previous_projects": [],  # populated later by asset-copy step
        "team_members": [],
        "team_group_photo": None,  # populated later by asset-copy step (first /team/ file with 'group'/'crew'/'all' in stem)
        "copy": _build_copy_block(brand_dna_in, research, strategy, company_name, city, state, founder_name),
        "process_steps": brand_dna_in.get("process_steps") if isinstance(brand_dna_in.get("process_steps"), list) else _default_process_steps(),
        # Financing block. FinancingPage.jsx flips between "we offer" and "we
        # do not offer in-house" copy off `offered`. Default offered=true so
        # clients without an explicit financing block keep the existing flow.
        # Set financing.offered=false on clients that genuinely don't extend
        # in-house financing (FinancingPage will pivot to insurance + third-
        # party lender guidance instead of pretending to offer something).
        "financing": {
            "offered": (
                brand_dna_in.get("financing", {}).get("offered")
                if isinstance(brand_dna_in.get("financing"), dict) and "offered" in brand_dna_in.get("financing", {})
                else (
                    get_path(brand_dna_in, "special_offers.financing.enabled")
                    if isinstance(get_path(brand_dna_in, "special_offers.financing.enabled"), bool)
                    else True
                )
            ),
            "providers": (
                brand_dna_in.get("financing", {}).get("providers")
                if isinstance(brand_dna_in.get("financing"), dict) and brand_dna_in.get("financing", {}).get("providers")
                else []
            ),
            "termsDescription": (
                brand_dna_in.get("financing", {}).get("termsDescription")
                if isinstance(brand_dna_in.get("financing"), dict) and brand_dna_in.get("financing", {}).get("termsDescription")
                else ""
            ),
            "options": (
                brand_dna_in.get("financing", {}).get("options")
                if isinstance(brand_dna_in.get("financing"), dict) and brand_dna_in.get("financing", {}).get("options")
                else None
            ),
            "steps": (
                brand_dna_in.get("financing", {}).get("steps")
                if isinstance(brand_dna_in.get("financing"), dict) and brand_dna_in.get("financing", {}).get("steps")
                else None
            ),
            "faqs": (
                brand_dna_in.get("financing", {}).get("faqs")
                if isinstance(brand_dna_in.get("financing"), dict) and brand_dna_in.get("financing", {}).get("faqs")
                else None
            ),
        },
        "why_choose_us": brand_dna_in.get("why_choose_us") if isinstance(brand_dna_in.get("why_choose_us"), list) else _default_why_choose_us(license_label=pick_first(get_path(brand_dna_in, "trust.license_number"), research.get("license"))),
        "special_offers": _normalise_special_offers(brand_dna_in.get("special_offers")),
        # FAQ source order: brand-dna.json -> copy-deck homepage Section 12 -> default.
        # The copy-deck FAQ is preferred over defaults because it carries the
        # client's actual answers (licence number, region, certs, etc.) instead of
        # the generic licence/founding-year fallback strings.
        "faq": (
            brand_dna_in.get("faq")
            if isinstance(brand_dna_in.get("faq"), list) and brand_dna_in.get("faq")
            else (
                (copy_sections.get("home") or {}).get("faq")
                if (copy_sections.get("home") or {}).get("faq")
                else _default_faq(
                    company_name,
                    founder_name,
                    strategy.get("region_marketing") or research.get("region_marketing") or (f"{city}, {state}" if city and state else "your area"),
                    license_label=pick_first(get_path(brand_dna_in, "trust.license_number"), research.get("license")),
                    year_founded=pick_first(get_path(brand_dna_in, "trust.year_founded"), research.get("yearFounded")),
                )
            )
        ),
        "blog_posts": _enrich_blog_posts(
            (brand_dna_in.get("blog_posts") if isinstance(brand_dna_in.get("blog_posts"), list) and brand_dna_in.get("blog_posts") else _build_blog_posts(strategy, research, company_name, founder_name, city, state)),
            copy_sections.get("blogs") or {},
        ),
        "blog_categories": pick_first(brand_dna_in.get("blog_categories"), ["All"]),
        "pages": _compose_pages_block(brand_dna_in, copy_sections, city, state, company_name),
        "credit": {"agency": "__REQUIRED__AGENCY_NAME__", "url": None},
    }
    return brand_dna


def _compose_business_hours(brand_dna_in: dict[str, Any], hours_block: dict[str, Any]) -> dict[str, Any]:
    """Compose the programmatic-open/close block consumed by useAvailableNow.js.

    Preference order:
      1. `brand_dna_in.businessHours` if Stage 7 wrote it (full pass-through).
      2. Derive `open` / `close` from `hours.weekday.opens` / `.closes`.
      3. Sentinel fallback so the validator halts with a precise field path.
    """
    if isinstance(brand_dna_in.get("businessHours"), dict):
        bh = brand_dna_in["businessHours"]
        return {
            "tz": bh.get("tz") or REQ_BUSINESS_HOURS_TZ,
            "open": bh.get("open") or REQ_BUSINESS_HOURS_OPEN,
            "close": bh.get("close") or REQ_BUSINESS_HOURS_CLOSE,
        }
    weekday = (hours_block or {}).get("weekday") or {}
    return {
        "tz": (brand_dna_in.get("businessHours") or {}).get("tz") or REQ_BUSINESS_HOURS_TZ,
        "open": weekday.get("opens") or REQ_BUSINESS_HOURS_OPEN,
        "close": weekday.get("closes") or REQ_BUSINESS_HOURS_CLOSE,
    }


REQ_BUSINESS_HOURS_TZ = "__REQUIRED__BUSINESS_HOURS_TZ__"
REQ_BUSINESS_HOURS_OPEN = "__REQUIRED__BUSINESS_HOURS_OPEN__"
REQ_BUSINESS_HOURS_CLOSE = "__REQUIRED__BUSINESS_HOURS_CLOSE__"


def _compose_pages_block(
    brand_dna_in: dict[str, Any],
    copy_sections: dict[str, Any],
    city: str | None,
    state: str | None,
    company_name: str,
) -> dict[str, Any]:
    """Compose the per-page copy block consumed by the per-niche template
    page components. Stage 7 brand-dna-agent may set `brand_dna_in.pages.X`
    for any sub-key; this function fills missing sub-keys with sentinel-
    filled defaults so React component reads never hit `undefined`.

    The canonical shape lives in `references/brand-dna.shape.js`. Each
    per-niche template stamps it as `src/config/brand-dna.example.js` at
    Module 2D generation time. The validator
    (`scripts/validate-brand-dna.mjs`) halts the build if any sub-key is
    missing or has the wrong type.
    """
    user_pages = brand_dna_in.get("pages") or {}
    region_hint = f"{city}, {state}" if city and state else (city or "your area")

    defaults = {
        "about": {
            "heroLabel": "__REQUIRED__ABOUT_HERO_LABEL__",
            "heroHeadline": "__REQUIRED__ABOUT_HERO_HEADLINE__",
            "storyLabel": "__REQUIRED__ABOUT_STORY_LABEL__",
            "storyHeading": "__REQUIRED__ABOUT_STORY_HEADING__",
            "storyClosing": "__REQUIRED__ABOUT_STORY_CLOSING__",
            "stats": [],
            "values": [],
            "crewLabel": "__REQUIRED__ABOUT_CREW_LABEL__",
            "crewHeading": "__REQUIRED__ABOUT_CREW_HEADING__",
            "crewBody": "__REQUIRED__ABOUT_CREW_BODY__",
            "crewCaption": "__REQUIRED__ABOUT_CREW_CAPTION__",
            "valuesLabel": "__REQUIRED__ABOUT_VALUES_LABEL__",
            "valuesHeading": "__REQUIRED__ABOUT_VALUES_HEADING__",
            "valuesIntro": "__REQUIRED__ABOUT_VALUES_INTRO__",
            "secondaryButton": "__REQUIRED__ABOUT_SECONDARY_BUTTON__",
        },
        "serviceAreas": {
            "coverageHighlights": [],
            "mapLabel": "__REQUIRED__SA_MAP_LABEL__",
            "mapHeading": "__REQUIRED__SA_MAP_HEADING__",
            "mapBody": "__REQUIRED__SA_MAP_BODY__",
            "citiesHeading": "__REQUIRED__SA_CITIES_HEADING__",
            "citiesEmpty": "__REQUIRED__SA_CITIES_EMPTY__",
            "citiesFallback": "__REQUIRED__SA_CITIES_FALLBACK__",
            "readyLabel": "__REQUIRED__SA_READY_LABEL__",
            "readyHeading": "__REQUIRED__SA_READY_HEADING__",
            "readyBody": "__REQUIRED__SA_READY_BODY__",
        },
        "locationDetail": {
            "eyebrow": "__REQUIRED__LD_EYEBROW__",
            "nearbyLabel": "__REQUIRED__LD_NEARBY_LABEL__",
        },
        "blogPost": {
            "sidebarCtaHeading": "__REQUIRED__BP_SIDEBAR_HEADING__",
            "sidebarCtaBody": "__REQUIRED__BP_SIDEBAR_BODY__",
            "sidebarCtaButton": "__REQUIRED__BP_SIDEBAR_BUTTON__",
            "sidebarCallLabel": "__REQUIRED__BP_SIDEBAR_CALL_LABEL__",
            "sidebarCallNote": "__REQUIRED__BP_SIDEBAR_CALL_NOTE__",
            "moreArticlesLabel": "__REQUIRED__BP_MORE_LABEL__",
            "backToListLabel": "__REQUIRED__BP_BACK_LABEL__",
        },
        "blog": {
            "label": "__REQUIRED__BLOG_PAGE_LABEL__",
            "heading": "__REQUIRED__BLOG_PAGE_HEADING__",
            "intro": "__REQUIRED__BLOG_PAGE_INTRO__",
        },
        "contact": {
            "heading": "__REQUIRED__CONTACT_HEADING__",
            "intro": "__REQUIRED__CONTACT_INTRO__",
            "formHeading": "__REQUIRED__CONTACT_FORM_HEADING__",
            "formIntro": "__REQUIRED__CONTACT_FORM_INTRO__",
            "contactHeading": "__REQUIRED__CONTACT_CONTACT_HEADING__",
        },
        "services": {
            "label": "__REQUIRED__SERVICES_PAGE_LABEL__",
            "heading": "__REQUIRED__SERVICES_PAGE_HEADING__",
            "intro": "__REQUIRED__SERVICES_PAGE_INTRO__",
            "list": [],
        },
        "financing": {
            "label": "__REQUIRED__FINANCING_LABEL__",
            "heading": "__REQUIRED__FINANCING_HEADING__",
            "intro": "__REQUIRED__FINANCING_INTRO__",
            "processLabel": "__REQUIRED__FINANCING_PROCESS_LABEL__",
            "processHeading": "__REQUIRED__FINANCING_PROCESS_HEADING__",
            "processIntro": "__REQUIRED__FINANCING_PROCESS_INTRO__",
            "steps": [],
            "optionsLabel": "__REQUIRED__FINANCING_OPTIONS_LABEL__",
            "optionsHeading": "__REQUIRED__FINANCING_OPTIONS_HEADING__",
            "optionsIntro": "__REQUIRED__FINANCING_OPTIONS_INTRO__",
            "options": [],
            "calloutTitle": "__REQUIRED__FINANCING_CALLOUT_TITLE__",
            "calloutBody": "__REQUIRED__FINANCING_CALLOUT_BODY__",
            "faqLabel": "__REQUIRED__FINANCING_FAQ_LABEL__",
            "faqHeading": "__REQUIRED__FINANCING_FAQ_HEADING__",
            "faq": [],
            "ctaFootnote": "__REQUIRED__FINANCING_CTA_FOOTNOTE__",
        },
    }

    # Shallow-merge: user_pages.X overrides defaults.X at the sub-key level,
    # but missing sub-keys (e.g. user wrote `pages.contact.heading` but not
    # `pages.contact.intro`) fall back to the defaults so React reads never
    # hit `undefined`. The validator catches surviving sentinels.
    out = {}
    for key, default_block in defaults.items():
        user_block = user_pages.get(key) or {}
        if isinstance(default_block, dict):
            merged = {**default_block, **{k: v for k, v in user_block.items() if v not in (None, "")}}
            out[key] = merged
        else:
            out[key] = user_block or default_block
    # Preserve any extra page keys the user supplied that aren't in our defaults.
    for key, value in user_pages.items():
        if key not in out:
            out[key] = value
    return out


def _build_copy_block(brand_dna_in: dict[str, Any], research: dict[str, Any], strategy: dict[str, Any], company_name: str, city: str, state: str, founder_name: str) -> dict[str, Any]:
    """Compose the deeply-nested brandDNA.copy block consumed by the website template components.
    the website template components reference 50+ deep paths (e.g. brandDNA.copy.topBar.cta,
    brandDNA.copy.process.badgeText, brandDNA.copy.heroTrustChips.map). Every path
    needs a non-undefined default to avoid React crash at mount.

    Locked-phrase defaults are SOP-mandated (universal blueprint) and never vary.
    Section copy gets sensible defaults derived from research/strategy.
    """
    user = brand_dna_in.get("copy", {}) or {}
    region = strategy.get("region_marketing") or research.get("region_marketing") or (f"{city}, {state}" if city and state else "your area")
    rating = research.get("googleRating") or 5.0
    review_count = research.get("googleReviewCount") or 0
    tagline = brand_dna_in.get("company_tagline") or "__REQUIRED__COMPANY_TAGLINE__"
    region_upper = region.upper()
    state_full_or = state or "your state"

    # Hero trust chips. The niche playbook supplies the niche's strongest 4
    # trust chips via `playbook.copy-locks.heroTrustChips` (or via Stage 6
    # copy-deck). Stage 7 brand-dna populates `brand_dna_in.copy.heroTrustChips`.
    # Sentinel fallback halts the build if upstream didn't populate.
    default_trust_chips = [
        "__REQUIRED__HERO_TRUST_CHIP_1__",
        "__REQUIRED__HERO_TRUST_CHIP_2__",
        "__REQUIRED__HERO_TRUST_CHIP_3__",
        f"{rating}★ on Google ({review_count} Reviews)",
    ]
    # TrustStrip rotation under the hero. The niche playbook supplies the
    # niche's strongest 4 trust-strip claims via
    # `playbook.copy-locks.trustStripClaims` (or via Stage 6 copy-deck).
    # Sentinel fallback halts the build if upstream didn't populate.
    state_label = (state or "").strip() or "your state"
    license_label = (
        get_path(brand_dna_in, "trust.license_number")
        or research.get("license")
        or ""
    )
    license_text = license_label or "__REQUIRED__LICENSE_LINE__"
    default_trust_claims = [
        "__REQUIRED__TRUST_CLAIM_1__",
        "__REQUIRED__TRUST_CLAIM_2__",
        license_text,
        "__REQUIRED__TRUST_CLAIM_4__",
    ]

    # Every default below is a `__REQUIRED__SECTION_FIELD__` sentinel. The
    # upstream stages (Stage 5 strategy + Stage 6 copywriting + Stage 7
    # brand-dna) are expected to populate every visible field; the niche
    # playbook supplies the niche-appropriate copy lock defaults. If a field
    # is not populated, the sentinel survives into brand-dna.js and Stage 10.1
    # halts with a clear pointer to the missing field. Do NOT bake niche-
    # specific copy into the defaults below; that leaks one niche's IP into
    # every other niche's build.
    return {
        # === Locked phrases (SOP-mandated, resolved from playbook.copy-locks) ===
        "buttonText": user.get("buttonText", "__REQUIRED__CTA_PRIMARY__"),
        "submitButton": user.get("submitButton", "__REQUIRED__CTA_PRIMARY__"),
        "formHeader": user.get("formHeader", "__REQUIRED__FORM_HEADER__"),
        "formSubtext": user.get("formSubtext", "__REQUIRED__FORM_SUBTEXT__"),
        "privacyLine": user.get("privacyLine", "__REQUIRED__PRIVACY_LINE__"),
        "mobileCallLabel": user.get("mobileCallLabel", "__REQUIRED__MOBILE_CALL_LABEL__"),
        "availableNow": user.get("availableNow", "__REQUIRED__AVAILABLE_NOW__"),
        "footerCta": user.get("footerCta", "__REQUIRED__FOOTER_CTA__"),
        "controlPhrase": user.get("controlPhrase", "__REQUIRED__RISK_REVERSAL_LINE__"),
        "copyright": user.get("copyright", f"© 2026 {company_name}. All rights reserved."),

        # === TopBar (above-nav contact strip) ===
        "topBar": {**{
            "cta": "__REQUIRED__TOPBAR_CTA__",
        }, **(user.get("topBar") or {})},

        # === Hero section ===
        "hero": {**{
            "eyebrow": brand_dna_in.get("hero", {}).get("eyebrow") or "__REQUIRED__HERO_EYEBROW__",
            "headline": brand_dna_in.get("hero", {}).get("h1_headline") or "__REQUIRED__HERO_H1__",
            "subheadline": brand_dna_in.get("hero", {}).get("tagline") or tagline,
        }, **(user.get("hero") or {})},

        # === Hero trust chips (right side of hero or below) ===
        "heroTrustChips": user.get("heroTrustChips") or default_trust_chips,

        # === TrustStrip rotation under hero ===
        "trustClaims": user.get("trustClaims") or default_trust_claims,

        # === Founder section ===
        # Note: components read `para1` + `para2` (two paragraphs). The
        # canonical brand-dna.example.js requires both. Some legacy writers
        # set a single `para` key; if that's all we have, mirror it into
        # `para1` and leave `para2` as a sentinel so the validator catches
        # the missing second paragraph.
        "founder": {**{
            "label": "__REQUIRED__FOUNDER_LABEL__",
            "heading": "__REQUIRED__FOUNDER_HEADING__",
            "para1": (user.get("founder") or {}).get("para1")
                or (user.get("founder") or {}).get("para")
                or "__REQUIRED__FOUNDER_PARA1__",
            "para2": (user.get("founder") or {}).get("para2") or "__REQUIRED__FOUNDER_PARA2__",
            "visionLabel": "__REQUIRED__FOUNDER_VISION_LABEL__",
            "vision": "__REQUIRED__FOUNDER_VISION__",
            "missionLabel": "__REQUIRED__FOUNDER_MISSION_LABEL__",
            "mission": "__REQUIRED__FOUNDER_MISSION__",
        }, **{k: v for k, v in (user.get("founder") or {}).items() if k not in ("para",)}},

        # === Services section ===
        "services": {**{
            "label": "__REQUIRED__SERVICES_LABEL__",
            "heading": "__REQUIRED__SERVICES_HEADING__",
            "body": "__REQUIRED__SERVICES_BODY__",
        }, **(user.get("services") or {})},

        # === Why Choose Us section ===
        "whyChoose": {**{
            "label": "__REQUIRED__WHYCHOOSE_LABEL__",
            "heading": "__REQUIRED__WHYCHOOSE_HEADING__",
            "body": "__REQUIRED__WHYCHOOSE_BODY__",
        }, **(user.get("whyChoose") or {})},

        # === Our Process section ===
        "process": {**{
            "label": "__REQUIRED__PROCESS_LABEL__",
            "heading": "__REQUIRED__PROCESS_HEADING__",
            "body": "__REQUIRED__PROCESS_BODY__",
            "badgeText": "__REQUIRED__PROCESS_BADGE_TEXT__",
            "badgeSubtext": "__REQUIRED__PROCESS_BADGE_SUBTEXT__",
        }, **(user.get("process") or {})},

        # === Special Offers section ===
        "offers": {**{
            "label": "__REQUIRED__OFFERS_LABEL__",
            "heading": "__REQUIRED__OFFERS_HEADING__",
            "body": "__REQUIRED__OFFERS_BODY__",
            "detail": "__REQUIRED__OFFERS_DETAIL__",
        }, **(user.get("offers") or {})},

        # === Reviews section ===
        "reviews": {**{
            "label": "__REQUIRED__REVIEWS_LABEL__",
            "heading": f"{rating}★ ON GOOGLE",
            "body": f"{review_count} verified reviews.",
            "summary": "__REQUIRED__REVIEWS_SUMMARY__",
        }, **(user.get("reviews") or {})},

        # === Gallery section ===
        "gallery": {**{
            "label": "__REQUIRED__GALLERY_LABEL__",
            "heading": "__REQUIRED__GALLERY_HEADING__",
            "body": "__REQUIRED__GALLERY_BODY__",
        }, **(user.get("gallery") or {})},

        # === FAQ section ===
        "faq": {**{
            "label": "__REQUIRED__FAQ_LABEL__",
            "heading": "__REQUIRED__FAQ_HEADING__",
        }, **(user.get("faq") or {})},

        # === Service Areas section ===
        "serviceAreas": {**{
            "label": "__REQUIRED__SERVICEAREAS_LABEL__",
            "heading": "__REQUIRED__SERVICEAREAS_HEADING__",
            "body": "__REQUIRED__SERVICEAREAS_BODY__",
        }, **(user.get("serviceAreas") or {})},

        # === Service Area Card (in-section repeated label) ===
        "serviceAreaCard": {**{
            "heading": "__REQUIRED__SERVICEAREACARD_HEADING__",
            "body": "__REQUIRED__SERVICEAREACARD_BODY__",
        }, **(user.get("serviceAreaCard") or {})},

        # === CTA Banner section ===
        "cta": {**{
            "label": "__REQUIRED__CTA_LABEL__",
            "heading": "__REQUIRED__CTA_HEADING__",
            "body": "__REQUIRED__CTA_BODY__",
        }, **(user.get("cta") or {})},

        # === Blog section ===
        "blog": {**{
            "label": "__REQUIRED__BLOG_LABEL__",
            "heading": "__REQUIRED__BLOG_HEADING__",
            "body": "__REQUIRED__BLOG_BODY__",
            "featuredLabel": "FEATURED",
            "featuredLabel": "FEATURED",
        }, **(user.get("blog") or {})},
    }


def _enrich_blog_posts(posts: list[dict[str, Any]], blog_sections: dict[str, dict[str, Any]]) -> list[dict[str, Any]]:
    """Overlay copy-deck blog body markdown onto the existing posts list.

    For each post we lookup its slug in blog_sections (parsed from copy-deck.md).
    If found, we attach `body` (markdown text). BlogPostPage prefers structured
    `content[]` blocks first, then falls back to `body` markdown via its inline
    parser, then to `excerpt` as a single paragraph.

    When real Stage 6 copy is present, we DROP the auto-generated content[]
    blocks so the richer copy-deck body wins (BlogPostPage prefers content[]
    when non-empty).
    """
    if not blog_sections:
        return posts
    for post in posts:
        slug = post.get("slug")
        if not slug:
            continue
        section = blog_sections.get(slug)
        if section and section.get("body"):
            post["body"] = section["body"]
            post["content"] = []  # let body take precedence
            # If the section has a hook line, use it as the excerpt (it's better written
            # than the auto-generated "What every X homeowner should know about Y" stub).
            if section.get("hook"):
                post["excerpt"] = section["hook"]
    return posts


def _build_blog_posts(strategy: dict[str, Any], research: dict[str, Any], company_name: str, founder_name: str, city: str, state: str) -> list[dict[str, Any]]:
    """Compose blog_posts in the website template shape from sitemap.blog_posts metadata.
    Generates a publishable-quality short post (4-6 paragraphs) per slug.
    Cycles through /work/projectN.webp for covers.
    """
    entries = strategy.get("blog_posts") or []
    if not entries:
        return []
    region = strategy.get("region_marketing") or research.get("region_marketing") or (f"{city}, {state}" if city and state else "your area")
    today_label = "May 2026"
    posts = []
    for i, entry in enumerate(entries):
        slug = entry.get("slug", "").lstrip("/").replace("blog/", "")
        # Strip any " | <anything>" suffix to clean SEO-stuffed page titles
        raw_title = entry.get("page_title", "").strip()
        title = raw_title.split(" | ")[0].strip() or entry.get("target_keyword", slug.replace("-", " ").title())
        target = entry.get("target_keyword", "")
        cover = f"/work/project{(i % 7) + 1}.webp"
        # Category defaults to entry.category (set by Stage 5 strategy / Stage 6
        # copy-deck) or a generic "Guide" label. Niche-specific categories live
        # in the niche playbook's vocabulary.json; Stage 5 reads them when
        # auto-categorising blog topics.
        category = entry.get("category") or "Guide"
        # Excerpt + content: when Stage 6 copy-deck supplies a body for this
        # slug, _enrich_blog_posts() overwrites these defaults with the real
        # copy. When it doesn't, the sentinels surface in the build output
        # and the Stage 10.1 validator halts with a precise pointer.
        excerpt = entry.get("excerpt") or "__REQUIRED__BLOG_EXCERPT__"
        content = [
            {"type": "p", "text": "__REQUIRED__BLOG_INTRO_PARAGRAPH__"},
            {"type": "h2", "text": "__REQUIRED__BLOG_H2_1__"},
            {"type": "p", "text": "__REQUIRED__BLOG_BODY_PARAGRAPH_1__"},
            {"type": "h2", "text": "__REQUIRED__BLOG_H2_2__"},
            {"type": "p", "text": "__REQUIRED__BLOG_BODY_PARAGRAPH_2__"},
            {"type": "h2", "text": "__REQUIRED__BLOG_H2_3__"},
            {"type": "p", "text": "__REQUIRED__BLOG_CLOSING_PARAGRAPH__"},
        ]
        posts.append({
            "slug": slug,
            "title": title,
            "excerpt": excerpt,
            "date": today_label,
            "category": category,
            "readTime": "4 min read",
            "cover": cover,
            "featured": i == 0,
            "content": content,
        })
    return posts


def _regenerate_favicon(logo_src: Path, public_dir: Path) -> None:
    """Generate per-client /favicon.png + /favicon.svg from the logo.
    Crops a square from the LEFT side of the wordmark (where the iconic mark
    usually sits) and renders at 192x192. Avoids shipping the template's default
    favicon to per-client builds."""
    from PIL import Image
    try:
        img = Image.open(logo_src).convert("RGBA")
    except Exception as e:
        print(f"  WARN: favicon gen failed (cannot open {logo_src}): {e}", file=sys.stderr)
        return

    w, h = img.size
    # If logo is wider than tall (typical wordmark), crop the leftmost square
    # to capture just the icon mark. If already square or taller, center-crop.
    if w > h:
        # Many wordmark logos have icon on left (~25-35% of width). Crop to height.
        crop_size = h
        cropped = img.crop((0, 0, crop_size, crop_size))
    elif h > w:
        crop_size = w
        top = (h - crop_size) // 2
        cropped = img.crop((0, top, crop_size, top + crop_size))
    else:
        cropped = img

    # Resize to 192x192 (covers tab icon + Android home-screen)
    cropped.thumbnail((192, 192), Image.LANCZOS)
    favicon_png = public_dir / "favicon.png"
    cropped.save(favicon_png, "PNG", optimize=True)

    # SVG wrapper that embeds the PNG as a base64 data URL — keeps both formats
    # available without needing a vector source. Browsers that prefer SVG get the
    # same raster; PNG-only ones get the PNG file directly.
    import base64
    png_b64 = base64.b64encode(favicon_png.read_bytes()).decode("ascii")
    svg = (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192">\n'
        f'  <image href="data:image/png;base64,{png_b64}" width="192" height="192"/>\n'
        '</svg>\n'
    )
    (public_dir / "favicon.svg").write_text(svg)
    print(f"  favicon: regenerated from {logo_src.name} ({cropped.size[0]}x{cropped.size[1]} PNG + SVG wrapper)")


def _normalise_special_offers(value: Any) -> list[dict[str, str]]:
    """Normalize brand-dna special_offers (which may be the schema's object form
    {discount_amount, groups, financing}) to the array form the website template expects:
    [{ label, amount }]. Returns empty array when no real offers.

    Suppresses fake discount cards when the schema-satisfaction placeholder
    pattern is detected: discount_amount=0 with groups listed AND financing
    enabled means the client carries NO group discount, only a financing
    offering. SpecialOffers.jsx will then render the section as a financing-only
    tile (1-offer-statement branch per Lesson Rule 32).
    """
    if isinstance(value, list):
        return value
    if isinstance(value, dict):
        groups = value.get("groups") or []
        amount_n = value.get("discount_amount") or 0
        financing = value.get("financing") if isinstance(value.get("financing"), dict) else {}
        financing_enabled = bool(financing.get("enabled"))
        # Schema-placeholder pattern: zero discount + financing on = no group cards
        if amount_n == 0 and financing_enabled:
            return []
        amount_str = f"${amount_n} OFF" if amount_n > 0 else "Ask About Discounts"
        label_map = {
            "first_responders": "FIRST RESPONDERS",
            "educators": "EDUCATORS",
            "military_veterans": "MILITARY & VETERANS",
            "seniors": "SENIORS",
        }
        return [{"label": label_map.get(g, g.upper()), "amount": amount_str} for g in groups]
    return []


def _default_process_steps() -> list[dict[str, Any]]:
    """Fallback when Stage 7 brand-dna did not write `process_steps`.
    Returns a sentinel-filled list; the Stage 10.1 validator halts on
    surviving sentinels, which surfaces the missing upstream population
    as a precise build error. The niche playbook's `process.json` defines
    the canonical step list for the active niche.
    """
    return [
        {"n": 1, "title": "__REQUIRED__PROCESS_STEP_1_TITLE__", "body": "__REQUIRED__PROCESS_STEP_1_BODY__"},
        {"n": 2, "title": "__REQUIRED__PROCESS_STEP_2_TITLE__", "body": "__REQUIRED__PROCESS_STEP_2_BODY__"},
        {"n": 3, "title": "__REQUIRED__PROCESS_STEP_3_TITLE__", "body": "__REQUIRED__PROCESS_STEP_3_BODY__"},
        {"n": 4, "title": "__REQUIRED__PROCESS_STEP_4_TITLE__", "body": "__REQUIRED__PROCESS_STEP_4_BODY__"},
    ]


def _default_why_choose_us(license_label: str | None = None) -> list[str]:
    """Fallback when Stage 7 brand-dna did not write `why_choose_us`. Returns
    a sentinel-filled list; the Stage 10.1 validator halts on surviving
    sentinels. The niche playbook's copy locks define the niche-specific
    why-choose-us bullets via the per-niche reference pool analysis.
    `license_label` is per-client and substituted as-is when present.
    """
    licence_line = f"{license_label} Licensed and Insured" if license_label else "__REQUIRED__LICENSE_LINE__"
    return [
        "__REQUIRED__WHYCHOOSE_BULLET_1__",
        "__REQUIRED__WHYCHOOSE_BULLET_2__",
        "__REQUIRED__WHYCHOOSE_BULLET_3__",
        "__REQUIRED__WHYCHOOSE_BULLET_4__",
        licence_line,
        "__REQUIRED__WHYCHOOSE_BULLET_6__",
    ]


def _default_faq(company_name: str, founder_name: str, region: str, license_label: str | None = None, year_founded: int | None = None) -> list[dict[str, str]]:
    """Fallback when Stage 7 brand-dna did not write `faq`. Returns a
    sentinel-filled list; the Stage 10.1 validator halts on surviving
    sentinels. The niche playbook + Stage 6 copy-deck supply the niche-
    appropriate FAQ entries.
    """
    return [
        {"q": "__REQUIRED__FAQ_1_Q__", "a": "__REQUIRED__FAQ_1_A__"},
        {"q": "__REQUIRED__FAQ_2_Q__", "a": "__REQUIRED__FAQ_2_A__"},
        {"q": "__REQUIRED__FAQ_3_Q__", "a": "__REQUIRED__FAQ_3_A__"},
        {"q": "__REQUIRED__FAQ_4_Q__", "a": "__REQUIRED__FAQ_4_A__"},
        {"q": "__REQUIRED__FAQ_5_Q__", "a": "__REQUIRED__FAQ_5_A__"},
    ]


def resolve_trust_badges(certifications: dict[str, Any]) -> list[dict[str, str]]:
    """Look up cert flags in templates/{niche-slug}/niche-playbook/trust-signals.json and return matched files."""
    registry_path = TRUST_BADGES_DIR / "registry.json"
    if not registry_path.exists():
        return []
    registry = json.loads(registry_path.read_text())
    matched = []
    for cert_key, has_it in (certifications or {}).items():
        if not has_it:
            continue
        entry = registry.get(cert_key)
        if entry:
            matched.append({"filename": entry.get("filename"), "alt": entry.get("alt")})
    return matched


def write_brand_dna_js(brand_dna: dict[str, Any], dest: Path) -> None:
    """Serialise the brand-dna dict as a JavaScript ES module."""
    js = "export const brandDNA = " + json.dumps(brand_dna, indent=2, ensure_ascii=False) + ";\n"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(js)
    print(f"wrote brand-dna.js: {dest}")


# ----- step 3, copy + optimise assets -------------------------------------


def optimise(src: Path, dest: Path, max_w: int | None = None, max_h: int | None = None, q: int = 92) -> bool:
    if not src.exists():
        return False
    cmd = ["python3", str(OPTIMISE_TOOL), str(src), str(dest)]
    if max_w:
        cmd += ["--max-width", str(max_w)]
    if max_h:
        cmd += ["--max-height", str(max_h)]
    if q:
        cmd += ["--quality", str(q)]
    subprocess.run(cmd, check=True, text=True)
    return True


def copy_assets(client_name: str, paths: dict[str, Path], site_dir: Path, brand_dna: dict[str, Any]) -> None:
    public = site_dir / "public"

    # Logo. Prefer well-known filenames (logo.svg/png/jpg/jpeg). Fall back to
    # any image in the logo dir (Stage 4 sometimes writes branded filenames like
    # example-client-logo-2025-primary.png).
    logo_dir = paths["logo_dir"]
    logo_src: Path | None = None
    if logo_dir.exists():
        for candidate in ["logo.svg", "logo.png", "logo.jpg", "logo.jpeg"]:
            cand = logo_dir / candidate
            if cand.exists():
                logo_src = cand
                break
        if logo_src is None:
            for cand in sorted(logo_dir.iterdir()):
                if cand.is_file() and cand.suffix.lower() in {".svg", ".png", ".jpg", ".jpeg", ".webp"}:
                    logo_src = cand
                    break
    if logo_src is not None:
        if logo_src.suffix.lower() == ".svg":
            optimise(logo_src, public / "logo.svg")
        else:
            optimise(logo_src, public / "logo.webp", q=92)

    # Hero (desktop + mobile, both webp)
    if paths["hero_desktop"].exists():
        optimise(paths["hero_desktop"], public / "hero-image.webp", max_w=1920, max_h=1080, q=92)
    if paths["hero_mobile"].exists():
        optimise(paths["hero_mobile"], public / "hero-image-mobile.webp", max_w=828, max_h=1200, q=92)

    # Favicon. Always regenerate from the per-client logo so the browser tab
    # never shows the template's default favicon. Crops a square from the left
    # of the wordmark (where icon marks usually live), then writes 192x192 PNG +
    # SVG that wraps the same raster as a fallback.
    if logo_src is not None:
        _regenerate_favicon(logo_src, public)

    # Owner photo. Critical: when no per-client photo exists, DELETE the legacy
    # template owner.webp so the dist doesn't ship the wrong person's face.
    # the founder section component handles 404 gracefully via onError.
    owner_dir = paths["owner_photo_dir"]
    owner_found = False
    owner_candidates: list[Path] = []
    if owner_dir.exists():
        for candidate in ["owner.webp", "owner.png", "owner.jpg", "owner.jpeg"]:
            cand = owner_dir / candidate
            if cand.exists():
                owner_candidates.append(cand)
                break
    # Alternate Stage 4 layout: founder-photos/ may hold a single-person owner
    # portrait. Group photos (stem contains group/crew/team/all) are routed
    # to the team_group_photo slot below, NOT to /owner.webp.
    founder_dir = paths.get("founder_dir") if isinstance(paths, dict) else None
    if not owner_candidates and founder_dir and founder_dir.exists():
        for cand in sorted(founder_dir.iterdir()):
            if cand.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
                continue
            stem_lower = cand.stem.lower()
            is_group_like = any(tok in stem_lower for tok in ("group", "crew", "team-group", "team-photo", "-all", "_all", "team_"))
            if is_group_like:
                continue  # group photo, handled by team_group_photo path
            owner_candidates.append(cand)
            break
    if owner_candidates:
        optimise(owner_candidates[0], public / "owner.webp", max_w=640, max_h=800, q=88)
        owner_found = True
    if not owner_found:
        legacy_owner = public / "owner.webp"
        if legacy_owner.exists():
            legacy_owner.unlink()
            print(f"  removed legacy template owner.webp (no per-client founder photo provided)")

    # Trust badges. Prefer the client's own badges/ folder (harvested at Stage 4
    # from the client's site) when it exists and contains manufacturer SVGs/PNGs.
    # Wipe the legacy template badges first so we don't leak the website template's badge set
    # into a per-client build. Fall back to the registry-lookup path when the
    # client folder is absent.
    badges_out = public / "badges"
    if badges_out.exists():
        for item in badges_out.iterdir():
            if item.is_file():
                item.unlink()
    badges_out.mkdir(parents=True, exist_ok=True)
    client_badges_dir = paths.get("client_badges_dir") if isinstance(paths, dict) else None
    used_client_badges = False
    badge_entries_for_dna: list[dict[str, str]] = []
    if client_badges_dir and client_badges_dir.exists():
        manifest_path = client_badges_dir / "manifest.json"
        manifest_data: dict[str, Any] = {}
        if manifest_path.exists():
            try:
                manifest_data = json.loads(manifest_path.read_text())
            except Exception:
                manifest_data = {}
        manifest_lookup = {}
        for b in (manifest_data.get("badges") or []):
            fn = b.get("filename")
            if fn:
                manifest_lookup[fn] = b
        for cand in sorted(client_badges_dir.iterdir()):
            if cand.is_file() and cand.suffix.lower() in {".svg", ".png", ".jpg", ".jpeg", ".webp"}:
                optimise(cand, badges_out / cand.name, q=92)
                entry = manifest_lookup.get(cand.name) or {}
                badge_entries_for_dna.append({
                    "filename": cand.name,
                    "alt": entry.get("label") or cand.stem.replace("-", " ").replace("_", " ").title(),
                })
                used_client_badges = True
    if not used_client_badges:
        for badge in brand_dna.get("trust_badges", []):
            filename = badge.get("filename")
            if not filename:
                continue
            src = TRUST_BADGES_DIR / filename
            if src.exists():
                optimise(src, badges_out / filename, q=92)
    else:
        # Replace the empty/registry-derived trust_badges list so the rendered
        # band shows what's actually on disk for this client.
        brand_dna["trust_badges"] = badge_entries_for_dna

    # Project gallery (previous_projects). Wipe the inherited template /work/
    # contents first so we don't ship the website template's action*.jpg / gemini*.png /
    # action-video.mp4 to the per-client dist (Lesson Rule 5: forbidden strings,
    # plus visual contamination from the wrong company's photos).
    projects_dir = paths["projects_dir"]
    # Alternate Stage 4 layout: project-images/ holds the harvested photos.
    if not projects_dir.exists():
        alt_projects_dir = paths.get("project_images_dir") if isinstance(paths, dict) else None
        if alt_projects_dir and alt_projects_dir.exists():
            projects_dir = alt_projects_dir
    work_out = public / "work"
    if work_out.exists():
        for item in work_out.iterdir():
            if item.is_file():
                item.unlink()
    work_out.mkdir(parents=True, exist_ok=True)
    project_entries = []
    if projects_dir.exists():
        idx = 0
        for src in sorted(projects_dir.iterdir()):
            if src.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}:
                idx += 1
                target = work_out / f"project{idx}.webp"
                optimise(src, target, max_w=1200, max_h=800, q=92)
                project_entries.append({"filename": f"project{idx}.webp", "type": "image", "alt": f"Project {idx} by {brand_dna['company']['name']}"})
    brand_dna["previous_projects"] = project_entries

    # Delete any legacy hero-image.png that shipped in the per-niche template's
    # public/ folder. Subpages reference /hero-image.webp directly, so the .png
    # is dead weight + brand contamination.
    legacy_hero_png = public / "hero-image.png"
    if legacy_hero_png.exists():
        legacy_hero_png.unlink()
        print(f"  removed legacy template hero-image.png (subpages reference .webp)")

    # Team photos. We split on filename heuristics: any file with "group",
    # "crew", "team-group", "team-photo", "team_", "all" in the stem becomes the
    # team_group_photo (rendered as a wide hero on the About page Meet the Team
    # section). All other team photos become individual team_members entries.
    team_dir = paths["team_dir"]
    team_out = public / "team"
    team_entries = []
    team_group_photo = None
    group_tokens = ("group", "crew", "team-group", "team-photo", "team_", "-all", "_all")
    # Collect from team_dir first
    team_sources: list[Path] = []
    if team_dir.exists():
        team_sources.extend(sorted(team_dir.iterdir()))
    # Alternate Stage 4 layout: founder-photos/ may also contain group photos.
    founder_dir = paths.get("founder_dir") if isinstance(paths, dict) else None
    if founder_dir and founder_dir.exists():
        team_sources.extend(sorted(founder_dir.iterdir()))
    if team_sources:
        team_out.mkdir(parents=True, exist_ok=True)
    used_owner_path: Path | None = owner_candidates[0] if owner_candidates else None
    for src in team_sources:
        if not src.is_file():
            continue
        if src.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        if used_owner_path and src.resolve() == used_owner_path.resolve():
            # Skip the file already promoted to /owner.webp
            continue
        stem_lower = src.stem.lower()
        is_group = any(tok in stem_lower for tok in group_tokens)
        if is_group:
            target = team_out / f"{src.stem}.webp"
            optimise(src, target, max_w=1600, max_h=900, q=92)
            if not team_group_photo:
                team_group_photo = f"{src.stem}.webp"
        else:
            target = team_out / f"{src.stem}.webp"
            optimise(src, target, max_w=480, max_h=600, q=88)
            team_entries.append({
                "name": src.stem.replace("-", " ").replace("_", " ").title(),
                "filename": f"{src.stem}.webp",
                "role": "",
            })
    brand_dna["team_members"] = team_entries
    brand_dna["team_group_photo"] = team_group_photo

    # Platform logos (verbatim copy)
    platforms_out = public / "platforms"
    platforms_out.mkdir(parents=True, exist_ok=True)
    for name in ["google-logo.svg", "facebook-logo.svg", "bbb-logo.svg"]:
        src = PLATFORMS_DIR / name
        if src.exists():
            shutil.copyfile(src, platforms_out / name)

    # Pattern (one file per the chosen motif)
    motif = brand_dna.get("shape_motif", "polygon")
    patterns_out = public / "patterns"
    patterns_out.mkdir(parents=True, exist_ok=True)
    pattern_src = TEMPLATE_DIR / "src" / "assets" / "bg-patterns" / f"{motif}.svg"
    if pattern_src.exists():
        shutil.copyfile(pattern_src, patterns_out / f"{motif}.svg")


# ----- step 4, npm install + npm run build --------------------------------


def npm_install_and_build(site_dir: Path, skip_install: bool) -> None:
    if not skip_install:
        run(["npm", "install", "--silent"], cwd=site_dir)
    run(["npm", "run", "build"], cwd=site_dir)


# ----- step 5, validate dist ----------------------------------------------


_SENTINEL_RE = re.compile(r"__REQUIRED__[A-Z0-9_]+__")


def find_sentinels(brand_dna_path: Path) -> list[str]:
    """Scan brand-dna.js for fully-formed __REQUIRED__SOMETHING__ sentinels.

    Skips lines that are pure JS line comments (start with `//`) so a developer
    can write a comment like `// All __REQUIRED__ sentinels filled` without
    tripping the scanner. The regex pattern itself requires the sentinel to be
    followed by `[A-Z0-9_]+__`, so the bare word `__REQUIRED__` in prose never
    matches even outside comments.
    """
    text = brand_dna_path.read_text()
    hits = []
    for line_no, line in enumerate(text.splitlines(), start=1):
        stripped = line.lstrip()
        if stripped.startswith("//") or stripped.startswith("*"):
            continue
        if _SENTINEL_RE.search(line):
            hits.append(f"line {line_no}: {line.strip()}")
    return hits


def find_forbidden(dist: Path) -> list[tuple[str, Path]]:
    """Scan the rendered dist tree for any FORBIDDEN_PATTERNS regex hit."""
    hits = []
    if not dist.exists():
        return hits
    compiled = [re.compile(p) for p in FORBIDDEN_PATTERNS]
    for path in dist.rglob("*"):
        if path.suffix.lower() not in {".html", ".css", ".js", ".json"}:
            continue
        if not path.is_file():
            continue
        try:
            text = path.read_text(errors="ignore")
        except Exception:
            continue
        for needle in compiled:
            m = needle.search(text)
            if m:
                hits.append((m.group(0), path))
    return hits


def validate(site_dir: Path) -> int:
    brand_dna_js = site_dir / "src" / "config" / "brand-dna.js"
    sentinels = find_sentinels(brand_dna_js)
    if sentinels:
        print("VALIDATOR FAIL: __REQUIRED__ sentinels survived in brand-dna.js:")
        for hit in sentinels:
            print(f"  {hit}")
        return 1

    dist = site_dir / "dist"
    forbidden = find_forbidden(dist)
    if forbidden:
        print("VALIDATOR FAIL: forbidden strings found in dist:")
        for needle, path in forbidden:
            print(f"  '{needle}' in {path.relative_to(dist)}")
        return 2

    print("VALIDATOR PASS: no sentinels, no forbidden strings")
    return 0


# ----- main ---------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Stage 10.1: clone the active per-niche template, overlay brand-dna, copy assets, build, validate. There is no fallback baseline; the active niche template must exist (Module 2D's /build-niche-template generates it)."
    )
    parser.add_argument("--client", required=True, help="Client folder name under clients/")
    parser.add_argument("--niche", default=None, help="Override active niche slug (default: read from stack-state.json)")
    parser.add_argument("--skip-install", action="store_true", help="Skip npm install (faster iteration)")
    parser.add_argument("--dry-run", action="store_true", help="Compose brand-dna.js + copy assets, do not build")
    args = parser.parse_args()

    source_template, niche_slug = resolve_active_template(args.niche)
    if not source_template.exists():
        print(f"ERROR: template directory missing: {source_template}", file=sys.stderr)
        return 1

    paths = client_paths(args.client)
    if not paths["base"].exists():
        print(f"ERROR: client folder not found: {paths['base']}", file=sys.stderr)
        return 1

    print(f"=== Stage 10.1: build-from-template for '{args.client}' ===")
    # resolve_active_template halts via NoNicheTemplateError if niche_slug is
    # empty; this branch is always reached with a non-empty slug.
    print(f"    active niche: '{niche_slug}' -> {source_template.relative_to(REPO_ROOT)}")
    print()

    print("[1/6] cloning niche template")
    clone_template(paths["site"], source_template)

    print("\n[2/6] copying niche-playbook badges into public/badges/")
    badge_count = copy_playbook_badges(niche_slug, paths["site"])
    print(f"  copied {badge_count} badge file(s)")

    print("\n[3/6] copying per-client photos into public/work + public/team")
    photo_counts = copy_client_photos_to_public(paths, paths["site"])
    print(f"  copied {photo_counts['work']} work photo(s), {photo_counts['team']} team photo(s)")

    print("\n[4/6] composing brand-dna.js from pipeline data")
    brand_dna = compose_brand_dna(args.client, paths)

    print("\n[5/6] copying + optimising per-client assets")
    copy_assets(args.client, paths, paths["site"], brand_dna)

    # Re-write brand-dna.js after asset copy (because copy_assets populates
    # previous_projects / team_members from what's actually on disk)
    write_brand_dna_js(brand_dna, paths["site"] / "src" / "config" / "brand-dna.js")

    if args.dry_run:
        print("\n[dry-run] skipping build")
        return 0

    print("\n[6/6] npm install + npm run build")
    npm_install_and_build(paths["site"], args.skip_install)

    print("\n[validate] dist")
    rc = validate(paths["site"])

    # Update pipeline state + build log
    state = read_json(paths["pipeline_state"])
    state["stage_10_1"] = "complete" if rc == 0 else "failed"
    state["stage_10_1_completed_at"] = datetime.now(timezone.utc).isoformat()
    paths["pipeline_state"].parent.mkdir(parents=True, exist_ok=True)
    paths["pipeline_state"].write_text(json.dumps(state, indent=2))

    log = paths["build_log"]
    log.parent.mkdir(parents=True, exist_ok=True)
    with log.open("a") as f:
        f.write(f"\n## Stage 10.1, build-from-template ({datetime.now(timezone.utc).isoformat()})\n")
        f.write(f"Status: {'complete' if rc == 0 else 'failed'}\n")
        f.write(f"Output: {paths['site']}\n")

    return rc


if __name__ == "__main__":
    sys.exit(main())
