#!/usr/bin/env python3
"""
Apify scraper wrapper for Stage 2 (research) and Stage 4 (asset harvest)
of the website factory pipeline.

Replaces flaky native web search with professional Apify scrapers:
  - google-places  (compass/crawler-google-places: GBP listing + ALL reviews + photos)
  - facebook       (apify/facebook-pages-scraper: FB business page + reviews)
  - website        (apify/website-content-crawler: client + competitor sites)
  - instagram      (apify/instagram-scraper: project photos, optional)

Features:
  - Caches results by SHA256 of (actor + input) so re-runs cost zero
  - Hard $2/client cost cap (configurable via APIFY_PER_CLIENT_USD_CAP env)
  - Reliability check: fails when Google/Facebook return zero reviews
    despite a published rating (key reliability requirement)
  - Retries x3 with exponential backoff on transient failures
  - On hard failure, writes RESEARCH-INCOMPLETE.md flag for downstream agents

Usage:
    python3 tools/apify-scrape.py --client "Acme Roofing" \\
        --actor google-places --query "Acme Roofing Phoenix AZ"

    python3 tools/apify-scrape.py --client "Acme Roofing" \\
        --actor facebook --pages "https://facebook.com/acmeroofing"

    python3 tools/apify-scrape.py --client "Acme Roofing" \\
        --actor website --urls "https://acmeroofing.com,https://competitor.com"

    python3 tools/apify-scrape.py --client "Acme Roofing" \\
        --actor instagram --handles "acme_roofing"

    Pass --out path/to/output.json to also write a copy of the result.
    Pass --no-cache to bypass the cache (still writes cache after run).
"""

import argparse
import hashlib
import json
import os
import sys
import time
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

REPO_ROOT = Path(__file__).resolve().parent.parent
ENV_PATH = REPO_ROOT / ".env"

API_BASE = "https://api.apify.com/v2"
MAX_POLL_SEC = 300
POLL_INTERVAL_SEC = 4
MAX_RETRIES = 3

DEFAULT_USD_CAP = 2.00

ACTORS = {
    "google-places": {
        "id": "compass~crawler-google-places",
        "default_input": {
            "language": "en",
            "maxCrawledPlacesPerSearch": 1,
            "maxReviews": 200,
            "maxImages": 30,
            "scrapeReviewerName": True,
            "scrapeReviewerUrl": False,
            "scrapeReviewId": False,
            "includeWebResults": False,
        },
    },
    "facebook": {
        "id": "apify~facebook-pages-scraper",
        "default_input": {
            "resultsLimit": 200,
        },
    },
    "website": {
        "id": "apify~website-content-crawler",
        "default_input": {
            "maxCrawlPages": 30,
            "saveHtml": False,
            "saveMarkdown": True,
            "saveScreenshots": False,
            # Keep nav + footer so we can extract social URLs and contact details.
            # Strip only the obvious cruft (cookie banners, modals, breadcrumbs).
            "removeElementsCssSelector": ".cookie, .cookie-banner, .modal, [role='dialog'], .breadcrumbs",
        },
    },
    "instagram": {
        "id": "apify~instagram-scraper",
        "default_input": {
            "resultsType": "posts",
            "resultsLimit": 50,
        },
    },
    "reddit": {
        # SOP 15: local social research for Stage 6 copy resonance.
        # Returns posts + top comments, used to extract pain_points, manufacturer
        # mentions, trust_signals, objections, weather_themes, local_color.
        "id": "trudax~reddit-scraper-lite",
        "default_input": {
            "maxItems": 60,
            "maxPostCount": 50,
            "scrollTimeout": 40,
            "skipComments": False,
            "skipUserPosts": True,
            "skipCommunity": True,
            "searchPosts": True,
            "searchComments": False,
            "searchCommunities": False,
            "searchUsers": False,
            "sort": "relevance",
            "time": "year",
        },
    },
}


def load_env():
    if not ENV_PATH.exists():
        sys.exit(f"ERROR: .env not found at {ENV_PATH}")
    for line in ENV_PATH.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        k, v = line.split("=", 1)
        os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))


def cache_key(actor: str, input_dict: dict) -> str:
    payload = json.dumps({"actor": actor, "input": input_dict}, sort_keys=True)
    return hashlib.sha256(payload.encode()).hexdigest()[:16]


def cache_dir_for(client: str) -> Path:
    return REPO_ROOT / "clients" / client / "Pipeline Data" / "research" / "apify-cache"


def cache_get(client: str, key: str):
    p = cache_dir_for(client) / f"{key}.json"
    if p.exists():
        try:
            return json.loads(p.read_text())
        except json.JSONDecodeError:
            return None
    return None


def cache_set(client: str, key: str, payload: dict):
    d = cache_dir_for(client)
    d.mkdir(parents=True, exist_ok=True)
    (d / f"{key}.json").write_text(json.dumps(payload, indent=2))


def cost_log_path(client: str) -> Path:
    return REPO_ROOT / "clients" / client / "Pipeline Data" / "research" / "apify-cost.json"


