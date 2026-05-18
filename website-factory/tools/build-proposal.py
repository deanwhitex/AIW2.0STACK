#!/usr/bin/env python3
"""
build-proposal.py — Stage 13 (template-approach branch)

Translation layer between our pipeline outputs (intake / research / strategy /
brand-dna / dist / assets) and the canonical proposal template
(`templates/proposal/proposal-template.html` with ~110 {{VAR}} placeholders).

Reads our pipeline data, composes the placeholder values, copies the agency-static
dossier wholesale + per-lead overlays (logo, GMB cover photo, the QA-cleared
build), substitutes every {{VAR}}, generates the PAGE_DATA JS map from our
template route list, and writes the per-lead proposal artifact at
`clients/[X]/[X] Proposal/proposal.html`.

Per-lead artifact tree:
    clients/[X]/[X] Proposal/
    ├── proposal.html
    ├── agency-logo.svg
    ├── build/                  (copy of [X] Website/dist/)
    └── agency-assets/             (agency-static dossier + per-lead client-logo + gmb-cover)

Usage:
    python3 tools/build-proposal.py --client "Acme Roofing"
    python3 tools/build-proposal.py --client "Acme Roofing" --skip-build-copy
    python3 tools/build-proposal.py --client "Acme Roofing" --dry-run
"""

from __future__ import annotations

import argparse
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent
STACK_STATE_PATH = REPO_ROOT.parent / "stack-state.json"
TEMPLATE_DIR = REPO_ROOT / "templates" / "proposal"
TEMPLATE_HTML = TEMPLATE_DIR / "proposal-template.html"
TEMPLATE_LOGO = TEMPLATE_DIR / "agency-logo.svg"
AGENCY_ASSETS = TEMPLATE_DIR / "agency-assets"
OPTIMISE_TOOL = REPO_ROOT / "tools" / "optimise-image.py"


class NoProposalPagesError(RuntimeError):
    """Raised when the active niche template ships no proposal-pages.json.

    The proposal generator does not carry a built-in default page list.
    Module 2D must write the file at templates/{niche-slug}/niche-playbook/
    proposal-pages.json (Phase 8) from the niche wireframe + sitemap.
    """

# US state code → full name (the most common ones for the student-agency market)
STATE_FULL = {
    "AL": "Alabama", "AK": "Alaska", "AZ": "Arizona", "AR": "Arkansas",
    "CA": "California", "CO": "Colorado", "CT": "Connecticut", "DE": "Delaware",
    "FL": "Florida", "GA": "Georgia", "HI": "Hawaii", "ID": "Idaho",
    "IL": "Illinois", "IN": "Indiana", "IA": "Iowa", "KS": "Kansas",
    "KY": "Kentucky", "LA": "Louisiana", "ME": "Maine", "MD": "Maryland",
    "MA": "Massachusetts", "MI": "Michigan", "MN": "Minnesota", "MS": "Mississippi",
    "MO": "Missouri", "MT": "Montana", "NE": "Nebraska", "NV": "Nevada",
    "NH": "New Hampshire", "NJ": "New Jersey", "NM": "New Mexico", "NY": "New York",
    "NC": "North Carolina", "ND": "North Dakota", "OH": "Ohio", "OK": "Oklahoma",
    "OR": "Oregon", "PA": "Pennsylvania", "RI": "Rhode Island", "SC": "South Carolina",
    "SD": "South Dakota", "TN": "Tennessee", "TX": "Texas", "UT": "Utah",
    "VT": "Vermont", "VA": "Virginia", "WA": "Washington", "WV": "West Virginia",
    "WI": "Wisconsin", "WY": "Wyoming", "DC": "District of Columbia",
}

# Marketing region labels — common metros. Falls back to "Greater {city}" if no match.
REGION_MARKETING = {
    ("TX", "Houston"): "Greater Houston",
    ("TX", "Dallas"): "Dallas-Fort Worth Metroplex",
    ("TX", "Austin"): "Greater Austin",
    ("TX", "San Antonio"): "Greater San Antonio",
    ("AZ", "Phoenix"): "Greater Phoenix",
    ("FL", "Miami"): "South Florida",
    ("FL", "Tampa"): "Tampa Bay",
    ("FL", "Orlando"): "Greater Orlando",
    ("CA", "Los Angeles"): "Greater Los Angeles",
    ("CA", "San Diego"): "Greater San Diego",
    ("MN", "Plymouth"): "Twin Cities Metro",
    ("MN", "Minneapolis"): "Twin Cities Metro",
    ("MO", "Kansas City"): "Greater Kansas City",
    ("MO", "St. Louis"): "Greater St. Louis",
    ("MI", "Battle Creek"): "West Michigan",
    ("MI", "Detroit"): "Metro Detroit",
    ("GA", "Atlanta"): "North Metro Atlanta",
}

# Photo categorisation keywords. The agency-side photo picker uses these
# to bucket scraped photos. Keep the list generic enough to cover the
# common categories every niche carries (overhead/aerial shots, hero
# imagery, team/operations imagery). Niche-specific overrides come from
# the active niche's niche-playbook/photo-manifest.json.
PHOTO_HEURISTIC = [
    ("drone", "aerial", "overhead"),
    ("hero", "banner", "exterior"),
    ("team", "crew", "vehicle", "operations"),
]


def _resolve_active_niche() -> str | None:
    """Read the active niche slug from stack-state.json. Returns None when
    no niche is set (stack-state missing or niche unset)."""
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


def _load_proposal_pages(niche_slug: str | None) -> dict[str, Any]:
    """Read the active niche's proposal-pages.json. Halts with a Module 2D
    pointer when the file is missing.

    There is no built-in default page list; every niche template must
    ship its own proposal-pages.json (Module 2D Phase 8 generates it
    from the niche wireframe + sitemap).
    """
    if not niche_slug:
        raise NoProposalPagesError(
            "No active niche is set in stack-state.json. Run `/pick-niche` "
            "and `/build-niche-template` before Stage 13 (proposal)."
        )
    path = REPO_ROOT / "templates" / niche_slug / "niche-playbook" / "proposal-pages.json"
    if not path.exists():
        raise NoProposalPagesError(
            f"templates/{niche_slug}/niche-playbook/proposal-pages.json missing. "
            f"Run `/build-niche-template` to regenerate the niche playbook "
            f"(Module 2D Phase 8 writes this file from the niche wireframe "
            f"+ sitemap)."
        )
    try:
        data = json.loads(path.read_text())
    except Exception as e:
        raise NoProposalPagesError(
            f"templates/{niche_slug}/niche-playbook/proposal-pages.json is "
            f"not valid JSON: {e}"
        ) from e
    if not isinstance(data, dict) or "pages" not in data:
        raise NoProposalPagesError(
            f"templates/{niche_slug}/niche-playbook/proposal-pages.json "
            f"missing required `pages` array."
        )
    return data


def _sub_tokens(text: str, tokens: dict[str, str]) -> str:
    """Replace {key} placeholders in `text` with values from `tokens`.
    Missing tokens render as the empty string + a stderr warning."""
    def repl(m: "re.Match[str]") -> str:
        key = m.group(1)
        if key in tokens:
            return tokens[key]
        print(f"  WARN: proposal-pages token {{{key}}} did not resolve", file=sys.stderr)
        return ""
    return re.sub(r"\{([a-z_]+)\}", repl, text)


def read_json(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text())


def pick_first(*candidates: Any) -> Any:
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
    cur: Any = obj
    for key in path.split("."):
        if isinstance(cur, dict) and key in cur:
            cur = cur[key]
        else:
            return default
    return cur


def slugify(s: str) -> str:
    s = s.lower().strip()
    s = re.sub(r"[^a-z0-9]+", "-", s)
    return s.strip("-")


def client_paths(client_name: str) -> dict[str, Path]:
    base = REPO_ROOT / "clients" / client_name
    return {
        "base": base,
        "site": base / f"{client_name} Website",
        "site_dist": base / f"{client_name} Website" / "dist",
        "assets": base / f"{client_name} Assets",
        "logo_dir": base / f"{client_name} Assets" / "logo",
        "photos_dir": base / f"{client_name} Assets" / "photos",
        "intake": base / "Pipeline Data" / "intake" / "intake-form.json",
        "research": base / "Pipeline Data" / "research" / "research.json",
        "strategy": base / "Pipeline Data" / "strategy" / "strategy.json",
        "sitemap": base / "Pipeline Data" / "strategy" / "sitemap.json",
        "brand_dna": base / "Pipeline Data" / "brand" / "brand-dna.json",
        "proposal": base / f"{client_name} Proposal",
        "build_log": base / "Pipeline Data" / "logs" / "build-log.md",
        "pipeline_state": base / "Pipeline Data" / "logs" / "pipeline-state.json",
    }




