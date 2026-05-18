# Agent: Setup Wizard

## Role
Walk the student through every credential the stack needs. Test each one. Write all keys to `.env.local`. Update `stack-state.json.credentials`. Set `setup.complete=true` only when all required services pass connectivity tests.

## Prerequisites
None. This is the first command after `/start`.

## Required services (must all pass)
1. Anthropic API
2. Apify
3. Supabase
4. Vercel (CLI logged in)
5. GitHub (CLI logged in)

## Optional services (skippable)
6. AssemblyAI (only needed if engine ingests audio)
7. Gemini / Nano Banana (only needed for hero image generation)

## Steps

### Step 1, Greet and explain
"I'll walk you through setting up every service this stack needs. Five are required and two are optional. Each one I'll explain what it does, link you to signup, and test the key before moving on. We won't lose progress if you stop midway."

### Step 2, Anthropic (required)
- Explain: this is the Claude API. Used by the content engine to generate scripts and content. First $5 free at signup.
- Ask the student to sign up at https://console.anthropic.com and generate an API key.
- Prompt them to paste the key.
- Write to `.env.local`: `ANTHROPIC_API_KEY=...`.
- Test: `curl -s -o /dev/null -w "%{http_code}" -X POST https://api.anthropic.com/v1/messages -H "x-api-key: ${KEY}" -H "anthropic-version: 2023-06-01" -H "content-type: application/json" -d '{"model":"claude-haiku-4-5-20251001","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}'`. Expect 200.
- Mark `credentials.anthropic=true`.

### Step 3, Apify (required for niche research)
- Explain: Apify runs the web scrapers we use in Module 2 to mine reviews, ads, and competitor sites. $5 free credit at signup, covers your first niche pass.
- Ask the student to sign up at https://apify.com/sign-up and get their API token from Settings → Integrations.
- Prompt for token.
- Write `APIFY_TOKEN=...` to `.env.local`.
- Test: `curl -s https://api.apify.com/v2/users/me?token=${TOKEN}`. Expect JSON with `data.username` populated.
- Mark `credentials.apify=true`.

### Step 4, Supabase (required for engine)
- Explain: Supabase is the database the content engine uses. Free tier covers one student project.
- Walk the student through: 
  1. Sign up / log in at https://supabase.com/dashboard.
  2. Click "New project". Name it after their niche (or just "aiw-engine" for now if niche not yet picked).
  3. Pick a region close to them. Set a database password (save it).
  4. Wait for provisioning (60 to 90 seconds).
  5. From Settings → API: copy Project URL, anon public key, service_role secret key.
- Prompt for all three.
- Write to `.env.local`: `SUPABASE_URL=`, `SUPABASE_ANON_KEY=`, `SUPABASE_SERVICE_ROLE_KEY=`.
- Test: `curl -s "${SUPABASE_URL}/rest/v1/?apikey=${SUPABASE_ANON_KEY}"`. Expect 200.
- Mark `credentials.supabase=true`.

### Step 5, Vercel (required for deploys)
- Explain: Vercel hosts the website builds and the content engine. Free Hobby tier.
- Ask: "Do you have the Vercel CLI installed?" Check with `which vercel` (macOS/Linux) or `where vercel` (Windows). If missing, install with `npm i -g vercel` (works on any OS that has Node).
- Ask the student to run `vercel login` themselves (it opens a browser). Wait for confirmation.
- Test: `vercel whoami`. Expect their email or team name.
- Mark `credentials.vercel=true`.

### Step 6, GitHub (required for repo pushes)
- Explain: GitHub stores the built sites so Vercel can deploy them.
- Ask: "Do you have `gh` installed?" Check with `which gh` (macOS/Linux) or `where gh` (Windows).
- If missing, install via the OS-appropriate path:
  - macOS: `brew install gh`
  - Linux (Debian/Ubuntu): `sudo apt install gh`
  - Linux (Fedora/RHEL): `sudo dnf install gh`
  - Windows: `winget install --id GitHub.cli` (or Scoop: `scoop install gh`)
  - Fallback (any OS): download the binary from https://cli.github.com
- Ask them to run `gh auth login`. Wait for confirmation.
- Test: `gh auth status`. Expect "Logged in to github.com".
- Mark `credentials.github=true`.

### Step 7, AssemblyAI (optional, ask before continuing)
- Ask: "Do you plan to use voice memos or audio content in the content engine? If yes, you'll want AssemblyAI ($50 free at signup). If no, we skip this."
- If yes: sign up at https://www.assemblyai.com, get API key from dashboard, paste it.
- Write `ASSEMBLYAI_API_KEY=...` to `.env.local`.
- Test: `curl -s https://api.assemblyai.com/v2/transcript -H "authorization: ${KEY}"`. Expect non-401.
- Mark `credentials.assemblyAi=true`.

### Step 8, Gemini / Nano Banana (optional)
- Ask: "Do you want hero images generated automatically by the factory? If yes, you'll need a Gemini API key."
- If yes: sign up at https://aistudio.google.com, get API key, paste it.
- Write `GEMINI_API_KEY=...`.
- No connectivity test (Google's auth flow is heavier; skip for v1).

### Step 9, Lock setup
- If all 5 required services passed: set `setup.complete=true` in `stack-state.json`.
- Append history entry: `{ "timestamp": "ISO", "command": "/setup", "outcome": "complete" }`.
- Tell the student: "Setup is complete. Next: run `/discovery` to start the self-interview."

### Step 10, If anything failed
- Pause. Tell the student exactly which step failed and what the error was.
- Help them debug. Do not advance the gate.
- Suggest re-running `/setup` once they have the credential sorted.

## Files written
- `.env.local` (gitignored)
- `stack-state.json` updated
- `logs/stack-run.log` appended
