# Setup guide

This is what every AIW student does once to get their own Content Engine running.

It takes about 15 minutes the first time. Three free accounts to create. Three paid services to fund (each is pay-as-you-go).

---

## What you need before you start

Sign up for these. Have the keys ready.

| Service | What it does | Sign up | Cost |
|---|---|---|---|
| Supabase | Database, auth, file storage | https://supabase.com | Free tier covers it |
| Vercel | Hosting + cron jobs | https://vercel.com | Free tier covers it |
| Anthropic | Claude (the brain) | https://console.anthropic.com | Pay-as-you-go, top up $20 |
| Apify | Instagram + TikTok scraping | https://apify.com | $5 free credit, then ~$5 per 1000 results |
| AssemblyAI | Audio transcription for reels | https://www.assemblyai.com | Pay-as-you-go, $10 covers months |

---

## Step 1: Create your Supabase project

1. Go to https://supabase.com and sign in
2. Click `New Project`
3. Project name: `aiw-content-engine` (or whatever)
4. Database password: generate one and save it in your password manager
5. Region: closest to you (Europe folks pick London or Ireland)
6. Plan: Free
7. Wait ~2 minutes while it provisions

When done, go to `Project Settings → API`. Save these three values somewhere private:

- `Project URL` (looks like `https://xxxxxxxxxxxx.supabase.co`)
- `anon public` key
- `service_role` key (click `Reveal`)

## Step 2: Run the schema migrations

In your Supabase project: `SQL Editor → New query`. Paste the contents of:

1. `supabase/migrations/0001_initial_schema.sql`
2. `supabase/migrations/0002_add_audio_video_source_types.sql`

Click `Run` after each. Should say `Success. No rows returned.`

## Step 3: Disable email confirmation

For a single-tenant deployment, email verification adds friction with no benefit.

`Authentication → Providers → Email → toggle "Confirm email" OFF → Save`

## Step 4: Deploy to Vercel

Click the `Deploy to Vercel` button in the README. Vercel will:

1. Fork the repo to your GitHub
2. Ask for environment variables
3. Build and deploy

Set these env vars during the deploy flow (you can also set them later in `Settings → Environment Variables`):

- `NEXT_PUBLIC_SUPABASE_URL`, your Project URL from Step 1
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`, your anon key from Step 1
- `SUPABASE_SERVICE_ROLE_KEY`, your service_role key from Step 1
- `CRON_SECRET`, generate via `openssl rand -hex 32` and paste

Leave `ANTHROPIC_API_KEY`, `APIFY_API_TOKEN`, `ASSEMBLYAI_API_KEY` blank for now. You'll enter them in the in-app setup wizard.

## Step 5: Open your deployment

Vercel gives you a URL like `your-name.vercel.app`. Open it.

You should see "Claim this instance", click it, sign up with your real email and a strong password (save it). After signup you land on the Setup wizard.

## Step 6: Run the setup wizard

Six steps:

1. **API keys**, paste your Anthropic, Apify, AssemblyAI keys. They're stored in your Supabase, encrypted via service role.
2. **Niche & avatar**, answer 8 short questions about your business. Claude proposes a niche, avatar, offer hypothesis. Edit anything that's wrong.
3. **Voice capture**, paste 3 captions you've written, or upload a voice memo. Claude uses these as the voice anchor for every script.
4. **Radar seed**, Claude proposes 10 hashtags + 10 creator handles to monitor. Click any to remove.
5. **Expert Brain seed**, Claude proposes 5 foundational sources for your niche. Untick any you don't want.
6. **First generation**, engine writes 3 introduction reels for you. They land in the Idea column.

You're done.

---

## Day-to-day use

- **Workspace** (`/`): the chat box at the bottom. Type what you want, get scripts. Drag through the kanban.
- **Dashboard** (`/dashboard`): pipeline counts, performance, what needs attention.
- **Radar** (`/radar`): trending content in your niche, refreshed every 6 hours. Generate your version with one click.
- **Settings** (`/settings`): edit your business profile, voice profile, API keys.

---

## Cost estimate

Per month, at typical usage of ~150 scripts and a healthy Radar:

| Line item | Estimate |
|---|---|
| Anthropic (generation + summarisation + Radar suggestions + post-mortems) | $8 |
| Apify (Radar every 6h + reel ingestion + performance pulls) | $7 |
| AssemblyAI (~5 hours of source audio per month) | $1 |
| Supabase | Free |
| Vercel | Free |
| **Total** | **~$16** |

Cheaper than most SaaS subscriptions. You also own the data and can leave anytime.

---

## Troubleshooting

**Login shows "Welcome back" but I never signed up:** there's a leftover user. Go to Supabase `Authentication → Users` and delete it. Refresh.

**Login fails with "Invalid path specified":** your `NEXT_PUBLIC_SUPABASE_URL` is wrong. It should be the bare project URL (e.g. `https://xxxxx.supabase.co`), not the REST endpoint. No `/rest/v1/`, no trailing slash.

**Status page shows orange dots:** restart the dev server (env vars only load on boot) or, in Vercel, redeploy after setting env vars.

**Generation is generic:** make sure your voice profile has 3 strong samples. Settings → Voice profile.

**Radar isn't finding anything:** Apify key not set, or no niche_watch entries configured. Check Settings → Radar.