# ─── Agency-side data (per-student profile) ───────────────────────────────
# Loaded once from website-factory/clients/_agency/agency-brand.json. Populated
# by /setup-agency. Provides every {{AGENCY_*}} value in proposal-template.html.

AGENCY_DIR = REPO_ROOT / "clients" / "_agency"
AGENCY_BRAND_JSON = AGENCY_DIR / "agency-brand.json"
AGENCY_ASSETS_DIR = AGENCY_DIR / "assets"


def load_agency_brand() -> dict[str, Any]:
    """Load the student's agency-brand.json. Halt if missing or has surviving sentinels."""
    if not AGENCY_BRAND_JSON.exists():
        print(
            f"\nERROR: {AGENCY_BRAND_JSON} not found.\n"
            "Run /setup-agency before /run-factory. The proposal builder cannot "
            "produce client proposals without your agency profile populated.",
            file=sys.stderr,
        )
        sys.exit(2)
    data = json.loads(AGENCY_BRAND_JSON.read_text())
    # Sentinel check: no __REQUIRED__ may survive
    flat = json.dumps(data)
    if "__REQUIRED__" in flat:
        print(
            f"\nERROR: {AGENCY_BRAND_JSON} still contains __REQUIRED__ sentinels.\n"
            "Run /setup-agency to finish populating every field.",
            file=sys.stderr,
        )
        sys.exit(2)
    return data


def compose_agency_vars(brand: dict[str, Any]) -> dict[str, str]:
    """Map agency-brand.json fields to {{AGENCY_*}} template variables."""
    founder = brand.get("founder", {}) or {}
    intro = brand.get("intro", {}) or {}
    vps = intro.get("value_props", []) or []
    proof = brand.get("proof", {}) or {}

    def vp_html(i):
        if i < len(vps):
            v = vps[i]
            return f"<strong>{v.get('strong', '')}</strong> {v.get('tail', '')}"
        return ""

    pricing = brand.get("pricing", {}) or {}
    formula = brand.get("winning_formula", {}) or {}
    reasons = brand.get("three_reasons", []) or []
    niche = brand.get("niche", {}) or {}

    def reason_field(idx: int, key: str) -> str:
        if idx < len(reasons):
            return reasons[idx].get(key, "") or ""
        return ""

    return {
        # Agency identity
        "AGENCY_NAME": brand.get("name", ""),
        "AGENCY_DOMAIN": brand.get("domain", ""),
        "AGENCY_FOUNDER_FIRST_NAME": founder.get("first_name", ""),
        "AGENCY_FOUNDER_FULL_NAME": founder.get("name", ""),
        "AGENCY_FOUNDER_TITLE": founder.get("title", ""),
        "AGENCY_PRIMARY_CONTACT": founder.get("first_name", ""),
        "AGENCY_PORTRAIT_CAPTION": founder.get("portrait_caption", ""),

        # Intro value-prop bullets + promise
        "AGENCY_VALUE_PROP_1_HTML": vp_html(0),
        "AGENCY_VALUE_PROP_2_HTML": vp_html(1),
        "AGENCY_VALUE_PROP_3_HTML": vp_html(2),
        "AGENCY_PROMISE_HTML": (
            f"{intro.get('promise', '')}<br><strong>{intro.get('promise_strong', '')}</strong>"
        ),

        # Reviews + Proof
        "AGENCY_REVIEW_COUNT": str(brand.get("review_total_count", "")),
        "AGENCY_REVIEW_PLATFORMS_LABEL": brand.get("review_platforms_label", ""),
        "AGENCY_PROOF_STAT": proof.get("stat", ""),
        "AGENCY_PROOF_STAT_SUBTITLE": proof.get("stat_subtitle", ""),
        "AGENCY_PROOF_INTRO_PARAGRAPH": proof.get("intro_paragraph", ""),
        "AGENCY_PROOF_VIDEO_URL": proof.get("video_url") or "",
        "AGENCY_PROOF_VIDEO_TITLE": proof.get("video_title", ""),
        "AGENCY_PROOF_VIDEO_THUMBNAIL_URL": proof.get("video_thumbnail_url", ""),
        "AGENCY_PROOF_VIDEO_CAPTION": proof.get("video_caption", "Watch the story"),

        # Three reasons (the proposal §E block)
        "AGENCY_REASON_ONE_TITLE": reason_field(0, "title"),
        "AGENCY_REASON_ONE_BODY": reason_field(0, "body"),
        "AGENCY_REASON_TWO_TITLE": reason_field(1, "title"),
        "AGENCY_REASON_TWO_BODY": reason_field(1, "body"),
        "AGENCY_REASON_THREE_TITLE": reason_field(2, "title"),
        "AGENCY_REASON_THREE_BODY": reason_field(2, "body"),

        # Winning formula outcome line (e.g. "More leads booked")
        "AGENCY_FORMULA_OUTCOME": formula.get("outcome_line", ""),

        # SOP unlock + blueprint
        "AGENCY_SOP_PASSWORD": brand.get("sop_password", ""),
        "AGENCY_BLUEPRINT_NAME": brand.get("blueprint_pdf_title", ""),
        "AGENCY_BLUEPRINT_DOC_TITLE": brand.get("blueprint_pdf_title", ""),

        # Pricing
        "AGENCY_PRICING_SETUP_FEE": str(pricing.get("setup_fee_default_usd", "")),
        "AGENCY_PRICING_MONTHLY_FEE": str(pricing.get("monthly_fee_default_usd", "")),
        "AGENCY_PRICING_CURRENCY": pricing.get("currency", "USD"),

        # Niche vocabulary (from agency-brand.json niche.{} block — sentinel-driven)
        "NICHE_NOUN": niche.get("noun", "trades"),
        "NICHE_NOUN_TITLE": niche.get("noun_title", "Trades"),
        "NICHE_NOUN_TITLE_PLURAL": niche.get("noun_title_plural", niche.get("noun_title", "Trades") + "s"),
        "NICHE_VERB": niche.get("verb", "service"),
        "NICHE_END_CUSTOMER": niche.get("end_customer", "customer"),
        "NICHE_END_CUSTOMER_TITLE": niche.get("end_customer_title", niche.get("end_customer", "customer").title()),
        "NICHE_END_CUSTOMER_PLURAL": niche.get("end_customer_plural", niche.get("end_customer", "customer") + "s"),
        "NICHE_END_CUSTOMER_TITLE_PLURAL": niche.get("end_customer_title_plural", niche.get("end_customer", "customer").title() + "s"),
        "NICHE_LEAD_MAGNET_CTA": niche.get("lead_magnet_cta", "Book My Free Assessment"),
        "OWNER_PRONOUN_SUBJ": brand.get("owner_pronoun_subj", "they"),

        # Footer tagline + AI mock messages + form privacy
        "AGENCY_FOOTER_TAGLINE": brand.get("footer_tagline", f"Built by {brand.get('name', 'the agency')}."),
        "AGENCY_FORM_PRIVACY": brand.get("form_privacy", "We will never share your information."),
        "AGENCY_VALUE_PROP_HEADLINE": intro.get("headline", intro.get("promise", "")),
        "AGENCY_AI_MOCK_MESSAGE_INBOUND": brand.get("ai_mock_message_inbound", "Hi, I need help with my project. Can someone come by today?"),
        "AGENCY_AI_MOCK_MESSAGE_REPLY": brand.get("ai_mock_message_reply", "Sorry to hear that , emergency calls go straight to {{OWNER_FIRST_NAME}}'s mobile. I just paged them and locked you a 7&nbsp;AM slot. What's the best number to text the address to?"),
        "AGENCY_AI_REVIEW_SAMPLE": brand.get("ai_review_sample", "Great experience from start to finish. Highly recommend."),

        # Pricing — all student-controlled via agency-brand.json
        "AGENCY_SETUP_FEE_PRICE": pricing.get("setup_fee_price_display", ""),
        "AGENCY_SETUP_FEE_STANDARD": pricing.get("setup_fee_standard_display", ""),
        "AGENCY_ONE_TIME_OFFER_PRICE": pricing.get("one_time_offer_price_display", ""),
        "AGENCY_MONTHLY_FEE_PRICE": pricing.get("monthly_fee_price_display", ""),
        "AGENCY_STACKED_VALUE_TOTAL": pricing.get("stacked_value_total_display", ""),

        # Value Stack — 5 line items (name + MSRP)
        "AGENCY_VALUE_STACK_LINE_1_NAME": _vs(pricing, 0, "name"),
        "AGENCY_VALUE_STACK_LINE_1_MSRP": _vs(pricing, 0, "msrp"),
        "AGENCY_VALUE_STACK_LINE_2_NAME": _vs(pricing, 1, "name"),
        "AGENCY_VALUE_STACK_LINE_2_MSRP": _vs(pricing, 1, "msrp"),
        "AGENCY_VALUE_STACK_LINE_3_NAME": _vs(pricing, 2, "name"),
        "AGENCY_VALUE_STACK_LINE_3_MSRP": _vs(pricing, 2, "msrp"),
        "AGENCY_VALUE_STACK_LINE_4_NAME": _vs(pricing, 3, "name"),
        "AGENCY_VALUE_STACK_LINE_4_MSRP": _vs(pricing, 3, "msrp"),
        "AGENCY_VALUE_STACK_LINE_5_NAME": _vs(pricing, 4, "name"),
        "AGENCY_VALUE_STACK_LINE_5_MSRP": _vs(pricing, 4, "msrp"),

        # ROI calculator defaults (illustrative; prospect can adjust sliders live)
        "ROI_DEFAULT_LEADS": str(pricing.get("roi_defaults", {}).get("leads_per_month", 40)),
        "ROI_DEFAULT_TICKET": str(pricing.get("roi_defaults", {}).get("ticket_size_display", "")),
        "ROI_DEFAULT_TICKET_NUMERIC": str(pricing.get("roi_defaults", {}).get("ticket_size_display", "")).replace(",", "") or "10000",
        "ROI_DEFAULT_LIFT": str(pricing.get("roi_defaults", {}).get("lift_display", "")),
    }


