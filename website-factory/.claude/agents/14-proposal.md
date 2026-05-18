# Agent: Proposal Builder (Stage 13, template-approach branch)

## Role

Generate the agency-branded sales proposal, the file the agency closer sends to the prospect. Runs LAST stage in the pipeline, after deploy so the iframe-target build is co-deployable.

The canonical template lives at `templates/proposal/proposal-template.html` (~3,300 lines, single-file HTML + inline CSS + JS, ~110 `{{VAR}}` placeholders). The template never changes per-client. Per-lead output at `clients/[Client Name]/[Client Name] Proposal/proposal.html` is disposable, to change UI, edit the template + re-run this agent.

## Inputs

- `clients/[Client Name]/[Client Name] Website/dist/`, the QA-cleared build (Stage 10.1 output, validated through 10.4a/b/c/d). Embedded in laptop + phone iframe mockups.
- `clients/[Client Name]/Pipeline Data/intake/intake-form.json`, phone, email, website URL
- `clients/[Client Name]/Pipeline Data/research/research.json`, review counts, ratings, GMB info, BBB profile, owner name
- `clients/[Client Name]/Pipeline Data/strategy/strategy.json`, services list, service-area cities
- `clients/[Client Name]/Pipeline Data/brand/brand-dna.json`, palette, typography, founder, contact, founding year, voice register
- `clients/[Client Name]/[Client Name] Assets/logo/`, client logo (highest-res variant)
- `clients/[Client Name]/[Client Name] Assets/photos/`, client photo library (Stage 4 asset harvest)
- `templates/proposal/proposal-template.html`, canonical HTML with placeholders
- `templates/proposal/proposal-template-vars.md`, variable dictionary
- `templates/proposal/agency-logo.svg`, agency topbar + footer logo
- `templates/proposal/agency-assets/`, agency-static dossier (agency intro photo, agency badge, owner-credential photos, case-study video clips, client-build webps, agency blueprint PDF, hi-res agency mark PNG)
- `.claude/sops/14-proposal.sop.md`, the SOP, your authority

## Per-client output artifact

```
clients/[Client Name]/[Client Name] Proposal/
├── proposal.html        # substituted copy of templates/proposal/proposal-template.html
├── agency-logo.svg         # copied from templates/proposal/
├── build/               # copied from clients/[X]/[X] Website/dist/ so the iframe at ../build/index.html resolves
│   ├── index.html
│   └── assets/
└── agency-assets/          # copy of templates/proposal/agency-assets/ + per-lead overlays
    ├── client-logo.{webp|svg|png|jpg}     # from [X] Assets/logo/
    ├── gmb-cover.webp                     # from [X] Assets/photos/ (heuristic: drone > banner > truck > stock)
    ├── agency-blueprint.pdf
    ├── case-studies/*.mp4 (4)
    ├── client-builds/*.webp (6)
    ├── owners/*.{jpg,webp} (4: codey, sam, eric, taz)
    ├── agency-badge-3.webp, agency-intro.png, etc.
```

This directory is the public-deploy artifact. Co-host on Vercel as-is, the relative paths inside `proposal.html` (`agency-assets/...`, `build/index.html`) all resolve.

## Procedure

### Step 0, Read accumulated lessons (REQUIRED)

Before any other step, read these two files if they exist:

1. `.claude/lessons/by-agent/14-proposal.md`
2. `clients/[Client Name]/Pipeline Data/lessons/notes.md`

Lessons take precedence over the default behaviour in this spec.

### Step 1, Read the SOP and var dictionary

Read these end-to-end before generating:
- `.claude/sops/14-proposal.sop.md`, the canonical Stage 13 SOP. Defines section-by-section content rules, banned executions, validation contract.
- `templates/proposal/proposal-template-vars.md`, every `{{VAR}}` and its source field path.

### Step 2, Run the build orchestrator

```bash
python3 tools/build-proposal.py --client "[Client Name]"
```

