#!/usr/bin/env python3
"""
SOP 15 — Copy Resonance Extractor.

Reads the cached Apify reddit results for a client, extracts patterns the
Stage 6 copy-deck-agent uses to write copy that resonates with the local
market: pain_points, manufacturer_mentions, trust_signals, objections,
weather_themes, local_color.

Pure keyword + frequency analysis. No LLM call. Stage 6 reads the output
JSON as additional context and decides how to weave themes into copy.

Usage:
    python3 tools/extract-resonance.py --client "Acme Roofing"

Reads:
    clients/[Client]/Pipeline Data/research/raw-reddit.json
    OR clients/[Client]/Pipeline Data/research/apify-cache/<reddit-hash>.json

Writes:
    clients/[Client]/Pipeline Data/copy/social-resonance.json
"""

import argparse
import json
import re
import sys
from collections import Counter
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parent.parent

# Theme dictionaries — keyword/phrase patterns that map to resonance categories.
# Tuned for roofing contractor market specifically.

PAIN_POINT_PATTERNS = [
    (r"\bleak(s|ing|ed)?\b", "leaks"),
    (r"\bshingle(s)? (flying|missing|blew off|came off|coming off)\b", "shingles flying off"),
    (r"\bice dam(s)?\b", "ice dams"),
    (r"\bhail damage\b", "hail damage"),
    (r"\bstorm damage\b", "storm damage"),
    (r"\binsurance (denied|denial|won'?t cover|wouldn'?t cover)\b", "insurance denial"),
    (r"\b(adjuster|claim) (low|lowball|underpaid)\b", "lowball insurance offer"),
    (r"\bgranule loss\b", "granule loss"),
    (r"\bblistering\b", "blistering"),
    (r"\bwarped\b", "warped roof"),
    (r"\bsagging\b", "sagging roof"),
    (r"\bmold\b", "mold from leaks"),
    (r"\bdamaged (vent|flashing|gutter)\b", "flashing/vent damage"),
    (r"\bnail pop(s|ping)?\b", "nail pops"),
    (r"\b(emergency|urgent) (repair|tarp)\b", "emergency tarp/repair"),
]

MANUFACTURER_PATTERNS = {
    "GAF": r"\bGAF\b",
    "Owens Corning": r"\b(owens[ -]?corning|OC )\b",
    "CertainTeed": r"\bcertainteed\b",
    "TAMKO": r"\btamko\b",
    "IKO": r"\bIKO\b",
    "Atlas": r"\batlas (shingles|roofing)\b",
    "Malarkey": r"\bmalarkey\b",
    "GenFlex": r"\bgenflex\b",
    "Mule-Hide": r"\bmule[ -]?hide\b",
    "Carlisle": r"\bcarlisle\b",
    "Firestone": r"\bfirestone\b",
    "Tesla Solar": r"\btesla solar\b",
    "SunPower": r"\bsunpower\b",
}

TRUST_SIGNAL_PATTERNS = [
    (r"\bshowed up on time\b", "showed up on time"),
    (r"\bprice[ -]?match(ed)?\b", "price-matched"),
    (r"\bcleaned up\b", "cleaned up after themselves"),
    (r"\bowner (came|came out|stopped by)\b", "owner came out personally"),
    (r"\bno surprise (charges|fees|costs)\b", "no surprise charges"),
    (r"\bfair (price|pricing|quote)\b", "fair pricing"),
    (r"\bhonest\b", "honest"),
    (r"\bquick (response|turnaround|turn-around)\b", "quick response"),
    (r"\bmagnetic sweep\b", "magnetic sweep done"),
    (r"\b(highly )?recommend\b", "would recommend"),
    (r"\bprofessional\b", "professional"),
    (r"\bexceeded (expectations|my expectations)\b", "exceeded expectations"),
    (r"\bwarranty\b", "warranty"),
    (r"\bgreat communication\b", "great communication"),
]

OBJECTION_PATTERNS = [
    (r"\btoo expensive\b", "too expensive"),
    (r"\bovercharged\b", "overcharged"),
    (r"\bhigh[ -]pressure\b", "high-pressure sales"),
    (r"\bdoor[ -]?to[ -]?door\b", "door-to-door"),
    (r"\bsalesm(an|en|woman)\b", "distrust salespeople"),
    (r"\b(scam|scammed)\b", "fear of scam"),
    (r"\bstorm chaser(s)?\b", "storm chasers"),
    (r"\bfly[ -]?by[ -]?night\b", "fly-by-night contractors"),
    (r"\bdidn'?t finish\b", "contractor didn't finish"),
    (r"\bghost(ed|ing)\b", "contractor ghosted"),
    (r"\b(disappear|disappeared)\b", "contractor disappeared"),
    (r"\bsign now\b", "pressured to sign now"),
    (r"\b(rip|ripped) off\b", "ripped off"),
]