def _vs(pricing: dict[str, Any], idx: int, key: str) -> str:
    """Read a value_stack[idx][key] safely from pricing block."""
    stack = pricing.get("value_stack", []) or []
    if idx < len(stack):
        return stack[idx].get(key, "") or ""
    return ""


def compose_palette_css_vars(brand: dict[str, Any]) -> str:
    """
    Build a `:root` CSS block that overrides the proposal template's palette
    defaults with the agency's actual palette from agency-brand.json.

    If the agency hasn't set a palette field, the template's :root defaults win.
    """
    palette = brand.get("palette", {}) or {}
    if not palette:
        return ""  # Template defaults stand

    overrides = []
    mapping = {
        "primary": "--agency-primary",
        "primary_deep": "--agency-primary-deep",
        "accent": "--agency-accent",
        "accent_soft": "--agency-accent-soft",
        "primary_soft": "--agency-primary-soft",
    }
    for json_key, css_var in mapping.items():
        value = palette.get(json_key)
        if value:
            overrides.append(f"  {css_var}: {value};")

    if not overrides:
        return ""

    return (
        "<style data-agency-palette>\n"
        ":root {\n"
        + "\n".join(overrides)
        + "\n}\n"
        "</style>"
    )


def inject_review_carousel(html: str, brand: dict[str, Any]) -> str:
    """Replace AGENCY_REVIEWS_INJECTED marker block with cards from brand['reviews']."""
    reviews = brand.get("reviews", []) or []
    fb_svg = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#fff" d="M22 12.07C22 6.51 17.52 2 12 2S2 6.51 2 12.07c0 5.02 3.66 9.18 8.44 9.93v-7.03H7.9v-2.9h2.54V9.85c0-2.51 1.49-3.89 3.77-3.89 1.09 0 2.24.2 2.24.2v2.47h-1.26c-1.24 0-1.63.77-1.63 1.56v1.88h2.77l-.44 2.9h-2.33V22c4.78-.75 8.44-4.91 8.44-9.93z"/></svg>'
    google_svg = '<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A10.99 10.99 0 0012 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18a10.99 10.99 0 000 9.86l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/></svg>'

    cards = []
    for r in reviews:
        platform = (r.get("platform") or "facebook").lower()
        svg = google_svg if platform == "google" else fb_svg
        platform_label = platform.capitalize()
        rating = r.get("rating", 5.0)
        avatar = r.get("avatar_path", "")
        # Asset paths are copied into proposal_dir/agency-assets/, so rewrite the prefix:
        avatar_rel = avatar.replace("assets/", "agency-assets/")
        cards.append(
            f'<div class="agency-review-card">'
            f'<div class="agency-review-card-platform" aria-label="{platform_label}">{svg}</div>'
            f'<div class="agency-review-card-header">'
            f'<img class="agency-review-card-img" src="{avatar_rel}" alt="{r.get("name", "")}" loading="lazy">'
            f'<div class="agency-review-card-info">'
            f'<div class="agency-review-card-name">{r.get("name", "")}</div>'
            f'<div class="agency-review-card-stars"><span class="star-num">{rating}</span>&#9733;&#9733;&#9733;&#9733;&#9733;</div>'
            f'<div class="agency-review-card-source">{platform_label} Review</div>'
            f'</div></div>'
            f'<div class="agency-review-card-text">{r.get("text", "")}</div>'
            f'</div>'
        )

    injected = "\n          ".join(cards)
    return re.sub(
        r"<!-- AGENCY_REVIEWS_INJECTED_START -->.*?<!-- AGENCY_REVIEWS_INJECTED_END -->",
        f"<!-- AGENCY_REVIEWS_INJECTED_START -->\n          {injected}\n          <!-- AGENCY_REVIEWS_INJECTED_END -->",
        html,
        flags=re.DOTALL,
    )


def inject_client_builds(html: str, brand: dict[str, Any]) -> str:
    """Replace AGENCY_CLIENT_BUILDS marker block with tiles from brand['client_builds']."""
    builds = brand.get("client_builds", []) or []
    tiles = []
    for b in builds:
        screenshot = b.get("screenshot_path", "").replace("assets/", "agency-assets/")
        tiles.append(
            f'<article class="client-build-tile">'
            f'<a class="client-build-img-wrap" href="{b.get("url", "#")}" target="_blank" rel="noopener" aria-label="{b.get("name", "")}, open live site">'
            f'<img class="client-build-img" src="{screenshot}" alt="{b.get("name", "")} website" loading="lazy">'
            f'<div class="client-build-review-overlay">'
            f'<div class="client-build-review-name">{b.get("owner_name", "")}</div>'
            f'<div class="client-build-review-text">{b.get("owner_quote", "")}</div>'
            f'</div>'
            f'</a>'
            f'</article>'
        )

    injected = "\n        ".join(tiles)
    return re.sub(
        r"<!-- AGENCY_CLIENT_BUILDS_INJECTED_START -->.*?<!-- AGENCY_CLIENT_BUILDS_INJECTED_END -->",
        f"<!-- AGENCY_CLIENT_BUILDS_INJECTED_START -->\n        {injected}\n        <!-- AGENCY_CLIENT_BUILDS_INJECTED_END -->",
        html,
        flags=re.DOTALL,
    )


def inject_case_studies(html: str, brand: dict[str, Any]) -> str:
    """Replace AGENCY_CASE_STUDIES marker with video tiles from brand['case_studies']."""
    studies = brand.get("case_studies", []) or []
    tiles = []
    for s in studies:
        video = s.get("video_path", "").replace("assets/", "agency-assets/")
        poster = s.get("poster_path")
        poster_attr = f' poster="{poster.replace("assets/", "agency-assets/")}"' if poster else ""
        tiles.append(
            f'<div class="case-study-tile">'
            f'<video class="case-study-video" src="{video}"{poster_attr} preload="metadata" playsinline controls></video>'
            f'<div class="case-study-name">{s.get("owner_name", "")}</div>'
            f'</div>'
        )

    injected = "\n        ".join(tiles)
    return re.sub(
        r"<!-- AGENCY_CASE_STUDIES_INJECTED_START -->.*?<!-- AGENCY_CASE_STUDIES_INJECTED_END -->",
        f"<!-- AGENCY_CASE_STUDIES_INJECTED_START -->\n        {injected}\n        <!-- AGENCY_CASE_STUDIES_INJECTED_END -->",
        html,
        flags=re.DOTALL,
    )


def _render_feature_card(card: dict[str, Any], default_tag: str = "TRUST") -> str:
    """Render one feature-card from a dict from agency-brand.json winning_formula."""
    tag = card.get("tag", default_tag)
    tag_class = "feature-card-tag-" + tag.lower() if tag.lower() in ("trust", "conversion") else "feature-card-tag-traffic"
    classes = "feature-card"
    if card.get("ai_highlight"):
        classes += " feature-card-ai-highlight"
    bullets_html = "\n".join(
        f'            <li>{b}</li>' for b in (card.get("bullets") or [])
    )
    cta_html = ""
    if card.get("cta_label"):
        cta_html = (
            f'\n          <a class="feature-card-cta" href="{{{{LIVE_PREVIEW_URL}}}}{card.get("cta_anchor", "")}" '
            f'target="_blank" rel="noopener">{card["cta_label"]} &rarr;</a>'
        )
    return f"""<article class="{classes}">
          <div class="feature-card-head">
            <span class="feature-card-num">{card.get("num", "")}</span>
            <h4 class="feature-card-title">{card.get("title", "")}</h4>
            <span class="feature-card-tag {tag_class}">{tag}</span>
          </div>
          <p class="feature-card-meta">{card.get("meta", "")}</p>
          <ul class="feature-card-bullets">
{bullets_html}
          </ul>
          <div class="feature-card-stat-callout">
            <div class="feature-card-stat-num">{card.get("stat_num", "")}</div>
            <div class="feature-card-stat-text">{card.get("stat_text", "")}</div>
          </div>{cta_html}
        </article>"""


