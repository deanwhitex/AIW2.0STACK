# AIW Content Engine, Build Plan

Single-tenant Next.js app. Each AIW student deploys their own Vercel instance with their own Supabase project and their own API keys.

**Stack:** Next.js 16 + React 19 + TypeScript + Tailwind v4 + Supabase (Postgres + Auth + Storage) + Anthropic Claude + Apify.

**Three paid services only.** OpenAI, AssemblyAI, Resend cut. Postgres full-text search replaces vector embeddings. Reel audio transcription skipped (use caption + metrics only). Email digest replaced by in-dashboard panels. Voice capture is text-only (paste captions, no audio upload).

**Build order:** Build the entire app with stubbed AI responses first (no Anthropic/Apify keys needed). Setup wizard is built as a real feature. At the very end, enter keys via the wizard and the stubs flip to real calls. Supabase is the only backend service set up early because it is free and is the database.

**Source of UI:** lift the working components from the upstream reference repo (context library, generator chat, pipeline kanban, feedback). Throw out everything filesystem-based.

---

## Phase 1, Project skeleton

- [ ] Next.js 16 app initialised in `/AIW CONTENT ENGINE/`
- [ ] Tailwind v4 configured
- [ ] `package.json` with all deps (Supabase, Anthropic, OpenAI, Apify, AssemblyAI, Resend, youtube-transcript)
- [ ] `.env.example` listing every required env var
- [ ] `.gitignore`
- [ ] `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`
- [ ] Empty `src/app/`, `src/components/`, `src/lib/`, `src/hooks/`, `src/middleware.ts`

## Phase 2, Supabase schema

- [ ] `supabase/migrations/0001_initial_schema.sql`, all tables, indexes
- [ ] Tables: `context_items`, `scripts`, `niche_watch`, `niche_signals`, `posts`, `performance`, `voice_profile`, `business_profile`, `app_settings` (stores API keys after wizard)
- [ ] Postgres `tsvector` full-text indexes on `context_items.summary`, `tags`, and `processed_content`
- [ ] Claude-generated summary + 10 keyword tags written into context_items at ingest
- [ ] Storage bucket: `uploads` (pdf/image)
- [ ] RPC functions for full-text retrieval per bucket

## Phase 3, Storage layer (no more filesystem)

- [ ] Supabase server client + browser client wrappers
- [ ] Replace every `fs.readFile`/`fs.writeFile` with Supabase queries
- [ ] File uploads → Supabase Storage
- [ ] Remove all hardcoded developer home-folder paths (anything matching `/Users/<name>/...` or `/home/<name>/...`)

## Phase 4, Auth + middleware

- [ ] Supabase Auth (email/password)
- [ ] Single-account lock model: first signup becomes the owner, signups disabled after
- [ ] Middleware protects every route except `/login`, `/setup`, `/api/auth/*`
- [ ] Logout flow

## Phase 5, Setup wizard (onboarding)

- [ ] `/setup` route runs on first login or when keys are missing
- [ ] Step 0: API keys (Anthropic + Apify) entered, saved to `app_settings` table (encrypted via Supabase Vault), validated by ping calls
- [ ] Step 1: niche, avatar, lead magnet, comment keyword default → seeded into `business_profile`
- [ ] Step 2: voice capture (paste 3 captions or paragraphs of writing) → builds `voice_profile`
- [ ] Step 3: Claude proposes 10 hashtags + 10 creator handles based on niche → user confirms → seeds `niche_watch`
- [ ] Step 4: Claude proposes 5 Expert Brain sources (YouTubes, podcasts) → user accepts → queued for ingestion
- [ ] Step 5: first generation runs → 3 reels appear in Idea column
- [ ] Resumable: state stored in `business_profile.onboarding_step`

## Phase 6, Context Library (full-text retrieval ingestion)

- [ ] Seven buckets: video-ideas, inspiration, expert-brain, my-voice, my-business, instructions, feedback
- [ ] Source types: text, youtube-url, instagram-reel, tiktok-url, pdf, link
- [ ] Ingestion pipeline per source type:
  - YouTube: `youtube-transcript` npm package (free, captions only)
  - Instagram reel: Apify scraper, captures caption + author + view count + likes (no audio transcription)
  - TikTok: Apify clockworks scraper, same caption-only approach
  - PDF: pdf-parse
  - Link: fetch + readability extraction
  - Text: store as-is
- [ ] After content is ready: Claude summarises to 5 bullets and emits 10 keyword tags
- [ ] Postgres `tsvector` indexed on summary, tags, processed_content
- [ ] Status pipeline: queued → fetching → summarising → ready
- [ ] Per-bucket list view, search, filter, soft-delete with 30-day retention
- [ ] **Stub mode:** when `ANTHROPIC_API_KEY` is missing, summary + tags are mocked from raw content

## Phase 7, Generator (full-text RAG)

- [ ] Tokenize user prompt + extract key terms via Claude
- [ ] Per-bucket Postgres full-text retrieval via RPC:
  - video-ideas: top-3
  - inspiration: top-5
  - expert-brain: top-3
  - my-voice: top-5 (always include 2 most recent)
  - my-business: full bucket
  - instructions: full bucket
  - feedback: top-5 ranked by recency × engagement delta
