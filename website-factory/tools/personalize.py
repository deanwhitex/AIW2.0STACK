#!/usr/bin/env python3
"""
Stage 10.2 personalize: inject schema markup, sitemap.xml, robots.txt into a
client's already-built Vite SPA.

Client-agnostic. Driven entirely by the client's Pipeline Data inputs:
- strategy/sitemap.json
- seo/audit-data.json
- research/research.json
- brand/brand-dna.json
- copy/copy-deck.md

Outputs (per round-1 fix: persist to public/ NOT dist/):
- <Client> Website/public/sitemap.xml (so Vite preserves across rebuilds)
- <Client> Website/public/robots.txt
- <Client> Website/index.html: JSON-LD @graph injected (source-of-truth)
- <Client> Website/dist/index.html: same JSON-LD @graph injected for the
  immediate already-built dist, plus sitemap.xml + robots.txt copied so the
  current dist matches the canonical public/ source.

The JSON-LD graph carries (per audit-data.json schema plan):
- Organization (publisher / footer identity)
- WebSite (sitewide handle)
- RoofingContractor (HQ) with AggregateRating, PostalAddress,
  GeoCoordinates, OpeningHoursSpecification, areaServed (Place array of N
  cities), sameAs, founder, knowsAbout, priceRange
- FAQPage (homepage, plus one per service page where copy-deck has Q/A)
- Service (one per service page)
- LocalBusiness (subtype RoofingContractor) per location page with city-
  specific GeoCoordinates and city-scoped areaServed
- Article (one per blog post)
- BreadcrumbList for every URL in the sitemap

Routing reconciliation: sitemap.json may use /areas/<slug> while the built
React Router renders at /service-area/<slug>. We rewrite to whatever the
actual built site exposes so the sitemap.xml URLs are crawlable.

Geo data: hand-curated real-world centroid coordinates from public sources
(US Census Bureau Gazetteer, USGS GNIS, OpenStreetMap geocoding). Per-client
overrides live in CLIENT_GEO below. New clients add a block here. No
invented coordinates.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any

REPO_ROOT = Path(__file__).resolve().parent.parent

DAY_NAMES = {
    "monday": "Monday",
    "tuesday": "Tuesday",
    "wednesday": "Wednesday",
    "thursday": "Thursday",
    "friday": "Friday",
    "saturday": "Saturday",
    "sunday": "Sunday",
}

# Per-client static config that cannot be reliably derived from JSON inputs.
# Coordinates are pulled from public sources (US Census Bureau Gazetteer,
# USGS GNIS, OpenStreetMap) for each named place's centroid. Each block keys
# city slugs (kebab-case of the city display name from research.serviceAreas).
# Per-client static config that cannot be reliably derived from JSON inputs.
# Coordinates are pulled from public sources (US Census Bureau Gazetteer,
# USGS GNIS, OpenStreetMap) for each named place's centroid. Each block keys
# city slugs (kebab-case of the city display name from research.serviceAreas).
#
# This dict ships EMPTY in the public repo. The student adds an entry for
# each of their clients before running Stage 10.2 personalize. The Acme
# Roofing example below shows the schema; remove it before production use.
CLIENT_CONFIG: dict[str, dict[str, Any]] = {
    # Example entry (delete before shipping a real client):
    "Acme Roofing": {
        "canonical_base": "https://acmeroofing.example",
        # HQ centroid: pulled from research.json HQ address geocode.
        "hq_slug": "example-city",
        "hq_geo": {"latitude": 0.0, "longitude": 0.0},
        # Per-city centroids. Use US Census Bureau Gazetteer or USGS GNIS.
        "city_geo": {
            "example-city": {"latitude": 0.0, "longitude": 0.0},
            "example-suburb": {"latitude": 0.0, "longitude": 0.0},
        },
        # Display-name overrides where Title Case of the kebab slug does
        # not match the natural city label.
        "city_display_overrides": {
            "example-city": "Example City",
            "example-suburb": "Example Suburb",
        },
        "state_code": "XX",
        # Pin the route prefix the React router exposes for location pages.
        "location_route_prefix": "/service-area",
        # Homepage FAQ block markers (where the homepage FAQ section starts
        # and ends in the per-client copy-deck.md). Adjust per copy-deck shape.
        "homepage_faq_marker_start": "## Section 11: FAQ",
        "homepage_faq_marker_end": "## Section 12:",
        # Per-service FAQ block markers. Adjust per copy-deck shape.
        "service_faq_markers": {
            "example-service": (
                "## H2: Frequently Asked Questions",
                "## CTA banner",
            ),
        },
    },
}


def load_json(p: Path) -> Any:
    with p.open(encoding="utf-8") as f:
        return json.load(f)


def load_text(p: Path) -> str:
    return p.read_text(encoding="utf-8")


def city_slug_from_display(name: str) -> str:
    """kebab-case the display name in a stable way.

    Strips punctuation, lowercases, hyphenates whitespace. For multi-word
    place names like 'Champions area, Houston' it collapses commas and
    whitespace to single hyphens.
    """
    cleaned = name.replace(",", " ").replace(".", "")
    parts = [p.lower() for p in cleaned.split() if p]
    return "-".join(parts)


def url_for(slug: str, canonical_base: str) -> str:
    if slug == "/":
        return f"{canonical_base}/"
    return f"{canonical_base}{slug}"


def rewrite_location_slug(slug: str, prefix: str) -> str:
    """Map sitemap.json location-page slug to the actual rendered route.

    sitemap.json may carry /areas/<city-slug>; the React Router exposes
    /service-area/<city-slug>. We rewrite to the actually-crawlable URL so
    the emitted sitemap.xml entries resolve.
    """
    if slug.startswith("/areas/"):
        return f"{prefix}/{slug[len('/areas/'):]}"
    if slug.startswith("/service-area/"):
        return slug
    return slug


def parse_opening_hours_from_per_day(business_hours: dict[str, Any]) -> list[dict[str, Any]]:
    """Per-day open/close."""
    spec: list[dict[str, Any]] = []
    grouped: dict[tuple[str, str], list[str]] = {}
    for day_key in ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"):
        entry = business_hours.get(day_key)
        if isinstance(entry, dict) and entry.get("open") and entry.get("close"):
            window = (entry["open"], entry["close"])
            grouped.setdefault(window, []).append(DAY_NAMES[day_key])
    for (opens, closes), days in grouped.items():
        spec.append({
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": days,
            "opens": opens,
            "closes": closes,
        })
    return spec


def parse_opening_hours(business_hours: dict[str, Any]) -> list[dict[str, Any]]:
    """Convert research.json business_hours into OpeningHoursSpecification.

    Supports two known shapes:
    1. Per-day map: {"monday": {"open": "...", "close": "..."}, ...} where
       saturday / sunday may be the literal string "BY APPOINTMENT" or
       "CLOSED".
    2. Single-window: {"open": "09:00", "close": "17:00", "tz": "..."} which
       implies M-F only.
    """
    # Detect per-day shape: any of the seven weekday keys present.
    has_per_day = any(
        day in business_hours
        for day in ("monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday")
    )
    if has_per_day:
        return parse_opening_hours_from_per_day(business_hours)

    # Single-window shape. Treat as Monday-Friday only.
    opens = business_hours.get("open")
    closes = business_hours.get("close")
    if opens and closes:
        return [{
            "@type": "OpeningHoursSpecification",
            "dayOfWeek": ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"],
            "opens": opens,
            "closes": closes,
        }]
    return []


def hours_human_string(business_hours: dict[str, Any]) -> str:
    """Short human-readable description for log output."""
    if "monday" in business_hours and isinstance(business_hours["monday"], dict):
        mon = business_hours["monday"]
        sat = business_hours.get("saturday", "")
        sun = business_hours.get("sunday", "")
        return f"Mon-Fri {mon.get('open')}-{mon.get('close')} {business_hours.get('tz', '')} (Sat: {sat}, Sun: {sun})"
    if "open" in business_hours and "close" in business_hours:
        return f"Mon-Fri {business_hours['open']}-{business_hours['close']} {business_hours.get('tz', '')}"
    return "(no hours data)"


def parse_faq_block(text: str, start_marker: str, end_marker: str) -> list[dict[str, str]]:
    """Extract Q/A pairs from a marker-delimited block.

    Tries (in order):
      1. Bulleted markdown form: "- Q: ...\\n- A: ..."
      2. Numbered form: "Qn. **...?**\\nA. ..." (3C copy-deck homepage)
      3. Plain form: "Q. ...\\nA. ..." (3C copy-deck service pages)
      4. Plain colon form: "Q: ...\\nA: ..."
      5. Numbered-list form: "N. **Q: ...?**\\nA: ..." or "N. Q: ...?\\nA: ..."
         (Smith copy-deck homepage and service pages)
    """
    start = text.find(start_marker)
    if start == -1:
        return []
    block_start = start + len(start_marker)
    end = text.find(end_marker, block_start) if end_marker else -1
    block = text[block_start:end] if end != -1 else text[block_start:]

    faqs: list[dict[str, str]] = []

    # Form 1: bulleted "- Q:" / "- A:"
    bulleted = re.compile(
        r"-\s*Q:\s*(.+?)\n-\s*A:\s*(.+?)(?=\n\n|\n-\s*Q:|\Z)",
        re.DOTALL,
    )
    matches = list(bulleted.finditer(block))
    if matches:
        return _collect_faq_matches(matches)

    # Form 2: numbered "Q1. **...**\nA. ..."
    numbered = re.compile(
        r"^Q\d+\.\s*\*\*(.+?)\*\*\s*\n+A\.\s*(.+?)(?=\n\nQ\d+\.|\n\n##|\n---|\Z)",
        re.DOTALL | re.MULTILINE,
    )
    matches = list(numbered.finditer(block))
    if matches:
        return _collect_faq_matches(matches)

    # Form 3: plain "Q. ...\nA. ..."
    plain_dot = re.compile(
        r"^Q\.\s*(.+?)\n+A\.\s*(.+?)(?=\n\nQ\.|\n\n##|\n\n---|\Z)",
        re.DOTALL | re.MULTILINE,
    )
    matches = list(plain_dot.finditer(block))
    if matches:
        return _collect_faq_matches(matches)

    # Form 4: plain "Q: ...\nA: ..."
    plain_colon = re.compile(
        r"^Q:\s*(.+?)\nA:\s*(.+?)(?=\n\nQ:|\n\n###|\n\n##|\Z)",
        re.DOTALL | re.MULTILINE,
    )
    matches = list(plain_colon.finditer(block))
    if matches:
        return _collect_faq_matches(matches)

    # Form 5: numbered-list "N. **Q: ...?**\nA: ..." or "N. Q: ...?\nA: ..."
    # Smith copy-deck uses this for both homepage (with **) and service pages (without **).
    numbered_list = re.compile(
        r"^\d+\.\s*\*?\*?Q:\s*(.+?)\*?\*?\s*\n+A:\s*(.+?)(?=\n\n\d+\.|\n\n##|\n\n###|\n---|\Z)",
        re.DOTALL | re.MULTILINE,
    )
    matches = list(numbered_list.finditer(block))
    if matches:
        return _collect_faq_matches(matches)

    return faqs


def _collect_faq_matches(matches: list[re.Match]) -> list[dict[str, str]]:
    out: list[dict[str, str]] = []
    for m in matches:
        q = re.sub(r"\s+", " ", m.group(1).strip().replace("\n", " "))
        a = re.sub(r"\s+", " ", m.group(2).strip().replace("\n", " "))
        # Strip surrounding ** if Q wraps a phrase in bold.
        q = q.strip("*").strip()
        out.append({"question": q, "answer": a})
    return out


def parse_homepage_faqs(copy_deck: str, cfg: dict[str, Any]) -> list[dict[str, str]]:
    return parse_faq_block(
        copy_deck,
        cfg["homepage_faq_marker_start"],
        cfg["homepage_faq_marker_end"],
    )


def parse_service_faqs(copy_deck: str, sitemap: dict[str, Any], cfg: dict[str, Any]) -> dict[str, list[dict[str, str]]]:
    """Extract per-service FAQs.

    For 3C copy-deck the H2 ``## H2: Frequently Asked Questions`` repeats
    across all service-page sections, so we walk service-page sections by
    section heading (``# N. Service Page: <name>`` or ``## N. Service Page: <name>``)
    and scope the FAQ search inside that section block.
    """
    out: dict[str, list[dict[str, str]]] = {}

    # Build per-service-page section boundaries by looking for the line
    # ``# N. Service Page: <name>`` (3C H1) or ``## N. Service Page: <name>``
    # H2-prefix pattern vs heading-based pattern.
    section_re = re.compile(r"^#{1,2} \d+\.\s*Service Page:.*$", re.MULTILINE)
    section_starts = [(m.start(), m.group()) for m in section_re.finditer(copy_deck)]

    if not section_starts:
        # Standard pattern: use the markers directly from cfg.
        for slug, (start_marker, end_marker) in cfg.get("service_faq_markers", {}).items():
            out[slug] = parse_faq_block(copy_deck, start_marker, end_marker)
        return out

    # 3C / Smith pattern: extract per-section text by slug.
    # Strategy: for each service page in sitemap, find the section heading
    # that matches its slug, then parse FAQ inside using cfg's in-section
    # FAQ markers (default 3C-shape).
    section_ranges = []
    for i, (start, _heading) in enumerate(section_starts):
        end = section_starts[i + 1][0] if i + 1 < len(section_starts) else len(copy_deck)
        section_ranges.append((start, end))

    in_section_start = cfg.get(
        "service_faq_in_section_start", "## H2: Frequently Asked Questions"
    )
    in_section_end = cfg.get(
        "service_faq_in_section_end", "## CTA banner"
    )

    for svc in sitemap.get("service_pages", []):
        slug = svc["slug"].split("/")[-1]
        # Find the section block whose heading line contains the service slug
        # path (most reliable) or whose first 200 chars contain the slug
        # words / title lead phrase.
        section_text = None
        title_lead = " ".join(svc.get("page_title", "").split()[:4]).lower()
        for start, end in section_ranges:
            head = copy_deck[start:start + 300].lower()
            slug_words = slug.replace("-", " ")
            if svc["slug"].lower() in head or slug_words in head or title_lead in head:
                section_text = copy_deck[start:end]
                break

        if section_text is None:
            out[slug] = []
            continue

        # Inside the section, parse the FAQ block using cfg markers.
        out[slug] = parse_faq_block(
            section_text,
            in_section_start,
            in_section_end,
        )

    return out


def normalize_areas_served(brand: dict[str, Any], research: dict[str, Any]) -> list[dict[str, Any]]:
    """Produce a stable list of {name, slug, display} for each service area.

    Source precedence:
    1. brand.contact.service_areas (already trimmed to the marketing list)
    2. research.serviceAreas (raw payload, may include "(general)" suffix)
    """
    items: list[dict[str, Any]] = []
    raw_list = brand.get("contact", {}).get("service_areas") or []
    if not raw_list:
        for it in research.get("serviceAreas", []):
            raw_list.append(it.get("city", ""))

    for raw in raw_list:
        raw = (raw or "").strip()
        if not raw:
            continue
        # Strip parenthetical descriptors like " (general)".
        clean = re.sub(r"\s*\([^)]*\)\s*", "", raw).strip()
        items.append({"display": clean, "slug": city_slug_from_display(clean)})
    return items


def build_organization_node(brand: dict[str, Any], research: dict[str, Any], canonical_base: str) -> dict[str, Any]:
    same_as: list[str] = []
    for key in ("facebookUrl", "instagramUrl", "linkedinUrl", "nextdoorUrl", "bbbUrl", "gafDirectoryUrl"):
        v = research.get(key)
        if isinstance(v, str) and v.startswith("http"):
            same_as.append(v)
    # Third-party ratings, optional
    third = research.get("thirdPartyRatings") or {}
    for tp_key in ("angi", "houzz", "yelp"):
        url = (third.get(tp_key) or {}).get("url")
        if isinstance(url, str) and url.startswith("http"):
            same_as.append(url)

    return {
        "@type": "Organization",
        "@id": f"{canonical_base}/#organization",
        "name": brand["company_name"],
        "url": f"{canonical_base}/",
        "telephone": research.get("phoneNormalised") or research.get("phone", ""),
        "email": brand["contact"]["email"],
        "logo": {
            "@type": "ImageObject",
            "url": f"{canonical_base}/logo.webp",
        },
        "sameAs": same_as,
    }


def build_website_node(brand: dict[str, Any], canonical_base: str) -> dict[str, Any]:
    return {
        "@type": "WebSite",
        "@id": f"{canonical_base}/#website",
        "url": f"{canonical_base}/",
        "name": brand["company_name"],
        "publisher": {"@id": f"{canonical_base}/#organization"},
        "inLanguage": "en-US",
    }


def build_postal_address(brand: dict[str, Any]) -> dict[str, Any]:
    """Parse brand.contact.address into a PostalAddress.

    Supports two canonical USPS shapes:
    1. "<street>, <city>, <ST> <ZIP>"
    2. "<street>, Suite <N>, <city>, <ST> <ZIP>"
    """
    raw = brand["contact"]["address"]
    # Try suite-aware form first.
    m = re.match(
        r"(?P<street>.+?),\s*(?P<suite>Suite\s+\S+),\s*(?P<city>[^,]+),\s*(?P<state>[A-Z]{2})\s*(?P<zip>\d{5})",
        raw,
    )
    if m:
        street = f"{m.group('street').strip()} {m.group('suite').strip()}"
        return {
            "@type": "PostalAddress",
            "streetAddress": street,
            "addressLocality": m.group("city").strip(),
            "addressRegion": m.group("state").strip(),
            "postalCode": m.group("zip").strip(),
            "addressCountry": "US",
        }
    m = re.match(
        r"(?P<street>.+?),\s*(?P<city>[^,]+),\s*(?P<state>[A-Z]{2})\s*(?P<zip>\d{5})",
        raw,
    )
    if m:
        return {
            "@type": "PostalAddress",
            "streetAddress": m.group("street").strip(),
            "addressLocality": m.group("city").strip(),
            "addressRegion": m.group("state").strip(),
            "postalCode": m.group("zip").strip(),
            "addressCountry": "US",
        }
    return {
        "@type": "PostalAddress",
        "streetAddress": raw,
        "addressCountry": "US",
    }


def build_hq_node(
    brand: dict[str, Any],
    research: dict[str, Any],
    cfg: dict[str, Any],
    canonical_base: str,
    areas: list[dict[str, Any]],
    aggregate_rating: dict[str, str],
    opening_hours: list[dict[str, Any]],
) -> dict[str, Any]:
    address = build_postal_address(brand)
    state_code = cfg["state_code"]

    description = (
        f"{brand['company_name']} is a {state_code}-based roofing contractor "
        f"headquartered at {address.get('streetAddress', '')}, "
        f"{address.get('addressLocality', '')}, {state_code}. "
        f"{research.get('googleReviewCount', 0)} verified Google reviews at "
        f"{research.get('googleRating', 0)} stars. "
        f"Services include {', '.join(research.get('services', [])[:6])}."
    )

    knows_about = list(research.get("services", []))[:10]

    return {
        "@type": "RoofingContractor",
        "@id": f"{canonical_base}/#roofingcontractor",
        "name": brand["company_name"],
        "alternateName": brand.get("manual_overrides", {}).get("legal_entity")
            or research.get("legalEntity")
            or brand["company_name"],
        "url": f"{canonical_base}/",
        "telephone": research.get("phoneNormalised") or research.get("phone", ""),
        "email": brand["contact"]["email"],
        "image": [
            f"{canonical_base}/logo.webp",
            f"{canonical_base}/hero-image.webp",
        ],
        "logo": f"{canonical_base}/logo.webp",
        "address": address,
        "geo": {
            "@type": "GeoCoordinates",
            "latitude": cfg["hq_geo"]["latitude"],
            "longitude": cfg["hq_geo"]["longitude"],
        },
        "openingHoursSpecification": opening_hours,
        "areaServed": [
            {"@type": "Place", "name": f"{a['display']}, {state_code}"} for a in areas
        ],
        "aggregateRating": aggregate_rating,
        "priceRange": "$$",
        "founder": {
            "@type": "Person",
            "name": brand["founder"]["name"],
            "jobTitle": brand["founder"].get("title", "Owner"),
        },
        "foundingDate": str(
            brand.get("manual_overrides", {}).get("founding_year")
            or research.get("yearFounded", "")
        ),
        "description": description,
        "knowsAbout": knows_about,
        "sameAs": [
            v for v in (
                research.get("facebookUrl"),
                research.get("instagramUrl"),
                research.get("linkedinUrl"),
                research.get("nextdoorUrl"),
                research.get("gafDirectoryUrl"),
                research.get("bbbUrl"),
            ) if isinstance(v, str) and v.startswith("http")
        ],
    }


def build_homepage_faqpage_node(homepage_faqs: list[dict[str, str]], canonical_base: str) -> dict[str, Any] | None:
    if not homepage_faqs:
        return None
    return {
        "@type": "FAQPage",
        "@id": f"{canonical_base}/#faq",
        "url": f"{canonical_base}/",
        "mainEntity": [
            {
                "@type": "Question",
                "name": faq["question"],
                "acceptedAnswer": {"@type": "Answer", "text": faq["answer"]},
            }
            for faq in homepage_faqs
        ],
    }


def build_service_nodes(
    sitemap: dict[str, Any],
    service_faqs: dict[str, list[dict[str, str]]],
    areas: list[dict[str, Any]],
    canonical_base: str,
    state_code: str,
) -> list[dict[str, Any]]:
    nodes: list[dict[str, Any]] = []
    for svc in sitemap.get("service_pages", []):
        slug_path = svc["slug"]
        url = url_for(slug_path, canonical_base)
        service_slug = slug_path.split("/")[-1]
        nodes.append({
            "@type": "Service",
            "@id": f"{url}#service",
            "name": svc.get("h1") or svc.get("page_title", service_slug),
            "url": url,
            "description": svc.get("meta_description", ""),
            "serviceType": service_slug.replace("-", " ").title(),
            "provider": {"@id": f"{canonical_base}/#roofingcontractor"},
            "areaServed": [
                {"@type": "Place", "name": f"{a['display']}, {state_code}"} for a in areas
            ],
            "category": "Roofing",
        })
        faqs = service_faqs.get(service_slug, [])
        if faqs:
            nodes.append({
                "@type": "FAQPage",
                "@id": f"{url}#faq",
                "url": url,
                "mainEntity": [
                    {
                        "@type": "Question",
                        "name": f["question"],
                        "acceptedAnswer": {"@type": "Answer", "text": f["answer"]},
                    }
                    for f in faqs
                ],
            })
    return nodes


def build_location_nodes(
    sitemap: dict[str, Any],
    cfg: dict[str, Any],
    brand: dict[str, Any],
    research: dict[str, Any],
    aggregate_rating: dict[str, str],
    opening_hours: list[dict[str, Any]],
    canonical_base: str,
) -> list[dict[str, Any]]:
    nodes: list[dict[str, Any]] = []
    address = build_postal_address(brand)
    state_code = cfg["state_code"]
    hq_geo = cfg["hq_geo"]
    location_route_prefix = cfg.get("location_route_prefix", "/service-area")

    for loc in sitemap.get("location_pages", []):
        raw_slug = loc["slug"]
        actual_slug = rewrite_location_slug(raw_slug, location_route_prefix)
        url = url_for(actual_slug, canonical_base)
        city_slug = actual_slug.split("/")[-1]
        coords = cfg["city_geo"].get(city_slug, hq_geo)
        display = (
            cfg.get("city_display_overrides", {}).get(city_slug)
            or city_slug.replace("-tx", "").replace("-", " ").title()
        )

        nodes.append({
            "@type": ["LocalBusiness", "RoofingContractor"],
            "@id": f"{url}#localbusiness",
            "name": f"{brand['company_name']}, {display} {state_code}",
            "url": url,
            "telephone": research.get("phoneNormalised") or research.get("phone", ""),
            "image": f"{canonical_base}/logo.webp",
            "address": address,
            "geo": {
                "@type": "GeoCoordinates",
                "latitude": coords["latitude"],
                "longitude": coords["longitude"],
            },
            "openingHoursSpecification": opening_hours,
            "areaServed": {
                "@type": "Place",
                "name": f"{display}, {state_code}",
                "geo": {
                    "@type": "GeoCoordinates",
                    "latitude": coords["latitude"],
                    "longitude": coords["longitude"],
                },
            },
            "parentOrganization": {"@id": f"{canonical_base}/#organization"},
            "aggregateRating": aggregate_rating,
            "priceRange": "$$",
            "description": loc.get("meta_description", ""),
        })
    return nodes


def build_blog_nodes(sitemap: dict[str, Any], brand: dict[str, Any], canonical_base: str) -> list[dict[str, Any]]:
    nodes: list[dict[str, Any]] = []
    for post in sitemap.get("blog_posts", []):
        slug = post["slug"]
        url = url_for(slug, canonical_base)
        headline = (
            post.get("title")
            or (post.get("page_title", "").split(" | ")[0] if post.get("page_title") else slug)
        )
        nodes.append({
            "@type": "Article",
            "@id": f"{url}#article",
            "headline": headline,
            "url": url,
            "mainEntityOfPage": {"@type": "WebPage", "@id": url},
            "publisher": {"@id": f"{canonical_base}/#organization"},
            "image": f"{canonical_base}/hero-image.webp",
            "author": {"@type": "Organization", "name": brand["company_name"]},
            "inLanguage": "en-US",
            "about": post.get("target_keyword", ""),
            "description": post.get("meta_description", ""),
        })
    return nodes


def build_breadcrumb_nodes(sitemap: dict[str, Any], cfg: dict[str, Any], canonical_base: str) -> list[dict[str, Any]]:
    nodes: list[dict[str, Any]] = []

    def push(slug: str, name: str, parent_chain: list[tuple[str, str]] | None = None) -> None:
        url = url_for(slug, canonical_base)
        items: list[dict[str, Any]] = [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": f"{canonical_base}/"}
        ]
        if parent_chain:
            for pos, (p_slug, p_name) in enumerate(parent_chain, start=2):
                items.append({
                    "@type": "ListItem",
                    "position": pos,
                    "name": p_name,
                    "item": url_for(p_slug, canonical_base),
                })
        items.append({
            "@type": "ListItem",
            "position": len(items) + 1,
            "name": name,
            "item": url,
        })
        nodes.append({
            "@type": "BreadcrumbList",
            "@id": f"{url}#breadcrumb",
            "itemListElement": items,
        })

    for svc in sitemap.get("service_pages", []):
        push(svc["slug"], svc.get("h1") or svc.get("page_title", ""), [("/services", "Services")])
    location_route_prefix = cfg.get("location_route_prefix", "/service-area")
    for loc in sitemap.get("location_pages", []):
        actual_slug = rewrite_location_slug(loc["slug"], location_route_prefix)
        push(actual_slug, loc.get("h1") or loc.get("page_title", ""), [("/service-areas", "Service Areas")])
    for post in sitemap.get("blog_posts", []):
        headline = (
            post.get("title")
            or (post.get("page_title", "").split(" | ")[0] if post.get("page_title") else post["slug"])
        )
        push(post["slug"], headline, [("/blog", "Blog")])
    for util in sitemap.get("utility_pages", []):
        push(util["slug"], util.get("h1") or util.get("page_title", ""), None)

    return nodes


def build_full_graph(
    brand: dict[str, Any],
    research: dict[str, Any],
    sitemap: dict[str, Any],
    cfg: dict[str, Any],
    canonical_base: str,
    homepage_faqs: list[dict[str, str]],
    service_faqs: dict[str, list[dict[str, str]]],
) -> dict[str, Any]:
    areas = normalize_areas_served(brand, research)
    aggregate_rating = {
        "@type": "AggregateRating",
        "ratingValue": str(research["googleRating"]),
        "reviewCount": str(research["googleReviewCount"]),
        "bestRating": "5",
        "worstRating": "1",
    }
    opening_hours = parse_opening_hours(research["business_hours"])

    graph: list[dict[str, Any]] = []
    graph.append(build_organization_node(brand, research, canonical_base))
    graph.append(build_website_node(brand, canonical_base))
    graph.append(build_hq_node(brand, research, cfg, canonical_base, areas, aggregate_rating, opening_hours))

    faq_node = build_homepage_faqpage_node(homepage_faqs, canonical_base)
    if faq_node:
        graph.append(faq_node)

    graph.extend(build_service_nodes(sitemap, service_faqs, areas, canonical_base, cfg["state_code"]))
    graph.extend(build_location_nodes(sitemap, cfg, brand, research, aggregate_rating, opening_hours, canonical_base))
    graph.extend(build_blog_nodes(sitemap, brand, canonical_base))
    graph.extend(build_breadcrumb_nodes(sitemap, cfg, canonical_base))

    return {"@context": "https://schema.org", "@graph": graph}


def build_sitemap_xml(sitemap: dict[str, Any], cfg: dict[str, Any], canonical_base: str, last_mod: str) -> str:
    entries: list[tuple[str, str, str]] = []

    for c in sitemap.get("core_pages", []):
        entries.append((url_for(c["slug"], canonical_base), "weekly", "1.0"))

    for s in sitemap.get("service_pages", []):
        entries.append((url_for(s["slug"], canonical_base), "monthly", "0.9"))

    location_route_prefix = cfg.get("location_route_prefix", "/service-area")
    for l in sitemap.get("location_pages", []):
        actual = rewrite_location_slug(l["slug"], location_route_prefix)
        entries.append((url_for(actual, canonical_base), "monthly", "0.7"))

    for b in sitemap.get("blog_posts", []):
        entries.append((url_for(b["slug"], canonical_base), "monthly", "0.5"))

    for u in sitemap.get("utility_pages", []):
        entries.append((url_for(u["slug"], canonical_base), "monthly", "0.6"))

    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for loc, changefreq, priority in entries:
        lines.append("  <url>")
        lines.append(f"    <loc>{loc}</loc>")
        lines.append(f"    <lastmod>{last_mod}</lastmod>")
        lines.append(f"    <changefreq>{changefreq}</changefreq>")
        lines.append(f"    <priority>{priority}</priority>")
        lines.append("  </url>")
    lines.append("</urlset>")
    return "\n".join(lines) + "\n"


def build_robots_txt(canonical_base: str) -> str:
    return (
        "User-agent: *\n"
        "Allow: /\n"
        "\n"
        f"Sitemap: {canonical_base}/sitemap.xml\n"
    )


def inject_jsonld(html: str, graph: dict[str, Any]) -> str:
    new_block = (
        '<script type="application/ld+json">\n'
        + json.dumps(graph, ensure_ascii=False, indent=2)
        + "\n    </script>"
    )
    html = re.sub(
        r'<script type="application/ld\+json">.*?</script>\s*',
        "",
        html,
        flags=re.DOTALL,
    )
    if "</head>" not in html:
        raise SystemExit("index.html missing </head>")
    return html.replace("</head>", f"    {new_block}\n  </head>")


def update_meta_tags(html: str, brand: dict[str, Any], homepage_meta: dict[str, str], canonical_base: str) -> str:
    title = homepage_meta.get("page_title") or homepage_meta.get("title", brand["company_name"])
    description = homepage_meta.get("meta_description", "")

    html = re.sub(
        r"<title>.*?</title>",
        f"<title>{title}</title>",
        html,
        count=1,
        flags=re.DOTALL,
    )
    if re.search(r'<meta name="description"', html):
        html = re.sub(
            r'<meta name="description" content=".*?"\s*/?>',
            f'<meta name="description" content="{description}" />',
            html,
            count=1,
        )
    else:
        html = html.replace(
            "</title>",
            f'</title>\n    <meta name="description" content="{description}" />',
            1,
        )

    additions: list[str] = []
    if 'rel="canonical"' not in html:
        additions.append(f'<link rel="canonical" href="{canonical_base}/" />')
    if 'property="og:title"' not in html:
        additions.append(f'<meta property="og:title" content="{title}" />')
    if 'property="og:description"' not in html:
        additions.append(f'<meta property="og:description" content="{description}" />')
    if 'property="og:url"' not in html:
        additions.append(f'<meta property="og:url" content="{canonical_base}/" />')
    if 'property="og:type"' not in html:
        additions.append('<meta property="og:type" content="website" />')
    if 'property="og:image"' not in html:
        additions.append(f'<meta property="og:image" content="{canonical_base}/hero-image.webp" />')
    if 'property="og:site_name"' not in html:
        additions.append(f'<meta property="og:site_name" content="{brand["company_name"]}" />')
    if 'name="twitter:card"' not in html:
        additions.append('<meta name="twitter:card" content="summary_large_image" />')
    if 'name="twitter:title"' not in html:
        additions.append(f'<meta name="twitter:title" content="{title}" />')
    if 'name="twitter:description"' not in html:
        additions.append(f'<meta name="twitter:description" content="{description}" />')
    if 'name="twitter:image"' not in html:
        additions.append(f'<meta name="twitter:image" content="{canonical_base}/hero-image.webp" />')
    if 'name="robots"' not in html:
        additions.append('<meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />')

    if additions:
        block = "\n    ".join(additions)
        html = html.replace("</head>", f"    {block}\n  </head>", 1)

    return html


def validate_graph(graph: dict[str, Any], research: dict[str, Any]) -> tuple[bool, list[str]]:
    """Structural Rich Results validation."""
    errors: list[str] = []
    try:
        round_trip = json.loads(json.dumps(graph, ensure_ascii=False))
    except (TypeError, ValueError) as e:
        return False, [f"JSON round-trip failed: {e}"]

    if round_trip.get("@context") != "https://schema.org":
        errors.append("@context must equal https://schema.org")
    nodes = round_trip.get("@graph", [])
    if not isinstance(nodes, list) or not nodes:
        errors.append("@graph must be a non-empty array")

    def all_types(n: dict[str, Any]) -> list[str]:
        t = n.get("@type")
        return t if isinstance(t, list) else [t] if isinstance(t, str) else []

    required = {
        "RoofingContractor",
        "Organization",
        "WebSite",
        "Service",
        "LocalBusiness",
        "Article",
        "BreadcrumbList",
    }
    found = set()
    for n in nodes:
        for t in all_types(n):
            found.add(t)
    missing = required - found
    if missing:
        errors.append(f"Missing required types: {sorted(missing)}")

    serialized = json.dumps(graph, ensure_ascii=False)
    if "—" in serialized or "–" in serialized:
        errors.append("Em-dash or en-dash present in JSON-LD")
    for marker in ("[PLACEHOLDER]", "{placeholder}", "Lorem ipsum", "__REQUIRED__"):
        if marker in serialized:
            errors.append(f"Placeholder marker present: {marker}")

    expected_rating = research.get("googleRating")
    expected_count = research.get("googleReviewCount")
    for n in nodes:
        ar = n.get("aggregateRating")
        if isinstance(ar, dict):
            rv = float(ar.get("ratingValue", 0))
            rc = int(ar.get("reviewCount", 0))
            if expected_rating is not None and rv != float(expected_rating):
                errors.append(
                    f"AggregateRating ratingValue must be {expected_rating}, got {rv}"
                )
            if expected_count is not None and rc != int(expected_count):
                errors.append(
                    f"AggregateRating reviewCount must be {expected_count}, got {rc}"
                )

    return not errors, errors


def main() -> int:
    parser = argparse.ArgumentParser(description="Stage 10.2 Personalize")
    parser.add_argument(
        "--client",
        required=True,
        help="Client folder name (matches clients/<name>/)",
    )
    parser.add_argument(
        "--last-mod",
        default="2026-05-13",
        help="lastmod date for sitemap.xml entries (YYYY-MM-DD)",
    )
    args = parser.parse_args()

    client_slug = args.client
    if client_slug not in CLIENT_CONFIG:
        sys.exit(
            f"No client config for '{client_slug}'. Add a block to "
            f"CLIENT_CONFIG in tools/personalize.py (canonical_base, "
            f"hq_geo, city_geo, state_code, etc.)."
        )
    cfg = CLIENT_CONFIG[client_slug]
    canonical_base = cfg["canonical_base"]

    pipeline_dir = REPO_ROOT / "clients" / client_slug / "Pipeline Data"
    website_dir = REPO_ROOT / "clients" / client_slug / f"{client_slug} Website"
    public_dir = website_dir / "public"
    dist_dir = website_dir / "dist"
    if not website_dir.is_dir():
        sys.exit(f"website dir not found: {website_dir}")
    if not public_dir.is_dir():
        sys.exit(f"public dir not found: {public_dir}")

    brand = load_json(pipeline_dir / "brand" / "brand-dna.json")
    research = load_json(pipeline_dir / "research" / "research.json")
    sitemap = load_json(pipeline_dir / "strategy" / "sitemap.json")
    copy_deck = load_text(pipeline_dir / "copy" / "copy-deck.md")

    homepage_meta = sitemap["core_pages"][0]
    homepage_faqs = parse_homepage_faqs(copy_deck, cfg)
    service_faqs = parse_service_faqs(copy_deck, sitemap, cfg)

    print(f"[personalize] client: {client_slug}")
    print(f"[personalize] canonical: {canonical_base}")
    print(f"[personalize] hours: {hours_human_string(research['business_hours'])}")
    print(f"[personalize] Parsed {len(homepage_faqs)} homepage FAQs")
    for slug, faqs in service_faqs.items():
        print(f"[personalize] Parsed {len(faqs)} FAQs for {slug}")

    graph = build_full_graph(
        brand, research, sitemap, cfg, canonical_base,
        homepage_faqs, service_faqs,
    )

    ok, errors = validate_graph(graph, research)
    if not ok:
        print("Validation errors:")
        for e in errors:
            print(f"  - {e}")
        sys.exit(2)
    print("[personalize] JSON-LD graph validation PASSED")

    # 1. Write sitemap.xml + robots.txt to public/ (Vite preserves on every build)
    sitemap_xml = build_sitemap_xml(sitemap, cfg, canonical_base, args.last_mod)
    (public_dir / "sitemap.xml").write_text(sitemap_xml, encoding="utf-8")
    public_sitemap_url_count = sitemap_xml.count("<url>")
    print(
        f"[personalize] Wrote {public_dir / 'sitemap.xml'} "
        f"({public_sitemap_url_count} URLs)"
    )

    robots = build_robots_txt(canonical_base)
    (public_dir / "robots.txt").write_text(robots, encoding="utf-8")
    print(f"[personalize] Wrote {public_dir / 'robots.txt'}")

    # 2. Mirror sitemap.xml + robots.txt into dist/ so the currently-built
    # site matches public/. Next `npm run build` would do this automatically;
    # we copy now so the current dist is consistent.
    if dist_dir.is_dir():
        (dist_dir / "sitemap.xml").write_text(sitemap_xml, encoding="utf-8")
        (dist_dir / "robots.txt").write_text(robots, encoding="utf-8")
        print(f"[personalize] Mirrored sitemap.xml + robots.txt into {dist_dir}")

    # 3. Inject JSON-LD + meta tags into BOTH source index.html (so it
    # persists across rebuilds) and dist/index.html (current build).
    src_html_path = website_dir / "index.html"
    if src_html_path.is_file():
        html = src_html_path.read_text(encoding="utf-8")
        html = update_meta_tags(html, brand, homepage_meta, canonical_base)
        html = inject_jsonld(html, graph)
        src_html_path.write_text(html, encoding="utf-8")
        print(f"[personalize] Injected JSON-LD + meta into {src_html_path}")

    if dist_dir.is_dir():
        dist_html_path = dist_dir / "index.html"
        if dist_html_path.is_file():
            html = dist_html_path.read_text(encoding="utf-8")
            html = update_meta_tags(html, brand, homepage_meta, canonical_base)
            html = inject_jsonld(html, graph)
            dist_html_path.write_text(html, encoding="utf-8")
            print(f"[personalize] Injected JSON-LD + meta into {dist_html_path}")

    # 4. Em-dash audit across files we touched.
    audit_paths = [public_dir / "sitemap.xml", public_dir / "robots.txt", src_html_path]
    if dist_dir.is_dir():
        audit_paths.extend([dist_dir / "sitemap.xml", dist_dir / "robots.txt", dist_dir / "index.html"])
    for p in audit_paths:
        if not p.is_file():
            continue
        text = p.read_text(encoding="utf-8")
        if "—" in text or "–" in text:
            sys.exit(f"Em-dash or en-dash present in {p}")

    # 5. Summary
    counts: dict[str, int] = {
        "Organization": 0,
        "WebSite": 0,
        "RoofingContractor": 0,
        "LocalBusiness": 0,
        "Service": 0,
        "FAQPage": 0,
        "Article": 0,
        "BreadcrumbList": 0,
    }
    for n in graph["@graph"]:
        t = n.get("@type")
        if isinstance(t, list):
            for tt in t:
                if tt in counts:
                    counts[tt] += 1
        elif isinstance(t, str) and t in counts:
            counts[t] += 1
    print("[personalize] Schema counts:", counts)
    print(f"[personalize] sitemap.xml URL count: {public_sitemap_url_count}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