def inject_trust_cards(html: str, brand: dict[str, Any]) -> str:
    """Replace AGENCY_TRUST_CARDS marker with cards from winning_formula.trust.cards[]."""
    wf = brand.get("winning_formula", {}) or {}
    cards = (wf.get("trust", {}) or {}).get("cards", []) or []
    rendered = []
    for i, c in enumerate(cards):
        c = dict(c)
        c.setdefault("num", f"{i+1:02d}")
        c.setdefault("tag", "TRUST")
        rendered.append(_render_feature_card(c, default_tag="TRUST"))
    injected = "\n        \n        ".join(rendered)
    return re.sub(
        r"<!-- AGENCY_TRUST_CARDS_INJECTED_START -->.*?<!-- AGENCY_TRUST_CARDS_INJECTED_END -->",
        f"<!-- AGENCY_TRUST_CARDS_INJECTED_START -->\n        {injected}\n        <!-- AGENCY_TRUST_CARDS_INJECTED_END -->",
        html,
        flags=re.DOTALL,
    )


def inject_conversion_cards(html: str, brand: dict[str, Any]) -> str:
    """Replace AGENCY_CONVERSION_CARDS marker with cards from winning_formula.conversion.cards[]."""
    wf = brand.get("winning_formula", {}) or {}
    cards = (wf.get("conversion", {}) or {}).get("cards", []) or []
    rendered = []
    for i, c in enumerate(cards):
        c = dict(c)
        c.setdefault("num", f"{i+1:02d}")
        c.setdefault("tag", "CONVERT")
        rendered.append(_render_feature_card(c, default_tag="CONVERT"))
    injected = "\n        \n        ".join(rendered)
    return re.sub(
        r"<!-- AGENCY_CONVERSION_CARDS_INJECTED_START -->.*?<!-- AGENCY_CONVERSION_CARDS_INJECTED_END -->",
        f"<!-- AGENCY_CONVERSION_CARDS_INJECTED_START -->\n        {injected}\n        <!-- AGENCY_CONVERSION_CARDS_INJECTED_END -->",
        html,
        flags=re.DOTALL,
    )


def inject_traffic_feature_card(html: str, brand: dict[str, Any]) -> str:
    """Replace AGENCY_TRAFFIC_FEATURE_CARD marker with the Traffic accordion's lead card."""
    wf = brand.get("winning_formula", {}) or {}
    card = (wf.get("traffic", {}) or {}).get("feature_card") or {}
    if not card:
        return html
    card = dict(card)
    card.setdefault("num", "01")
    card.setdefault("tag", "SEO")
    rendered = _render_feature_card(card, default_tag="SEO")
    return re.sub(
        r"<!-- AGENCY_TRAFFIC_FEATURE_CARD_INJECTED_START -->.*?<!-- AGENCY_TRAFFIC_FEATURE_CARD_INJECTED_END -->",
        f"<!-- AGENCY_TRAFFIC_FEATURE_CARD_INJECTED_START -->\n        {rendered}\n        <!-- AGENCY_TRAFFIC_FEATURE_CARD_INJECTED_END -->",
        html,
        flags=re.DOTALL,
    )


def inject_traffic_audit_bullets(html: str, brand: dict[str, Any]) -> str:
    """Replace AGENCY_TRAFFIC_BULLETS marker with the Traffic accordion's SEO audit bullets."""
    wf = brand.get("winning_formula", {}) or {}
    bullets = (wf.get("traffic", {}) or {}).get("audit_bullets") or []
    rendered = "\n".join(f'            <li>{b}</li>' for b in bullets)
    return re.sub(
        r"<!-- AGENCY_TRAFFIC_BULLETS_INJECTED_START -->.*?<!-- AGENCY_TRAFFIC_BULLETS_INJECTED_END -->",
        f"<!-- AGENCY_TRAFFIC_BULLETS_INJECTED_START -->\n{rendered}\n            <!-- AGENCY_TRAFFIC_BULLETS_INJECTED_END -->",
        html,
        flags=re.DOTALL,
    )


def copy_agency_assets(proposal_dir: Path) -> None:
    """Copy clients/_agency/assets/* into the per-client proposal's agency-assets/."""
    target = proposal_dir / "agency-assets"
    if AGENCY_ASSETS_DIR.exists():
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(AGENCY_ASSETS_DIR, target)