def get_spent(client: str) -> float:
    p = cost_log_path(client)
    if not p.exists():
        return 0.0
    try:
        return float(json.loads(p.read_text()).get("total_usd", 0.0))
    except (json.JSONDecodeError, KeyError, ValueError):
        return 0.0


def add_spent(client: str, usd: float, actor: str):
    p = cost_log_path(client)
    if p.exists():
        try:
            data = json.loads(p.read_text())
        except json.JSONDecodeError:
            data = {"total_usd": 0.0, "runs": []}
    else:
        data = {"total_usd": 0.0, "runs": []}
    data["total_usd"] = round(float(data.get("total_usd", 0.0)) + usd, 4)
    data.setdefault("runs", []).append({
        "actor": actor,
        "usd": round(usd, 4),
        "ts": int(time.time()),
    })
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(data, indent=2))


def http_post(url: str, body: dict, token: str) -> dict:
    req = Request(
        url,
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        method="POST",
    )
    with urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


def http_get(url: str, token: str) -> dict:
    req = Request(url, headers={"Authorization": f"Bearer {token}"})
    with urlopen(req, timeout=60) as resp:
        return json.loads(resp.read())


def run_actor(actor_id: str, run_input: dict, token: str) -> dict:
    """Start actor, poll until done, return {run, items}."""
    start_url = f"{API_BASE}/acts/{actor_id}/runs"
    start_resp = http_post(start_url, run_input, token)
    run = start_resp.get("data", {})
    run_id = run.get("id")
    if not run_id:
        raise RuntimeError(f"Failed to start run: {start_resp}")

    elapsed = 0
    final_run = run
    while elapsed < MAX_POLL_SEC:
        time.sleep(POLL_INTERVAL_SEC)
        elapsed += POLL_INTERVAL_SEC
        status_resp = http_get(f"{API_BASE}/actor-runs/{run_id}", token)
        final_run = status_resp.get("data", {})
        status = final_run.get("status")
        if status == "SUCCEEDED":
            break
        if status in ("FAILED", "ABORTED", "TIMED-OUT"):
            raise RuntimeError(f"Run {status}: {final_run.get('statusMessage')}")
    else:
        raise TimeoutError(f"Run did not finish within {MAX_POLL_SEC}s")

    dataset_id = final_run.get("defaultDatasetId")
    if not dataset_id:
        return {"run": final_run, "items": []}
    items = http_get(f"{API_BASE}/datasets/{dataset_id}/items", token)
    if not isinstance(items, list):
        items = []
    return {"run": final_run, "items": items}


def estimate_cost(run: dict) -> float:
    usage = run.get("usage", {})
    for key in ("totalUsd", "compute_units_usd", "computeUnitsUsd"):
        if key in usage:
            try:
                return float(usage[key])
            except (TypeError, ValueError):
                continue
    stats = run.get("stats", {})
    cost = stats.get("computeUnits") or 0
    try:
        return float(cost) * 0.25
    except (TypeError, ValueError):
        return 0.0


def reliability_check(actor: str, items: list) -> tuple[bool, str]:
    """Critical for Google + Facebook reviews per system requirement."""
    if not items:
        return False, f"{actor} returned zero items"

    if actor == "google-places":
        first = items[0]
        promised = int(first.get("totalScore", 0) or 0)
        review_count = int(first.get("reviewsCount", 0) or 0)
        actual = first.get("reviews") or []
        if review_count > 0 and len(actual) == 0:
            return False, f"GBP reports {review_count} reviews but scraper returned 0"
        if promised > 0 and len(actual) == 0 and review_count == 0:
            return False, "GBP has rating but no reviews scraped"

    if actor == "facebook":
        for item in items:
            if item.get("rating") and not item.get("reviews"):
                return False, "Facebook page has rating but no reviews scraped"

    if actor == "reddit":
        # Reddit may genuinely have zero results for niche queries — soft pass
        # if 0 items, but flag in stderr so Stage 6 knows.
        if not items:
            print("[reddit] zero items returned — Stage 6 will run without social resonance", file=sys.stderr)

    return True, "ok"


def build_input(actor: str, args) -> dict:
    base = dict(ACTORS[actor]["default_input"])
    if actor == "google-places":
        if not args.query:
            sys.exit("ERROR: --query is required for google-places (e.g. 'Acme Roofing Phoenix AZ')")
        base["searchStringsArray"] = [args.query]
    elif actor == "facebook":
        if not args.pages:
            sys.exit("ERROR: --pages is required for facebook (URL or comma list)")
        base["startUrls"] = [{"url": u.strip()} for u in args.pages.split(",") if u.strip()]
    elif actor == "website":
        if not args.urls:
            sys.exit("ERROR: --urls is required for website (URL or comma list)")
        base["startUrls"] = [{"url": u.strip()} for u in args.urls.split(",") if u.strip()]
    elif actor == "instagram":
        if not args.handles:
            sys.exit("ERROR: --handles is required for instagram (handle or comma list)")
        handles = [h.strip().lstrip("@") for h in args.handles.split(",") if h.strip()]
        base["directUrls"] = [f"https://www.instagram.com/{h}/" for h in handles]
    elif actor == "reddit":
        if not args.searches:
            sys.exit("ERROR: --searches is required for reddit (comma-separated query strings)")
        queries = [q.strip() for q in args.searches.split(",") if q.strip()]
        base["searches"] = queries
    return base