WEATHER_THEME_PATTERNS = [
    "monsoon", "hailstorm", "ice dam", "blizzard", "windstorm", "snowstorm",
    "freeze", "heatwave", "heat wave", "wildfire", "tornado", "hurricane",
    "tropical storm", "polar vortex", "winter storm", "spring storm",
    "summer storm", "thunderstorm",
]


def load_reddit_data(client: str) -> list:
    """Load reddit items from --out file or apify-cache."""
    out_file = REPO_ROOT / "clients" / client / "Pipeline Data" / "research" / "raw-reddit.json"
    if out_file.exists():
        return json.loads(out_file.read_text()).get("items", [])

    # Fallback: scan apify-cache for any reddit cache file
    cache_dir = REPO_ROOT / "clients" / client / "Pipeline Data" / "research" / "apify-cache"
    if cache_dir.exists():
        for f in cache_dir.glob("*.json"):
            try:
                payload = json.loads(f.read_text())
                if payload.get("actor") == "reddit":
                    return payload.get("items", [])
            except Exception:
                continue
    return []


def gather_text(items: list) -> str:
    """Concatenate all reddit post + comment text into one searchable blob."""
    parts: list[str] = []
    for it in items:
        for k in ("title", "selftext", "body", "text", "snippet"):
            v = it.get(k)
            if isinstance(v, str):
                parts.append(v)
        # Some scrapers nest comments under "comments"
        for c in it.get("comments", []) or []:
            for k in ("body", "text"):
                v = c.get(k) if isinstance(c, dict) else None
                if isinstance(v, str):
                    parts.append(v)
    return " ".join(parts).lower()


def extract_themes(text: str) -> dict:
    """Run all pattern dictionaries against the text and return frequency counts."""
    pain = Counter()
    for pattern, label in PAIN_POINT_PATTERNS:
        n = len(re.findall(pattern, text, flags=re.IGNORECASE))
        if n:
            pain[label] += n

    manufacturers = {}
    for label, pattern in MANUFACTURER_PATTERNS.items():
        n = len(re.findall(pattern, text, flags=re.IGNORECASE))
        if n:
            manufacturers[label] = n

    trust = Counter()
    for pattern, label in TRUST_SIGNAL_PATTERNS:
        n = len(re.findall(pattern, text, flags=re.IGNORECASE))
        if n:
            trust[label] += n

    objections = Counter()
    for pattern, label in OBJECTION_PATTERNS:
        n = len(re.findall(pattern, text, flags=re.IGNORECASE))
        if n:
            objections[label] += n

    weather = Counter()
    for theme in WEATHER_THEME_PATTERNS:
        n = text.count(theme)
        if n:
            weather[theme] += n

    return {
        "pain_points": [{"label": k, "count": v} for k, v in pain.most_common(10)],
        "manufacturer_mentions": dict(sorted(manufacturers.items(), key=lambda x: -x[1])),
        "trust_signals": [{"label": k, "count": v} for k, v in trust.most_common(10)],
        "objections": [{"label": k, "count": v} for k, v in objections.most_common(10)],
        "weather_themes": [{"theme": k, "count": v} for k, v in weather.most_common(8)],
    }


def extract_local_color(items: list, max_terms: int = 12) -> list:
    """Pull recurring city/neighborhood/landmark mentions (capitalized phrases)."""
    text = gather_text(items)
    # Match Title Case 2-3 word phrases, exclude common words
    candidates = re.findall(r"\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+){0,2})\b", text.title())
    common = {"The", "And", "But", "For", "Was", "With", "From", "This", "That", "When", "What"}
    counter = Counter(c for c in candidates if c not in common and len(c) > 4)
    return [{"phrase": k, "count": v} for k, v in counter.most_common(max_terms)]


def main():
    parser = argparse.ArgumentParser(description="Extract copy resonance from cached reddit data")
    parser.add_argument("--client", required=True)
    args = parser.parse_args()

    items = load_reddit_data(args.client)
    if not items:
        print(f"[warn] no reddit data for {args.client}; writing empty resonance file", file=sys.stderr)

    text = gather_text(items)
    themes = extract_themes(text)
    themes["local_color"] = extract_local_color(items)
    themes["_source_count"] = len(items)
    themes["_total_chars"] = len(text)

    out = REPO_ROOT / "clients" / args.client / "Pipeline Data" / "copy" / "social-resonance.json"
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(json.dumps(themes, indent=2))

    print(f"[done] wrote {out}", file=sys.stderr)
    print(f"  pain_points: {len(themes['pain_points'])}", file=sys.stderr)
    print(f"  manufacturer_mentions: {len(themes['manufacturer_mentions'])}", file=sys.stderr)
    print(f"  trust_signals: {len(themes['trust_signals'])}", file=sys.stderr)
    print(f"  objections: {len(themes['objections'])}", file=sys.stderr)
    print(f"  weather_themes: {len(themes['weather_themes'])}", file=sys.stderr)
    print(f"  local_color: {len(themes['local_color'])}", file=sys.stderr)


if __name__ == "__main__":
    main()