- [ ] Just-in-time research: if inspiration matches < 20, fire synchronous Apify scrape and add before continuing
- [ ] Master prompt assembly per `prompts.ts`
- [ ] Single Claude Sonnet 4.6 call with voice_profile in system prompt (no second pass)
- [ ] Validate `do_not_use_phrases` post-generation, regenerate offending scripts
- [ ] Tag each script with hook formula
- [ ] Hashtags + comment keyword generated within the same Claude call (output schema)
- [ ] Insert as `IDEA` cards in pipeline
- [ ] SSE streaming UX: stage labels (retrieving, researching, writing, done)
- [ ] Format selector: Reel / Carousel / Story Sequence
- [ ] Count selector: 1 / 3 / 5 / 10
- [ ] Pinned context items option
- [ ] **Stub mode:** when `ANTHROPIC_API_KEY` is missing, return realistic mock scripts

## Phase 8, Pipeline kanban

- [ ] Five columns: Idea, Approved, Shot, Edited, Posted
- [ ] @dnd-kit drag-and-drop
- [ ] Optimistic UI with backend revert on error
- [ ] Stalled card flags (yellow >3d, red >7d)
- [ ] Filters: format, age, performance tier, hook formula
- [ ] Inline editing with autosave debounce
- [ ] Approve locks edits with explicit unlock confirmation
- [ ] Regenerate-while-preserving-pins button
- [ ] "Mark posted" modal: URL paste + posted-at timestamp → creates `posts` row + schedules pulls

## Phase 9, Dashboard

- [ ] Default route `/`
- [ ] Panel 1, This Week: counts per stage, week-over-week delta
- [ ] Panel 2, Radar: top 3 NEW signals with Generate / Save / Dismiss
- [ ] Panel 3, Performance (last 30 days): total reach, top 5 posts by ER, format breakdown, hook formula breakdown
- [ ] Panel 4, Needs Your Attention: stalled cards, performance dips, unconverted Radar suggestions, voice profile staleness
- [ ] Quick-add posted URL box at top
- [ ] Refresh button (no auto-polling)

## Phase 10, Content Radar

- [ ] `niche_watch` settings page (`/radar/settings`)
- [ ] Add/remove hashtags + creator handles per platform
- [ ] Vercel Cron every 6 hours per niche_watch
- [ ] Apify hashtag scraper + creator scraper
- [ ] Velocity scoring: `current_views / hours_since_post / creator_baseline`
- [ ] Spike threshold ≥3.0
- [ ] Transcribe spiking items via AssemblyAI
- [ ] Claude generates suggestion text per signal
- [ ] Insert into `niche_signals`
- [ ] Surface top 3 NEW on Dashboard
- [ ] Generate / Save / Dismiss actions
- [ ] Per-source weighting: dismissed sources get higher threshold, generated sources get lower

## Phase 11, Performance feedback loop

- [ ] Vercel Cron pulls performance at +1h, +6h, +24h, +72h, +7d, +30d after `posted_at`
- [ ] Apify scrape on `posts.external_url`
- [ ] Insert into `performance` time-series
- [ ] After +24h: classify as winner (>2× median) / flop (<0.5× median)
- [ ] Auto-write to Feedback bucket: post-mortem string from Claude, embedded, becomes input to future generations
- [ ] Manual entry of `keyword_dms` count on Posted card
- [ ] Dashboard rollups via materialized views refreshed every 15 min

## Phase 12, Voice profile editor

- [ ] `/settings/voice` route
- [ ] Editable fields: tone descriptor, catchphrases[], do_not_use_phrases[], sample transcripts[]
- [ ] Auto-refresh every 14 days from posted content with user notification

## Phase 13, Settings + integrations

- [ ] `/settings` route
- [ ] Niche & avatar (editable post-onboarding)
- [ ] API keys (Anthropic, OpenAI, AssemblyAI, Apify, Resend), stored as Vercel env vars, displayed masked
- [ ] Notification preferences (Sunday email yes/no, banners yes/no)
- [ ] Danger zone: delete account, export all data (CSV/JSON ZIP)

## Phase 14, In-dashboard digest (no email)

- [ ] "This Week" panel surfaces pipeline summary on every dashboard load
- [ ] Stalled cards prominently flagged in "Needs Your Attention"
- [ ] Top performers from the week in Performance panel
- [ ] Inline reminder banner if Posted cards have no keyword_dms count after 24h

## Phase 15, Deploy + student setup

- [ ] `README.md` with one-click "Deploy to Vercel" button
- [ ] `docs/SETUP.md` student-facing setup guide (5 services to sign up for, 5 keys to enter)
- [ ] `vercel.json` with cron definitions
- [ ] Env validation on startup (fail fast if a required key is missing)
- [ ] Seed your own instance with {{AGENCY_NAME}} context for the live demo
- [ ] Backup demo recording

## Phase 16, Polish

- [ ] Empty states for every surface
- [ ] Recoverable vs permanent error distinction (Sonner toasts)
- [ ] Streaming progress in Generator
- [ ] Keyboard accessibility on kanban
- [ ] WCAG 2.1 AA for primary flows
- [ ] Sentry error reporting
- [ ] OpenTelemetry-style logging for every external API call (provider, latency, cost, request_id)

---

## Lessons captured during build

(written into `tasks/lessons.md` as we go, patterns that come from corrections or surprising successes)
