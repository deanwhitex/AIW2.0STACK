# Agent: Asset Scraper (Stage 4)

## Role
Harvest brand assets from the client's web presence into `clients/[Client Name]/[Client Name] Assets/`.

## Prerequisites
- Stage 2 passed
- READ `.claude/skills/asset-scraping/SKILL.md`

## Step 0, Read accumulated lessons (REQUIRED)

Before any other step, read these two files if they exist and apply every
rule listed as an override to this agent spec:

1. `.claude/lessons/by-agent/03-asset-scraper.md`, universal corrections that apply to every run of this agent
2. `clients/[Client Name]/Pipeline Data/lessons/notes.md`, corrections specific to this client only

Lessons take precedence over the default behaviour in this spec because they
are corrections the student made for a reason. If the universal rule and the
client-specific rule conflict, the client-specific rule wins.

If neither file exists, proceed.

## Scraping (REQUIRED order: Apify → fallback to native)

Reuse the Apify cache from Stage 2 (`apify-cache/`) before issuing new actor runs. Photo URLs from `raw-google.json`, `raw-facebook.json`, `raw-instagram.json` already enumerate the assets Apify discovered. Download those URLs directly with `curl` instead of re-running the actor.

If gaps remain (no logo URL found in cached results), run a fresh website crawl on the client domain to find the `<img>` tags carrying logo / badge / project / team / truck semantic clues:

```bash
python3 tools/apify-scrape.py --client "[Client Name]" \
  --actor website \
  --urls "[client site URL]" \
  --out "clients/[Client Name]/Pipeline Data/research/raw-website-asset-pass.json"
```

The wrapper enforces the same $2/client cap and writes `RESEARCH-INCOMPLETE.md` on hard failure. Fall back to native WebFetch when that flag appears.

## Steps
Follow the skill's 7-step execution:
1. Read research data + reuse Apify cache (`raw-google.json`, `raw-facebook.json`, `raw-instagram.json`)
2. Download asset URLs from cached Apify results into the right folders (logo, badges, projects, owner, truck) using `curl`
3. If logo is still missing, run a fresh `apify-scrape.py --actor website` pass on the client domain (see above)
4. Categorise and save with `manifest.json` per folder
5. Flag gaps with `MANUAL-DROP-NEEDED.md`
6. Halt if no logo found
7. Update pipeline state

## Pass gate
- Logo found OR `MANUAL-DROP-NEEDED.md` written in `logo/` (this halts the pipeline)
- Each asset folder has either content or a manual-drop-needed flag
- `manifest.json` written in each folder
