# Agent: Engine Deployer

## Role
Deploy the content engine to Vercel via CLI. Provision Supabase migrations. Wire up env vars. Capture the live URL.

## Prerequisites
- `m7.engineBriefLocked=true`
- `credentials.supabase=true`, `credentials.vercel=true`, `credentials.anthropic=true`
- `.env.local` has all engine keys

## Steps

### Step 1, Verify env file
```bash
cat .env.local | grep -E "^(SUPABASE|ANTHROPIC|APIFY)" | wc -l
```
Expect at least 5 lines (URL, ANON, SERVICE_ROLE, ANTHROPIC, APIFY).

If anything missing, halt and tell the student which env var is empty.

### Step 2, Verify Supabase project

Confirm with the student which Supabase project to use. Two options:
- (a) Use the existing project from `/setup` (paste-ready).
- (b) Create a new project specifically for this niche.

If (b), walk them through creating it at console.supabase.com, getting the URL and keys, then update `.env.local` for the engine-specific keys.

### Step 3, Run Supabase migrations

```bash
cd content-engine
ls supabase/migrations/
```

For each migration file in order:
- Show the student the migration name and a one-line description.
- Get confirmation, then apply via Supabase SQL Editor (paste-walk: open `https://supabase.com/dashboard/project/{ref}/sql`, paste, run).
- Confirm success in the dashboard before moving to the next.

Alternative: if `supabase` CLI is installed and logged in, run `supabase db push` from `content-engine/`.

### Step 4, Write content-engine/.env.local

```bash
cd content-engine
```

Create `content-engine/.env.local` with:

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
ANTHROPIC_API_KEY=...
APIFY_TOKEN=...
ASSEMBLYAI_API_KEY=... (if available)
```

Source values from the stack root `.env.local`.

### Step 5, Push to a fresh GitHub repo

Ask the student: "What do you want the repo named on GitHub? Suggest: `aiw-engine-{niche-slug}`."

```bash
cd content-engine
git remote remove origin 2>/dev/null
gh repo create aiw-engine-{slug} --private --source=. --remote=origin
git add .
git commit -m "Initial deploy from AIW 2.0 stack"
git push -u origin main
```

(If the engine repo already has commits from upstream, preserve them, only add the env wiring as a new commit.)

### Step 6, Deploy to Vercel

```bash
cd content-engine
vercel --prod
```

Vercel CLI will:
- Detect Next.js.
- Prompt for project name (default to repo name).
- Prompt for env vars (use values from `.env.local`).

Walk the student through any prompts. After deploy, capture the URL.

### Step 7, Set env vars in Vercel dashboard

Some env vars need to be set in the Vercel project dashboard for production runs:

- Open `https://vercel.com/dashboard` → the new project → Settings → Environment Variables.
- For each of the 5 to 6 env vars from `content-engine/.env.local`, add to Production scope.
- Trigger a redeploy: `vercel --prod`.

### Step 8, Record the deployment

Write `deployments/engine/vercel-url.txt` with the live URL.
Write `deployments/engine/supabase-project.json` with `{ ref, url, dashboardUrl }`.
Append `deployments/engine/deploy.log` with timestamp and outcome.

### Step 9, Smoke test

Open the live URL. Confirm the login page loads. Try the signup flow with the student's email. Confirm they land in the empty dashboard.

If anything errors, debug. Common issues:
- Missing Supabase tables → re-run migrations.
- Auth not working → confirm Supabase Auth provider settings.
- 500s → check Vercel logs (`vercel logs {url}`).

### Step 10, Lock
- Set `engine.deployed=true`.
- Set `deployments.engine = { url, deployedAt, supabaseRef }`.
- Tell the student: "Engine live at {url}. Next: `/walk-engine` walks you through pasting your brief into the seven buckets."

## Files written
- `content-engine/.env.local` (gitignored)
- `deployments/engine/vercel-url.txt`
- `deployments/engine/supabase-project.json`
- `deployments/engine/deploy.log`
- `stack-state.json` updated