def compose_vars(client_name: str, paths: dict[str, Path]) -> dict[str, str]:
    """Compose the {{VAR}} substitution map from our pipeline outputs."""
    intake = read_json(paths["intake"])
    research = read_json(paths["research"])
    strategy = read_json(paths["strategy"])
    brand_dna = read_json(paths["brand_dna"])

    # Identity
    company_name = pick_first(
        get_path(brand_dna, "company_name"),
        intake.get("businessName"),
        research.get("businessName"),
        client_name,
    )
    # Short brand mark for headers + mobile bar mockup. Prefer the
    # brand-dna.company.shortName field; fall back to the first word of
    # company_name (so "Acme Detail" -> "Acme", "Acme Roofing" -> "Acme",
    # "Pretoria Coffee Co" -> "Pretoria"). The legacy suffix-strip logic
    # (which hardcoded " Roofing" / " Solutions") is gone.
    company_brand = pick_first(
        get_path(brand_dna, "company.shortName"),
        company_name.split()[0].strip() if company_name else company_name,
    )
    company_full = pick_first(get_path(brand_dna, "company.full_legal_name"), company_name)
    domain = pick_first(intake.get("websiteUrl"), get_path(brand_dna, "company.url"), "")
    domain = re.sub(r"^https?://(www\.)?", "", domain or "").rstrip("/")

    # Owner
    owner_full = pick_first(
        get_path(brand_dna, "founder.name"),
        get_path(brand_dna, "team.founder.name"),
        research.get("ownerName"),
        "",
    )
    owner_first = pick_first(
        get_path(brand_dna, "founder.first_name"),
        owner_full.split(" ")[0] if owner_full else "",
    )
    phone_raw = pick_first(
        get_path(brand_dna, "contact.phone"),
        intake.get("phone"),
        research.get("phone"),
        "",
    )
    phone_digits = "".join(c for c in str(phone_raw) if c.isdigit())
    if phone_digits.startswith("1") and len(phone_digits) == 11:
        phone_digits = phone_digits[1:]

    # Geography. Research currently writes `primaryCity` (Stage 2 schema); brand-dna
    # nests under `address.city` (Stage 7 schema). Read both so the proposal works
    # whether or not Stage 7 has been run yet.
    city_primary = pick_first(
        get_path(brand_dna, "address.city"),
        get_path(research, "gbp.city"),
        research.get("primaryCity"),
        research.get("city"),
        "",
    )
    state_code = pick_first(
        get_path(brand_dna, "address.state"),
        get_path(research, "gbp.state"),
        research.get("state"),
        "",
    )
    state_full = pick_first(get_path(brand_dna, "state_full"), STATE_FULL.get((state_code or "").upper(), state_code or ""))
    region_marketing = pick_first(
        get_path(brand_dna, "region_marketing"),
        REGION_MARKETING.get(((state_code or "").upper(), city_primary)),
        f"Greater {city_primary}" if city_primary else "your service area",
    )
    metro = city_primary  # short metro name fallback

    # Service-area cities
    cities = pick_first(strategy.get("service_areas"), research.get("serviceAreas"), [])
    if isinstance(cities, list) and cities:
        cities_clean = [c if isinstance(c, str) else c.get("city", "") for c in cities]
        cities_clean = [c for c in cities_clean if c]
    else:
        cities_clean = [city_primary] if city_primary else []
    city_2 = cities_clean[1] if len(cities_clean) > 1 else ""
    city_3 = cities_clean[2] if len(cities_clean) > 2 else ""
    city_list_secondary = ", ".join(cities_clean[3:5]) if len(cities_clean) > 3 else ""
    city_count = len(cities_clean)
    cities_inline = cities_clean[:3]
    extra_count = max(0, city_count - 3)
    if extra_count > 0 and len(cities_clean) > 3:
        city_list_additional = ", ".join(cities_clean[3:6]) + (f", plus {city_count - 6} more" if city_count > 6 else "")
    else:
        city_list_additional = ", ".join(cities_clean[3:]) if len(cities_clean) > 3 else ""
    city_count_more_short = max(0, city_count - 3)

    # Trust signals
    review_count = pick_first(
        research.get("googleReviewCount"),
        get_path(research, "gbp.review_count"),
        get_path(brand_dna, "trust.google_review_count"),
        0,
    )
    review_rating = pick_first(
        research.get("googleRating"),
        get_path(research, "gbp.rating"),
        get_path(brand_dna, "trust.google_rating"),
        5.0,
    )
    # Niche-agnostic completed-projects count. Reads from a few candidate
    # brand-dna paths (in priority order: explicit projects_completed
    # field, then legacy roofs_completed, then a sensible default). The
    # placeholder is renamed to PROJECTS_COMPLETED below.
    projects_completed = pick_first(
        get_path(brand_dna, "company.projects_completed"),
        get_path(brand_dna, "trust.projects_completed"),
        get_path(brand_dna, "company.roofs_completed"),
        get_path(brand_dna, "trust.roofs_completed"),
        100,
    )
    founding_year = pick_first(
        get_path(brand_dna, "founding_year"),
        get_path(brand_dna, "company.founding_year"),
        research.get("founding_year"),
    )
    if not founding_year:
        years_in_biz_raw = pick_first(
            get_path(brand_dna, "trust.years_in_business"),
            get_path(brand_dna, "team.founder.yearsExp"),
            10,
        )
        years_in_biz_int = int(re.sub(r"\D", "", str(years_in_biz_raw)) or 10)
        founding_year = datetime.now().year - years_in_biz_int
    years_in_business = datetime.now().year - int(founding_year)
    bbb_rating = pick_first(
        get_path(brand_dna, "company.certifications.bbb_rating"),
        get_path(research, "bbb.rating"),
        get_path(brand_dna, "trust.bbb_rating"),
        "",
    )
    bbb_number = pick_first(
        get_path(brand_dna, "company.certifications.bbb_number"),
        get_path(research, "bbb.business_id"),
        "",
    )

    # Pricing
    setup_fee_default = pick_first(
        get_path(brand_dna, "pricing.setup_fee_default"),
        intake.get("setup_fee_default"),
        "5,000",
    )

    # Logo HTML — populated after asset copy has confirmed the logo file exists
    company_logo_html = f'<img src="agency-assets/client-logo.png" alt="{company_name}">'

    # Brand short for mock-mobile-bar (uppercase, capped at 10 chars).
    # company_brand is already the short form (first word of company_name
    # or the explicit brand-dna.company.shortName), so we just uppercase
    # + truncate. No niche-specific suffix list.
    brand_short = (company_brand or company_name or "").upper()[:10]

    return {
        "CLIENT_SLUG": slugify(client_name),
        "COMPANY_NAME": company_name or "",
        "COMPANY_BRAND": company_brand or "",
        "COMPANY_FULL_NAME": company_full or "",
        "COMPANY_DOMAIN": domain or "",
        "COMPANY_LOGO_HTML": company_logo_html,
        "COMPANY_BRAND_SHORT": brand_short,
        "OWNER_FIRST_NAME": owner_first or "",
        "OWNER_FULL_NAME": owner_full or "",
        "OWNER_PHONE": phone_raw or "",
        "OWNER_PHONE_TEL": phone_digits or "",
        "REGION_FULL": region_marketing or "",
        "METRO": metro or "",
        "STATE_FULL": state_full or "",
        "STATE_CODE": (state_code or "").upper(),
        "CITY_PRIMARY": city_primary or "",
        "CITY_PRIMARY_SLUG": slugify(city_primary or ""),
        "CITY_2": city_2 or "",
        "CITY_3": city_3 or "",
        "CITY_LIST_SECONDARY": city_list_secondary or "",
        "CITY_LIST_ADDITIONAL": city_list_additional or "",
        "CITY_COUNT": str(city_count),
        "CITY_COUNT_MORE_SHORT": str(city_count_more_short),
        "REVIEW_COUNT": str(review_count),
        "REVIEW_RATING": f"{float(review_rating):.1f}",
        "PROJECTS_COMPLETED": str(projects_completed),
        # Legacy alias for proposal templates that still reference
        # {{ROOFS_COMPLETED}}. Both render the same number. Remove the
        # legacy alias once all proposal templates have migrated to
        # PROJECTS_COMPLETED.
        "ROOFS_COMPLETED": str(projects_completed),
        "YEARS_IN_BUSINESS": str(years_in_business),
        "FOUNDING_YEAR": str(founding_year),
        "BBB_RATING": (str(bbb_rating).upper() if bbb_rating else ""),
        "BBB_NUMBER": str(bbb_number) if bbb_number else "",
        "SETUP_FEE_DEFAULT": str(setup_fee_default).replace("$", ""),
        "LIVE_PREVIEW_URL": _resolve_live_preview_url(client_name),
    }


def _resolve_live_preview_url(client_name: str) -> str:
    """Pick the best preview URL for the laptop iframe in the proposal.
    Priority:
      1. clients/[X]/Pipeline Data/deploy/vercel-url.txt — first https://*.vercel.app line
      2. Fallback to '../build/index.html' (local snapshot — works for offline preview only;
         Vite SPA assets won't resolve when proposal-dir is hosted on a separate domain).
    """
    deploy_file = REPO_ROOT / "clients" / client_name / "Pipeline Data" / "deploy" / "vercel-url.txt"
    if deploy_file.exists():
        for line in deploy_file.read_text().splitlines():
            # Pull the first https://*.vercel.app URL
            import re
            m = re.search(r"https://[a-z0-9.-]+\.vercel\.app", line)
            if m:
                return m.group(0)
    return "../build/index.html"


# ----- asset copy --------------------------------------------------------


def copy_agency_static(proposal_dir: Path) -> None:
    """Copy templates/proposal/agency-logo.svg + agency-assets/ wholesale into the proposal dir."""
    proposal_dir.mkdir(parents=True, exist_ok=True)
    if TEMPLATE_LOGO.exists():
        shutil.copyfile(TEMPLATE_LOGO, proposal_dir / "agency-logo.svg")
    if AGENCY_ASSETS.exists():
        target = proposal_dir / "agency-assets"
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(AGENCY_ASSETS, target)


def copy_client_logo(logo_dir: Path, proposal_dir: Path) -> Path | None:
    """Pick the highest-resolution logo variant; copy to proposal/agency-assets/client-logo.{ext}."""
    if not logo_dir.exists():
        return None
    # Preference order: webp > svg > png > jpg
    for ext in ("webp", "svg", "png", "jpg", "jpeg"):
        for candidate in sorted(logo_dir.glob(f"*.{ext}")):
            target = proposal_dir / "agency-assets" / f"client-logo.{ext}"
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(candidate, target)
            return target
    return None


def pick_gmb_cover(photos_dir: Path) -> Path | None:
    """Heuristic: drone > banner > truck > stock fallback."""
    if not photos_dir.exists():
        return None
    photos = list(photos_dir.glob("*.*"))
    photos = [p for p in photos if p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}]
    if not photos:
        return None
    for keywords in PHOTO_HEURISTIC:
        for p in photos:
            name = p.name.lower()
            if any(k in name for k in keywords):
                return p
    return photos[0]  # First available


def copy_gmb_cover(photos_dir: Path, proposal_dir: Path) -> Path | None:
    """Copy the heuristic-picked photo to proposal/agency-assets/gmb-cover.webp, optimised to ~1200px."""
    src = pick_gmb_cover(photos_dir)
    target = proposal_dir / "agency-assets" / "gmb-cover.webp"
    if not src:
        # Fall back to agency stock
        fallback = AGENCY_ASSETS / "founder-about.png"
        if fallback.exists():
            try:
                subprocess.run(
                    ["python3", str(OPTIMISE_TOOL), str(fallback), str(target), "--max-width", "1200", "--quality", "85"],
                    check=True,
                )
                return target
            except subprocess.CalledProcessError:
                shutil.copyfile(fallback, target.with_suffix(".png"))
                return target.with_suffix(".png")
        return None
    try:
        subprocess.run(
            ["python3", str(OPTIMISE_TOOL), str(src), str(target), "--max-width", "1200", "--quality", "85"],
            check=True,
        )
        return target
    except subprocess.CalledProcessError:
        # Pillow path fell over — fall back to a straight copy
        shutil.copyfile(src, target)
        return target


def copy_build_iframe(site_dist: Path, proposal_dir: Path) -> bool:
    """Copy the per-client dist/ into proposal/build/ so the iframe at ../build/index.html resolves."""
    if not site_dist.exists():
        return False
    target = proposal_dir / "build"
    if target.exists():
        shutil.rmtree(target)
    shutil.copytree(site_dist, target)
    return True


