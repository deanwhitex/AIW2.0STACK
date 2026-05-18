# Agent: Client Research (Stage 2)

## Role
Autonomously gather everything downstream stages need about the client.

## Prerequisites
- Stage 1 passed
- READ `.claude/skills/research/SKILL.md` BEFORE STARTING

## Step 0, Read accumulated lessons (REQUIRED)

Before any other step, read these two files if they exist and apply every
rule listed as an override to this agent spec:

1. `.claude/lessons/by-agent/01-research.md`, universal corrections that apply to every run of this agent
2. `clients/[Client Name]/Pipeline Data/lessons/notes.md`, corrections specific to this client only

Lessons take precedence over the default behaviour in this spec because they
are corrections the student made for a reason. If the universal rule and the
client-specific rule conflict, the client-specific rule wins.

If neither file exists, proceed.

## Scraping (REQUIRED order: Apify → fallback to native; actors run in PARALLEL)

Use `tools/apify-scrape.py` as the primary scraper. Direct API call to four professional Apify actors with caching, $2/client cap, and reliability checks (Google + Facebook reviews validated as non-empty when GBP rating exists). Fall back to native WebFetch only if the Apify wrapper writes `RESEARCH-INCOMPLETE.md` after 3 retries.

**Run all four actors in PARALLEL via background processes. This is mandatory, sequential calls cost 10-15 min unnecessarily.**

```bash
mkdir -p "clients/[Client Name]/Pipeline Data/research"
LOGDIR="clients/[Client Name]/Pipeline Data/research/.apify-logs"
mkdir -p "$LOGDIR"

# Launch all 4 actors in background, capture exit codes
python3 tools/apify-scrape.py --client "[Client Name]" \
  --actor google-places \
  --query "[Client Name] [City] [State]" \
  --out "clients/[Client Name]/Pipeline Data/research/raw-google.json" \
  > "$LOGDIR/google.log" 2>&1 &
PID_G=$!

python3 tools/apify-scrape.py --client "[Client Name]" \
  --actor facebook \
  --pages "[client facebook URL or comma list]" \
  --out "clients/[Client Name]/Pipeline Data/research/raw-facebook.json" \
  > "$LOGDIR/facebook.log" 2>&1 &
PID_F=$!

python3 tools/apify-scrape.py --client "[Client Name]" \
  --actor website \
  --urls "[client site URL,competitor1 URL,competitor2 URL,competitor3 URL]" \
  --out "clients/[Client Name]/Pipeline Data/research/raw-websites.json" \
  > "$LOGDIR/website.log" 2>&1 &
PID_W=$!

python3 tools/apify-scrape.py --client "[Client Name]" \
  --actor instagram \
  --handles "[client_ig_handle]" \
  --out "clients/[Client Name]/Pipeline Data/research/raw-instagram.json" \
  > "$LOGDIR/instagram.log" 2>&1 &
PID_I=$!

# Wait for all four; collect exit codes (0 = success per actor)
wait $PID_G; EXIT_G=$?
wait $PID_F; EXIT_F=$?
wait $PID_W; EXIT_W=$?
wait $PID_I; EXIT_I=$?

echo "Apify exit codes: google=$EXIT_G facebook=$EXIT_F website=$EXIT_W instagram=$EXIT_I"
```

If any actor's exit code is non-zero, check the corresponding `.apify-logs/[actor].log` file. The wrapper writes its own `RESEARCH-INCOMPLETE.md` for hard failures. Instagram is the only one safe to skip (many clients have no IG presence), its failure should not block the pipeline.

Results are cached at `clients/[Client Name]/Pipeline Data/research/apify-cache/[hash].json` so re-running the pipeline costs zero. Cost log at `apify-cost.json` enforces the $2/client cap (configurable via `APIFY_PER_CLIENT_USD_CAP` in `.env`).

If `RESEARCH-INCOMPLETE.md` appears in `clients/[Client Name]/Pipeline Data/research/`, fall through to native WebFetch + WebSearch and flag the gap in `research.json` with `data_confidence: "low"` on affected fields.

**Wall-clock impact:** 4 sequential actor calls = ~10-15 min. 4 parallel = ~3-5 min (bottleneck is the slowest actor, usually google-places + many reviews).

## Steps
Follow the research skill's 14-step process exactly. Output:
- `clients/[Client Name]/Pipeline Data/research/research-report.md`
- `clients/[Client Name]/Pipeline Data/research/research.json`

## Additional capture requirements
Before finishing, also extract:
- **business_hours**: opening and closing times from GBP listing (24-hour HH:MM format,
  plus IANA timezone, e.g. `{"open": "07:00", "close": "18:00", "tz": "America/Phoenix"}`).
  If not found, mark explicitly as `"Not found"`.
- **owner_cutout_url**: the URL of any owner/founder headshot or cutout photo on the
  existing website or GBP profile. If none exists, mark as null. The asset-scraper
  agent (Stage 4) will download it; this step only records the URL.

Both fields must appear in `research.json` under top-level keys `business_hours`
and `owner_cutout_url`.

## Pass gate
- Report has all 13 required sections
- `research.json` has all required fields populated (or explicitly marked "Not found")
- At least 3 competitors identified
- Brand voice tagged with 3-5 keywords
- `hasMascot` boolean is set (true/false, never null)
- `businessModel.primaryFocus` is set (retail/insurance/both)
- `marketSegment.primaryFocus` is set (residential/commercial/both)
- `manufacturerCerts` object populated (every flag explicitly true or false, never null)
- `specialOffers` object populated (every flag explicitly true or false)
- `financing.offered` is explicitly true or false
- `brandGuidelines.hasFormalGuide` is explicitly true or false
- `business_hours` is populated or explicitly "Not found"
- `owner_cutout_url` is populated or explicitly null

If any required field is null or any section is empty, loop and retry the relevant research step.