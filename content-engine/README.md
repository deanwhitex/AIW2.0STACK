# AIW Content Engine

Instagram reels, carousels, and story sequences produced in your voice. Bundled with the AIW mentorship.

## What it is

A single-tenant web app you deploy to your own Vercel project, backed by your own Supabase database, running on your own API keys. No SaaS subscription. No shared infrastructure. You own the data and the cost.

## Five things it does

1. **Context Library**, drop YouTube URLs, Instagram reels, voice memos, PDFs, or text into seven role-defined buckets. The engine ingests, summarises, and indexes every item.
2. **Generator**, type "5 reels about why agencies don't convert" into the chat box. The engine pulls the most relevant context across buckets, runs Claude with your voice profile, and drops 5 ready-to-film scripts into the kanban.
3. **Pipeline kanban**, every script flows through Idea → Approved → Shot → Edited → Posted. Drag between columns. Edit inline.
4. **Content Radar**, every 6 hours, the engine scrapes your niche's hashtags and creators, scores by velocity, and surfaces what's spiking. One click writes you a version in your voice.
5. **Performance loop**, paste the URL after you post. The engine pulls metrics every hour for 30 days, classifies winners and flops, and writes the lesson back into the Feedback bucket. Future generations get sharper over time.

## Stack

- Next.js 16 + React 19 + TypeScript + Tailwind v4
- Supabase (Postgres + Auth + Storage)
- Anthropic Claude (everything LLM)
- Apify (Instagram + TikTok scraping)
- AssemblyAI (audio transcription)
- youtube-transcript (free YouTube captions)

## Setup

Full walkthrough: [docs/SETUP.md](docs/SETUP.md).

Short version:
1. Create Supabase project (free)
2. Run the SQL migrations in Supabase
3. Deploy to Vercel
4. Set the three Supabase env vars + a CRON_SECRET in Vercel
5. Open your deployed URL, sign up to claim the instance, walk through the 6-step wizard

## Local dev

```bash
git clone <this repo>
cd "AIW CONTENT ENGINE"
npm install
cp .env.example .env.local
# fill in the Supabase env vars
npm run dev
# open http://localhost:3005
```

The app boots without paid API keys. Anything that needs Anthropic / Apify / AssemblyAI runs in stub mode until you add the key via the in-app Settings page.

## Repo layout

```
.
├── src/
│   ├── app/                   Next.js app router (pages + API routes)
│   ├── components/            UI (Workspace, Library, Generator, Kanban, Dashboard, Radar)
│   └── lib/                   Domain logic, integrations, helpers
├── supabase/migrations/       SQL migrations (run these in your Supabase SQL editor)
├── docs/                      Setup guide and architecture notes
├── tasks/
│   ├── todo.md                Live build plan
│   └── lessons.md             Patterns captured during the build
├── .env.example               Copy to .env.local and fill in
├── vercel.json                Cron schedule + per-route function timeouts
└── README.md
```

## Cost estimate

About $16/month at typical usage. Detailed breakdown in [docs/SETUP.md](docs/SETUP.md).

## License

Private. Bundled with the AIW mentorship offer. Not for resale or redistribution.