# ----- PAGE_DATA generation ----------------------------------------------


def _normalise_services(strategy: dict[str, Any]) -> list[dict[str, str]]:
    """Return strategy.services as a list of {name, slug} dicts."""
    out: list[dict[str, str]] = []
    for s in (strategy.get("services") or []):
        if isinstance(s, dict):
            slug = s.get("slug")
            name = s.get("name") or slug
        else:
            name = s
            slug = slugify(s)
        if slug:
            out.append({"name": str(name), "slug": str(slug)})
    return out


def _normalise_areas(strategy: dict[str, Any]) -> list[str]:
    """Return strategy.service_areas as a list of city-name strings."""
    out: list[str] = []
    for a in (strategy.get("service_areas") or []):
        if isinstance(a, dict):
            city = a.get("city") or a.get("name", "")
        else:
            city = a
        if city:
            out.append(str(city))
    return out


def _find_service(services: list[dict[str, str]], *needles: str) -> dict[str, str] | None:
    """Return the first service whose slug or name contains any of the given lowercase needles."""
    for s in services:
        hay = (s["slug"] + " " + s["name"]).lower()
        if any(n in hay for n in needles):
            return s
    return None


def _js_str(s: str) -> str:
    """Escape a Python string for safe inclusion as a JS double-quoted string literal."""
    return (s or "").replace("\\", "\\\\").replace('"', '\\"').replace("\n", " ").replace("\r", " ").replace("\t", " ")


def derive_page_data(strategy: dict[str, Any], owner_first: str, brand_short: str, sitemap: dict[str, Any] | None = None, niche_slug: str | None = None) -> tuple[str, dict[str, str]]:
    """
    Generate the PAGE_DATA JS object literal the proposal template's openPage()
    modal expects. Each section is a 3-tuple [name, description, tag]; each
    page carries `title`, `url`, `sections`.

    The page list comes from the active niche template's
    `templates/{niche-slug}/niche-playbook/proposal-pages.json`. There is no
    built-in default; if the file is missing, this function raises
    NoProposalPagesError.

    The proposal template HTML carries a fixed sitemap-pyramid + silo chip
    layout that references certain static page IDs (home, about, services,
    service-areas, gallery, blog, contact, reviews, financing, locations).
    Each niche template must ship a proposal-pages.json that covers those
    IDs; the niche may add aliases (stormdamage / bookings / etc.) on top.

    `sitemap` is the parsed sitemap.json (Pipeline Data/strategy/sitemap.json).
    When passed, it's the canonical source for actual page counts (location_pages,
    blog_posts, utility_pages) since strategy.service_areas may list 12 cities
    but only 6 dedicated /service-area/<slug> pages get rendered.

    `niche_slug` is the active niche from stack-state.json. When None, this
    function reads stack-state.json itself.

    Returns (page_data_js, sitemap_extras) where sitemap_extras carries the
    silo-chip HTML and counts that the template substitutes into the pyramid.
    """
    services = _normalise_services(strategy)
    areas = _normalise_areas(strategy)
    service_count = len(services)
    city_count = len(areas)

    # Pull actual page counts from sitemap.json if present (canonical source).
    # Fall back to strategy-derived counts when sitemap is missing.
    sitemap = sitemap or {}
    actual_service_pages = len(sitemap.get("service_pages") or []) or service_count
    actual_location_pages = len(sitemap.get("location_pages") or []) or min(6, city_count)
    actual_blog_posts = len(sitemap.get("blog_posts") or [])
    actual_utility_pages = len(sitemap.get("utility_pages") or [])
    sitemap_total = sitemap.get("page_count")

    # Load the per-niche page list from the active niche template's playbook.
    if niche_slug is None:
        niche_slug = _resolve_active_niche()
    proposal_pages = _load_proposal_pages(niche_slug)

    # Universal token map applied to every section name + description string.
    base_tokens: dict[str, str] = {
        "owner_first": owner_first or "Owner",
        "brand_short": brand_short or "the company",
        "service_count": str(service_count),
        "city_count": str(city_count),
    }

    def _expand_sections(section_list: list[dict[str, Any]], extra_tokens: dict[str, str] | None = None) -> list[list[str]]:
        tokens = {**base_tokens, **(extra_tokens or {})}
        out: list[list[str]] = []
        for s in section_list:
            name = _sub_tokens(s.get("name", ""), tokens)
            desc = _sub_tokens(s.get("description", ""), tokens)
            tag = s.get("tag", "Pitch")
            out.append([name, desc, tag])
        return out

    pages: list[dict[str, Any]] = []
    # Pyramid-eligible pages tracked separately (in pyramid order: root,
    # core tier, pillar tier). Per-service + per-area expansions don't
    # render in the pyramid; they appear as silo chips below it.
    pyramid_pages: list[dict[str, Any]] = []

    # Static pages from the niche's proposal-pages.json `pages` array.
    for page in proposal_pages.get("pages", []):
        entry = {
            "id": page["id"],
            "title": _sub_tokens(page["title"], base_tokens),
            "url": page["url"],
            "sections": _expand_sections(page.get("sections", [])),
        }
        pages.append(entry)
        # Track pyramid placement metadata for the renderer below.
        pyramid_pages.append({
            "id": page["id"],
            "title": entry["title"],
            "tier": page.get("tier", "core"),
            "hasSilos": page.get("hasSilos"),
        })

    # Per-service page template expansion (one /services/{slug} per service).
    per_service_tpl = proposal_pages.get("perServicePageTemplate")
    if per_service_tpl:
        for svc in services:
            svc_tokens = {
                "service_name": svc.get("name", ""),
                "service_slug": svc.get("slug", ""),
            }
            pages.append({
                "id": f"services/{svc['slug']}",
                "title": svc["name"],
                "url": f"/services/{svc['slug']}",
                "sections": _expand_sections(per_service_tpl.get("sections", []), svc_tokens),
            })

    # Per-area page template expansion (capped at 6).
    per_area_tpl = proposal_pages.get("perAreaPageTemplate")
    if per_area_tpl:
        for city in areas[:6]:
            slug = slugify(city)
            area_tokens = {"city": city}
            pages.append({
                "id": f"service-area/{slug}",
                "title": city,
                "url": f"/service-area/{slug}",
                "sections": _expand_sections(per_area_tpl.get("sections", []), area_tokens),
            })

    # Alias pages: resolve URL by matching service needles, with fallback.
    for alias in proposal_pages.get("aliasPages", []):
        needles = alias.get("urlFromService") or []
        matched = _find_service(services, *needles) if needles else None
        if matched:
            alias_url = f"/services/{matched['slug']}"
            alias_title = matched["name"] if alias.get("fallbackTitleFromService") else alias["title"]
        else:
            alias_url = alias.get("fallbackUrl", "/")
            alias_title = alias["title"]
        alias_title_resolved = _sub_tokens(alias_title, base_tokens)
        pages.append({
            "id": alias["id"],
            "title": alias_title_resolved,
            "url": alias_url,
            "sections": _expand_sections(alias.get("sections", [])),
        })
        pyramid_pages.append({
            "id": alias["id"],
            "title": alias_title_resolved,
            "tier": alias.get("tier", "pillar"),
            "hasSilos": alias.get("hasSilos"),
        })

    # Format as a JS object literal that the template's openPage() expects.
    # Sections are 3-tuples [name, description, tag]; each page carries
    # name, title, url, sections.
    js = "const PAGE_DATA = {\n"
    for p in pages:
        js += f'  "{p["id"]}": {{\n'
        js += f'    title: "{_js_str(p["title"])}",\n'
        js += f'    url: "{_js_str(p["url"])}",\n'
        js += f'    sections: [\n'
        for s in p["sections"]:
            name, desc, tag = s
            js += f'      ["{_js_str(name)}", "{_js_str(desc)}", "{_js_str(tag)}"],\n'
        js += f'    ]\n'
        js += "  },\n"
    js += "};\n"

    # Sitemap extras: silo chips + counts for the pyramid below the equation row.
    # Service silo chips: top 6 services (the template renders a single-line strip
    # so we cap at 6 to avoid wrapping into a second row). Plus a "+N more" pill
    # if the strategy lists more than 6.
    service_chip_html = "".join(
        f'<span class="silo-chip">{_html_attr(s["name"])}</span>' for s in services[:6]
    )
    if service_count > 6:
        service_chip_html += f'<span class="silo-chip">+ {service_count - 6} more</span>'

    # Location silo chips: top 3 cities + "+N more" if the strategy lists more.
    location_chip_html = "".join(
        f'<span class="silo-chip">{_html_attr(c)}</span>' for c in areas[:3]
    )
    if city_count > 3:
        location_chip_html += f'<span class="silo-chip">+ {city_count - 3} more</span>'

    # Silo pages = service detail pages + location detail pages.
    # Use sitemap.json's actual counts (canonical source) when available so the
    # pyramid stat reflects what was really shipped, not what strategy lists.
    silo_page_count = actual_service_pages + actual_location_pages

    # Total pages: prefer sitemap.json's `page_count` field (computed by
    # Stage 4 as 1 home + N service + N location + N blog + N utility).
    # Fall back to a derived sum when sitemap is missing.
    if sitemap_total:
        total_page_count = int(sitemap_total)
    else:
        # 1 home + service detail pages + location detail pages + blog posts +
        # utility pages (about/contact/gallery/reviews/financing). The "indexes"
        # (Services, Service Areas) are part of the route shell but not counted
        # as standalone content pages in the proposal spec.
        total_page_count = (
            1                         # home
            + actual_service_pages
            + actual_location_pages
            + actual_blog_posts
            + (actual_utility_pages or 5)  # default to 5 default utility pages
        )

    # Render the .sitemap-pyramid block from pyramid_pages tier metadata.
    pyramid_html = _render_pyramid(
        pyramid_pages,
        service_count=service_count,
        city_count=city_count,
        service_chip_html=service_chip_html,
        location_chip_html=location_chip_html,
        silo_page_count=silo_page_count,
        total_page_count=total_page_count,
    )

    core_count = sum(1 for p in pyramid_pages if p["tier"] == "core")
    pillar_count = sum(1 for p in pyramid_pages if p["tier"] == "pillar")

    sitemap_extras = {
        "SERVICE_COUNT": str(service_count),
        "SERVICE_CHIPS_HTML": service_chip_html,
        "LOCATION_CHIPS_HTML": location_chip_html,
        "SILO_PAGE_COUNT": str(silo_page_count),
        "TOTAL_PAGE_COUNT": str(total_page_count),
        "PYRAMID_HTML": pyramid_html,
        "PYRAMID_CORE_COUNT": str(core_count),
        "PYRAMID_PILLAR_COUNT": str(pillar_count),
    }

    return js, sitemap_extras