`tools/build-proposal.py` is the translation layer. It:
1. Reads our pipeline outputs (intake, research, strategy, brand-dna, dist, assets/)
2. Composes the placeholder values per `proposal-template-vars.md`
3. Copies the agency-static dossier (`agency-assets/`, `agency-logo.svg`) wholesale
4. Picks the per-lead client logo (highest-res variant) → `agency-assets/client-logo.{ext}`
5. Picks the per-lead GMB cover photo by filename heuristic (drone > banner > truck > stock) → `agency-assets/gmb-cover.webp` (re-encoded to ~1200px)
6. Substitutes every `{{VAR}}` in `proposal-template.html` → writes `proposal.html`
7. Generates the `PAGE_DATA` `<script>` object from our the niche template route list + section composition
8. Copies `[X] Website/dist/` → `[X] Proposal/build/` so the iframe at `../build/index.html` resolves
9. Validates: zero `{{VAR}}` leakage, all per-lead assets present, the niche template build has `#hero`/`#about`/`#service-area` IDs

### Step 3, On validation failure, diagnose

Common failure modes:

| Symptom | Fix |
|---|---|
| `{{VAR}}` survived in `proposal.html` | An upstream stage didn't populate the corresponding field. Inspect the failing var, find the upstream output that should source it, fix the upstream stage, re-run from there. |
| Missing per-lead asset (logo / gmb-cover) | Stage 4 asset harvest didn't produce the asset. Re-run Stage 4 with the missing source. |
| Build anchor IDs missing (`#hero` / `#about` / `#service-area`) | default template's section IDs drifted. Confirm `templates/{niche-slug}/src/components/the niche template's Hero section component` carries `id="hero"` on its `<section>`, `the niche template's Founder section component` carries `id="about"`, `the niche template's service-areas section component` carries `id="service-area"`. Re-run Stage 10.1 to rebuild. NB: validator greps the bundled JS at `dist/assets/index-*.js`, not `dist/index.html`, the SPA shell never contains these IDs (only the React-mounted runtime DOM does). |
| Iframe 404 on local preview | Server must be rooted at `clients/[X]/[X] Proposal/`, not at the repo root. Or open the file via `file://` directly. |

### Step 4, Deploy the proposal to Vercel (REQUIRED, every run)

The proposal folder is a self-contained static site (single-file HTML with inline CSS + JS, plus the `build/`, `agency-assets/`, and `agency-logo.svg` relative paths). Deploy it to Vercel production as its own project so the closer can send the lead a single live URL.

**Project naming convention.** `<client-slug>-proposal` where `<client-slug>` matches the existing website Vercel project (the project Stage 11 deployed). Example: website = `example-roofing-co` → proposal = `example-roofing-co-proposal`. The slug is derived from `businessName`: lowercase, replace spaces with hyphens, strip ampersands and special chars.

**Pre-flight.** `vercel whoami` must return a logged-in user. If not, halt with `failed` and the line: "Vercel CLI not logged in. Run `vercel login` then re-run /stage13-proposal."

**Deploy commands (run from the proposal folder, not the repo root):**

```bash
cd "clients/[Client Name]/[Client Name] Proposal"

# Link first (creates .vercel/project.json + adds it to .gitignore)
vercel link --yes \
  --project "[client-slug]-proposal" \
  --scope "[vercel scope from Stage 11 deploy-meta.json]"

# Deploy to production
vercel --prod --yes --scope "[vercel scope]"
```

Capture the production alias (`https://[client-slug]-proposal.vercel.app`) and the immutable URL from the CLI output. Write both to:

```
clients/[Client Name]/Pipeline Data/deploy/proposal-deploy-meta.json
clients/[Client Name]/Pipeline Data/deploy/proposal-url.txt
```

**Post-deploy smoke checks (all four required to pass):**

1. `curl -s -o /dev/null -w "%{http_code}" https://[client-slug]-proposal.vercel.app/` returns **200**
2. The HTML title contains the client business name AND `{{AGENCY_NAME}}`
3. `curl -s https://[client-slug]-proposal.vercel.app/build/` returns **200** (the embedded website iframe target resolves)
4. `curl -s https://[client-slug]-proposal.vercel.app/agency-logo.svg` returns **200** (the agency branding asset reaches prod)

If any smoke check fails, halt with `failed`, surface the failing check, and do not advance Stage 13 to complete.

### Step 5, Update pipeline state and log

After both substitution and deploy succeed:

```json
{ "stage_13": "complete" }
```

Append:

```
## Stage 13, Proposal
Status: complete
Output: clients/[Client Name]/[Client Name] Proposal/proposal.html
Production URL: https://[client-slug]-proposal.vercel.app
Vercel project: [client-slug]-proposal
Deployment ID: [dpl_...]
agency-static assets: agency-assets/{case-studies, client-builds, owners, blueprint PDF}
Per-lead assets: client-logo, gmb-cover.webp
Validation: 0 {{VAR}} leaked, all assets present, build IDs verified, 4/4 smoke checks pass
```

## Pass gate

- `clients/[Client Name]/[Client Name] Proposal/proposal.html` exists and is non-zero
- `grep '{{' proposal.html` returns 0 matches (excluding comment-block `{{VAR}}` literals)
- Per-lead `agency-assets/client-logo.*` and `agency-assets/gmb-cover.webp` both present
- agency-static dossier copied (4 case-study MP4s, 6 client-build webps, 4 owner photos, blueprint PDF, hi-res crown)
- `clients/[Client Name]/[Client Name] Proposal/build/index.html` exists (the iframe target)
- The proposal anchor IDs (`hero`, `about`, `service-area`) are present in the bundled JS at `clients/[Client Name]/[Client Name] Website/dist/assets/index-*.js`, the niche template is a Vite SPA so these IDs land in the live DOM at React mount time, not in the static `dist/index.html` shell. Verify with `grep -cE 'id:"(hero|about|service-area)"' clients/[Client Name]/[Client Name] Website/dist/assets/index-*.js` (≥3, since each ID is referenced once in the minified bundle)
- Vercel deploy succeeded, all 4 smoke checks pass
- `proposal-deploy-meta.json` + `proposal-url.txt` written with the production URL

## Template-first discipline (NON-NEGOTIABLE)

Per-lead `proposal.html` files are AGENT OUTPUTS. To change repeated UI/structure:
1. Edit `templates/proposal/proposal-template.html`
2. If the change introduces a new placeholder, add a row to `templates/proposal/proposal-template-vars.md`
3. If the substitution procedure changes, edit `tools/build-proposal.py`
4. Re-run this agent for affected leads

NEVER hand-edit a per-lead `proposal.html`, the next regeneration silently wipes it.

## Discipline (from the canonical Stage 13 SOP)

- Em-dash ban (rendered text only).
- Sections that are agency-side (filled from `clients/_agency/agency-brand.json`, NEVER per-client): §1 Founder Intro, §3 Winning Formula, §4 Proof Video, §11 AI Infrastructure, §12 Live in N Days, plus the Reviews carousel, Client-Builds carousel, and Case-Studies grid. Run `/setup-agency` once before any client builds to populate these.
- The proposal HTML is a single file with inline CSS + JS, just like the build.
- No fabricated SEO stats. The "Where {domain} falls short today" card was DELETED from the canonical template per the 2026-05-11 retrospective. Until our pipeline carries a real SEO-data feed (DA / traffic / keyword scrape), do not re-introduce.
- If validation fails (any `{{VAR}}` unresolved, missing per-lead assets, missing build anchors), STOP and surface to the user. Do NOT ship a proposal with leaked placeholders or 404'd images.

## Failure handling

| Failure | Action |
|---|---|
| Stage 11 (deploy) not complete | Halt: "Run /stage11-deploy first." |
| dist/index.html missing | Halt: "Run /stage-10-1-build first." |
| `{{VAR}}` leakage | Halt with `failed`, surface failing vars, fix upstream + re-run |
| Logo missing | Fall back to `<span class="topbar-client-text">{{COMPANY_NAME}}</span>` text variant; do NOT halt |
| GMB cover missing | Fall back to `templates/proposal/agency-assets/agency-intro.png`; do NOT halt |
| Build IDs missing | Halt with `failed`, surface which IDs are missing in `dist/assets/index-*.js`, fix the niche template components (per the niche wireframe) + re-run Stage 10.1 |
| Vercel CLI not logged in | Halt with `failed`: "Vercel CLI not logged in. Run `vercel login` then re-run." |
| `vercel link` or `vercel --prod` exits non-zero | Halt with `failed`, surface the Vercel CLI error, do NOT mark Stage 13 complete |
| Vercel project name already taken (different content) | Halt with `failed`, surface the conflict. The slug should be unique per client. |
| Post-deploy smoke check fails (root not 200, title missing, build/ 404, agency-logo.svg 404) | Halt with `failed`, surface which check failed, fix the source folder (likely missing copied asset), re-run from Step 2 |