def write_incomplete_flag(client: str, actor: str, error: str, run_input: dict):
    target = REPO_ROOT / "clients" / client / "Pipeline Data" / "research"
    target.mkdir(parents=True, exist_ok=True)
    (target / "RESEARCH-INCOMPLETE.md").write_text(
        f"# Apify {actor} failed\n\nAttempts: {MAX_RETRIES}\nLast error: {error}\n\n"
        f"## Input\n```json\n{json.dumps(run_input, indent=2)}\n```\n"
    )


def main():
    parser = argparse.ArgumentParser(description="Apify scraper wrapper (Stages 2 + 4)")
    parser.add_argument("--client", required=True)
    parser.add_argument("--actor", required=True, choices=list(ACTORS.keys()))
    parser.add_argument("--query", help="search string (google-places)")
    parser.add_argument("--pages", help="URL or comma list (facebook)")
    parser.add_argument("--urls", help="URL or comma list (website)")
    parser.add_argument("--handles", help="handle or comma list (instagram)")
    parser.add_argument("--searches", help="comma-separated reddit search queries (reddit)")
    parser.add_argument("--out", help="optional output path; defaults to cache file only")
    parser.add_argument("--no-cache", action="store_true", help="bypass cache lookup; still writes cache after run")
    parser.add_argument("--input-overrides", help="JSON object merged on top of the actor's default input (e.g. '{\"locationQuery\":\"Plymouth, MN\"}')")
    args = parser.parse_args()

    load_env()
    token = os.environ.get("APIFY_API_TOKEN")
    if not token:
        sys.exit("ERROR: APIFY_API_TOKEN not in env")

    cap = float(os.environ.get("APIFY_PER_CLIENT_USD_CAP", DEFAULT_USD_CAP))

    run_input = build_input(args.actor, args)
    if args.input_overrides:
        try:
            overrides = json.loads(args.input_overrides)
            if not isinstance(overrides, dict):
                sys.exit("ERROR: --input-overrides must be a JSON object")
            run_input.update(overrides)
        except json.JSONDecodeError as e:
            sys.exit(f"ERROR: --input-overrides not valid JSON: {e}")
    actor_id = ACTORS[args.actor]["id"]
    key = cache_key(args.actor, run_input)

    if not args.no_cache:
        cached = cache_get(args.client, key)
        if cached:
            print(f"[cache hit] actor={args.actor} key={key}", file=sys.stderr)
            if args.out:
                Path(args.out).parent.mkdir(parents=True, exist_ok=True)
                Path(args.out).write_text(json.dumps(cached, indent=2))
            print(json.dumps(cached, indent=2))
            return

    spent = get_spent(args.client)
    if spent >= cap:
        sys.exit(f"ERROR: client {args.client} already spent ${spent:.2f}, cap is ${cap:.2f}")

    last_err = None
    result = None
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            print(f"[attempt {attempt}/{MAX_RETRIES}] actor={actor_id}", file=sys.stderr)
            result = run_actor(actor_id, run_input, token)
            ok, reason = reliability_check(args.actor, result["items"])
            if not ok:
                raise RuntimeError(f"Reliability check failed: {reason}")
            break
        except (HTTPError, URLError, RuntimeError, TimeoutError) as e:
            last_err = e
            if attempt < MAX_RETRIES:
                wait = 5 * (2 ** (attempt - 1))
                print(f"[fail attempt {attempt}] {e}; waiting {wait}s", file=sys.stderr)
                time.sleep(wait)
            else:
                write_incomplete_flag(args.client, args.actor, str(e), run_input)
                sys.exit(f"ERROR: {args.actor} failed after {MAX_RETRIES} retries: {e}")

    cost = estimate_cost(result["run"])
    if cost > 0:
        add_spent(args.client, cost, args.actor)
        new_total = get_spent(args.client)
        print(f"[cost] +${cost:.4f}, client total ${new_total:.4f} / cap ${cap:.2f}", file=sys.stderr)
        if new_total >= cap:
            print(f"WARNING: client {args.client} now at cap ${new_total:.4f}", file=sys.stderr)

    payload = {
        "actor": args.actor,
        "actor_id": actor_id,
        "input": run_input,
        "items": result["items"],
        "run_id": result["run"].get("id"),
        "cost_usd": cost,
        "ts": int(time.time()),
    }
    cache_set(args.client, key, payload)

    if args.out:
        Path(args.out).parent.mkdir(parents=True, exist_ok=True)
        Path(args.out).write_text(json.dumps(payload, indent=2))

    print(f"[done] actor={args.actor} items={len(result['items'])} key={key}", file=sys.stderr)
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