def _render_pyramid_box(page: dict[str, Any], box_class: str, service_count: int, city_count: int) -> str:
    """Render a single page-box inside the pyramid. The onclick + onkeydown
    bindings match the existing template's handler so openPage() still
    routes through PAGE_DATA at runtime."""
    page_id = page["id"]
    title = page["title"]
    # has-silos modifier + data-count badge when the page fans out to
    # silo expansions (perServicePageTemplate -> "service",
    # perAreaPageTemplate -> "city").
    has_silos = page.get("hasSilos")
    silo_classes = " has-silos" if has_silos else ""
    if has_silos == "service":
        data_count = f' data-count="+{service_count}"'
    elif has_silos == "city":
        data_count = f' data-count="+{city_count}"'
    else:
        data_count = ""
    return (
        f'<div class="page-box {box_class}{silo_classes}"{data_count} role="button" '
        f'tabindex="0" onclick="openPage(\'{_js_str(page_id)}\')" '
        f'onkeydown="if(event.key===\'Enter\'||event.key===\' \'){{event.preventDefault();'
        f'openPage(\'{_js_str(page_id)}\')}}">{_html_attr(title)}</div>'
    )


def _render_pyramid(
    pyramid_pages: list[dict[str, Any]],
    service_count: int,
    city_count: int,
    service_chip_html: str,
    location_chip_html: str,
    silo_page_count: int,
    total_page_count: int,
) -> str:
    """Render the complete .sitemap-pyramid block from per-niche tier
    metadata. Replaces the previously-hardcoded 5-core / 7-pillar layout
    with a data-driven one. The CSS classes match the existing template
    (page-box.root, page-box.core, page-box.pillar) so styling continues
    to work without changes.
    """
    roots = [p for p in pyramid_pages if p["tier"] == "root"]
    cores = [p for p in pyramid_pages if p["tier"] == "core"]
    pillars = [p for p in pyramid_pages if p["tier"] == "pillar"]

    parts: list[str] = ['<div class="sitemap-pyramid">']

    # Root tier (typically one entry: Home)
    if roots:
        parts.append('  <div class="pyramid-tier">')
        for p in roots:
            parts.append(f'    {_render_pyramid_box(p, "root", service_count, city_count)}')
        parts.append('  </div>')

    # Tier 1 Core
    if cores:
        parts.append('  <div class="pyramid-trunk"></div>')
        parts.append('  <div class="pyramid-tier">')
        parts.append(f'    <div class="pyramid-tier-label">Tier 1 &middot; Core Pages</div>')
        parts.append('    <div class="pyramid-row">')
        for p in cores:
            parts.append(f'      <div class="tree-cell">{_render_pyramid_box(p, "core", service_count, city_count)}</div>')
        parts.append('    </div>')
        parts.append('  </div>')

    # Tier 2 Pillar
    if pillars:
        parts.append('  <div class="pyramid-trunk"></div>')
        parts.append('  <div class="pyramid-tier">')
        parts.append(f'    <div class="pyramid-tier-label">Tier 2 &middot; Pillar Pages</div>')
        parts.append('    <div class="pyramid-row">')
        for p in pillars:
            parts.append(f'      <div class="tree-cell">{_render_pyramid_box(p, "pillar", service_count, city_count)}</div>')
        parts.append('    </div>')
        parts.append('  </div>')

    # Silo groups (only render the surfaces that have content)
    has_service_silo = bool(service_chip_html and service_count > 0)
    has_location_silo = bool(location_chip_html and city_count > 0)
    if has_service_silo or has_location_silo:
        parts.append('  <div class="pyramid-silos">')
        if has_service_silo:
            parts.append('    <div class="silo-group">')
            parts.append(f'      <div class="silo-head"><span class="from">From</span> Services <span class="count">{service_count} pages</span></div>')
            parts.append(f'      <div class="silo-chips">{service_chip_html}</div>')
            parts.append('    </div>')
        if has_location_silo:
            parts.append('    <div class="silo-group">')
            parts.append(f'      <div class="silo-head"><span class="from">From</span> Locations <span class="count">{city_count} pages</span></div>')
            parts.append(f'      <div class="silo-chips">{location_chip_html}</div>')
            parts.append('    </div>')
        parts.append('  </div>')

    # Pyramid stats (counts now derive from the page list, not hardcoded)
    parts.append('  <div class="pyramid-stats">')
    parts.append(f'    <div class="pyramid-stat"><div class="num">{len(cores)}</div><div class="label">Core Pages</div></div>')
    parts.append(f'    <div class="pyramid-stat"><div class="num">{len(pillars)}</div><div class="label">Pillars</div></div>')
    parts.append(f'    <div class="pyramid-stat"><div class="num">{silo_page_count}</div><div class="label">Silo Pages</div></div>')
    parts.append(f'    <div class="pyramid-stat"><div class="num">{total_page_count}</div><div class="label">Total Pages</div></div>')
    parts.append(f'    <div class="pyramid-stat"><div class="num">100%</div><div class="label">SEO Indexed</div></div>')
    parts.append('  </div>')

    parts.append('</div>')
    return "\n".join(parts)


def _html_attr(s: str) -> str:
    """Escape a Python string for safe inclusion as inner HTML text."""
    return (s or "").replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace('"', "&quot;").replace("'", "&#39;")


# ----- substitution + write ----------------------------------------------


def substitute(template_html: str, vars_map: dict[str, str], page_data_js: str) -> str:
    out = template_html
    for k, v in vars_map.items():
        out = out.replace("{{" + k + "}}", v or "")

    # Inject PAGE_DATA before any existing const PAGE_DATA assignment, OR
    # at the top of the inline <script> block if the template uses the
    # generic form. The template typically has `const PAGE_DATA = { ... }`
    # baked in with placeholder content; we replace that whole block.
    page_data_re = re.compile(r"const\s+PAGE_DATA\s*=\s*\{[^;]*\};", re.DOTALL)
    if page_data_re.search(out):
        out = page_data_re.sub(page_data_js.rstrip(), out)
    else:
        # Fallback: inject just before </script>
        out = out.replace("</script>", page_data_js + "</script>", 1)
    return out


def find_unresolved_vars(html: str) -> list[str]:
    """Find any {{NAME}} placeholders that survived substitution.

    Per the template spec, the literal `{{VAR}}` is used as meta-syntax in HTML comments
    inside the template (documenting the placeholder pattern itself). Exclude
    that one literal from the validation set.
    """
    matches = re.findall(r"\{\{([A-Z_]+)\}\}", html)
    return sorted(set(matches) - {"VAR"})


# ----- main --------------------------------------------------------------


def main() -> int:
    parser = argparse.ArgumentParser(description="Stage 13: build the agency-branded proposal from the canonical template + per-client pipeline data.")
    parser.add_argument("--client", required=True, help="Client folder name under clients/")
    parser.add_argument("--skip-build-copy", action="store_true", help="Skip copying [X] Website/dist/ to [X] Proposal/build/")
    parser.add_argument("--dry-run", action="store_true", help="Compose vars + write proposal.html, skip asset copies")
    parser.add_argument('--validate-agency', action='store_true', help='Validate agency-brand.json + exit')
    args = parser.parse_args()

    if not TEMPLATE_HTML.exists():
        print(f"ERROR: template missing: {TEMPLATE_HTML}", file=sys.stderr)
        return 1

    # Load and validate the student's agency-brand.json first.
    # load_agency_brand() halts with a clear pointer to /setup-agency if the
    # file is missing or still contains __REQUIRED__ sentinels.
    agency_brand = load_agency_brand()

    if args.validate_agency:
        print(f"OK: {AGENCY_BRAND_JSON} validated (no surviving __REQUIRED__ sentinels).")
        return 0

    paths = client_paths(args.client)
    if not paths["base"].exists():
        print(f"ERROR: client folder not found: {paths['base']}", file=sys.stderr)
        return 1

    print(f"=== Stage 13 build-proposal for '{args.client}' ===\n")

    print("[1/6] composing vars from pipeline data")
    vars_map = compose_vars(args.client, paths)
    vars_map.update(compose_agency_vars(agency_brand))
    print(f"  {len(vars_map)} placeholders resolved (e.g. COMPANY_NAME='{vars_map.get('COMPANY_NAME', '')}', CITY_PRIMARY='{vars_map.get('CITY_PRIMARY', '')}', AGENCY_NAME='{vars_map.get('AGENCY_NAME', '')}')")

    proposal_dir = paths["proposal"]
    proposal_dir.mkdir(parents=True, exist_ok=True)

    if not args.dry_run:
        print("\n[2/6] copying agency-static dossier (agency-logo.svg + agency-assets/)")
        copy_agency_static(proposal_dir)

        print("\n[3/6] copying per-client logo + GMB cover")
        logo_path = copy_client_logo(paths["logo_dir"], proposal_dir)
        if logo_path:
            ext = logo_path.suffix.lstrip(".")
            vars_map["COMPANY_LOGO_HTML"] = f'<img src="agency-assets/client-logo.{ext}" alt="{vars_map["COMPANY_NAME"]}">'
        else:
            vars_map["COMPANY_LOGO_HTML"] = f'<span class="topbar-client-text">{vars_map["COMPANY_NAME"]}</span>'
        gmb = copy_gmb_cover(paths["photos_dir"], proposal_dir)
        if not gmb:
            print("  WARN: no GMB cover photo could be picked or generated", file=sys.stderr)

        if not args.skip_build_copy:
            print("\n[4/6] copying [X] Website/dist/ to [X] Proposal/build/")
            ok = copy_build_iframe(paths["site_dist"], proposal_dir)
            if not ok:
                print(f"  WARN: dist/ missing at {paths['site_dist']}; iframe will 404", file=sys.stderr)
        else:
            print("\n[4/6] skipping build copy (--skip-build-copy)")

    print("\n[5/6] generating PAGE_DATA from the website template route list")
    strategy = read_json(paths["strategy"])
    sitemap = read_json(paths["sitemap"]) if paths["sitemap"].exists() else {}
    owner_first = vars_map.get("OWNER_FIRST_NAME", "")
    brand_short = vars_map.get("COMPANY_BRAND_SHORT", "")
    page_data_js, sitemap_extras = derive_page_data(strategy, owner_first, brand_short, sitemap=sitemap)
    print(f"  {page_data_js.count('sections:')} page entries; "
          f"{sitemap_extras['SERVICE_COUNT']} services + {len([x for x in sitemap_extras['LOCATION_CHIPS_HTML'].split('silo-chip') if 'span' in x])} location chips")
    # Merge sitemap extras into the substitution map. These are NEW placeholders
    # introduced 2026-05-12 (sitemap pyramid + silo chips + total/silo counts +
    # location chip HTML) so the pyramid below the equation row reflects the
    # actual client services and city list, instead of the old hardcoded
    # "Repair, Replacement, ..." stub for everyone.
    vars_map.update(sitemap_extras)

    print("\n[6/6] substituting placeholders + writing proposal.html")
    template = TEMPLATE_HTML.read_text()
    out = substitute(template, vars_map, page_data_js)

    # Inject all agency-owned dynamic blocks from agency-brand.json
    out = inject_review_carousel(out, agency_brand)
    out = inject_client_builds(out, agency_brand)
    out = inject_case_studies(out, agency_brand)
    out = inject_trust_cards(out, agency_brand)
    out = inject_conversion_cards(out, agency_brand)
    out = inject_traffic_feature_card(out, agency_brand)
    out = inject_traffic_audit_bullets(out, agency_brand)
    print(f"  injected agency blocks: reviews + client-builds + case-studies + trust/conversion/traffic cards")

    # Inject the agency's palette as a <style data-agency-palette> override
    # right before </head> so the agency's brand colors win over the template's
    # :root defaults. If agency-brand.json has no palette block, the template
    # default :root stands.
    palette_block = compose_palette_css_vars(agency_brand)
    if palette_block:
        out = out.replace("</head>", f"{palette_block}\n</head>", 1)
        print(f"  injected agency palette overrides")
    proposal_html = proposal_dir / "proposal.html"
    proposal_html.write_text(out)
    # Vercel serves /index.html at the root URL; the canonical artifact is
    # proposal.html, so we mirror it as index.html so deployment "just works"
    # without needing a vercel.json rewrite (Rule 2 in by-agent/14-proposal.md).
    index_html = proposal_dir / "index.html"
    index_html.write_text(out)
    print(f"  wrote {proposal_html} ({len(out):,} bytes) + index.html mirror")

    # Validate
    print("\n=== Validation ===")
    unresolved = find_unresolved_vars(out)
    if unresolved:
        print(f"  FAIL: {len(unresolved)} unresolved placeholders:")
        for v in unresolved:
            print(f"    - {{{{{v}}}}}")
        rc = 2
    else:
        print("  PASS: zero unresolved {{VAR}} placeholders")
        rc = 0

    # Build IDs check — the website template is a Vite SPA so the section IDs land in the
    # bundled JS, NOT in the static dist/index.html shell. Grep dist/assets/*.js
    # instead. Vite's minifier emits the JSX `id="hero"` attribute as
    # `id:`hero`` (backtick template literal) in the React.createElement props
    # object, so the validator checks for both that form and the original-source
    # forms (in case a future static-HTML build path emits raw HTML).
    if not args.dry_run and not args.skip_build_copy:
        build_dir = proposal_dir / "build"
        if build_dir.exists():
            ids = ["hero", "about", "service-area"]
            haystack = ""
            index_html = build_dir / "index.html"
            if index_html.exists():
                haystack += index_html.read_text()
            assets_dir = build_dir / "assets"
            if assets_dir.exists():
                for js in assets_dir.glob("*.js"):
                    haystack += js.read_text(errors="ignore")
            missing = []
            for i in ids:
                # Match: id="X" (raw HTML / JSX source), id:"X" (some minifiers),
                # id:`X` (Vite/esbuild backtick template), id:'X' (other minifiers)
                patterns = [f'id="{i}"', f'id:"{i}"', f'id:`{i}`', f"id:'{i}'"]
                if not any(p in haystack for p in patterns):
                    missing.append(i)
            if missing:
                print(f"  WARN: build missing IDs in dist/assets/*.js: {', '.join(missing)} (proposal anchor links will not scroll)")
            else:
                print("  PASS: build carries all required IDs (#hero, #about, #service-area) in the bundled JS")
        else:
            print("  WARN: build/ directory not present in proposal/")

    # Update pipeline state
    state = read_json(paths["pipeline_state"])
    state["stage_13"] = "complete" if rc == 0 else "failed"
    state["stage_13_completed_at"] = datetime.now(timezone.utc).isoformat()
    paths["pipeline_state"].parent.mkdir(parents=True, exist_ok=True)
    paths["pipeline_state"].write_text(json.dumps(state, indent=2))

    log = paths["build_log"]
    log.parent.mkdir(parents=True, exist_ok=True)
    with log.open("a") as f:
        f.write(f"\n## Stage 13, Proposal ({datetime.now(timezone.utc).isoformat()})\n")
        f.write(f"Status: {'complete' if rc == 0 else 'failed'}\n")
        f.write(f"Output: {proposal_html.relative_to(REPO_ROOT)}\n")
        f.write(f"Unresolved placeholders: {len(unresolved)}\n")

    return rc


if __name__ == "__main__":
    sys.exit(main())
