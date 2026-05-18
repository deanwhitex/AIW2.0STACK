# AIW 2.0 Stack

A complete client-onboarding system for AIW students. Clone once. Run the commands. Ship.

## What this stack does

You clone this repo. You run a guided onboarding inside Claude Code. By the end you have:

1. A niche you have evidence to commit to.
2. A productized offer with cold-DM copy ready to send.
3. A fully tailored website factory that builds CRO-optimized sites for businesses in your niche. **This is what you sell to clients.**
4. A content engine deployed on your own Vercel that surfaces niche-specific content ideas you post on your own social channels to pull leads inbound. **This is your alternative to grinding cold DMs.**

You then sell. Each paying client runs through your tailored factory. The content engine runs alongside, generating leads for you while you build for the clients you already signed.

## Three actors, never confused

| Actor | Example (niche = roofers) |
|---|---|
| **You (the student)** | The agency owner. You run the stack, sell the websites, and run the content engine for your own lead-gen. |
| **Your client** | A roofing company that pays you for a website. Never pays for or sees the content engine. |
| **Your client's customer** | A homeowner deciding on a roof. Every line of the website is written to convert them. |

The websites the factory produces convert the **end customer**. That is what every CRO, trust, and copy decision in the factory targets. The content engine targets a different audience entirely: it produces ideas you post on your own LinkedIn, Instagram, etc. to attract clients to YOU.

## What's inside

- `research/`, the self-interview, niche research, offer pack, and downstream briefs.
- `website-factory/`, the website-factory shell. Tailored to your niche after Module 5. **What you sell to clients.**
- `content-engine/`, pre-loaded from `aiwcontentengine`. Deployed to **your own** Vercel after Module 7. **Your lead-gen system, not a client deliverable.**
- `deployments/`, live URLs and screenshots from your factory and engine builds.
- `logs/`, audit trail, Apify invocation log.

## Niches the stack supports

Any niche. Module 2D captures the best-of-niche websites, scores them, and scaffolds a fresh Vite + React template inside the factory tuned to that niche. The default website template (home-services and trades) is the fallback. Per-niche templates are built on demand.

The research and offer crafting stages work for any niche too.

## How to start

1. Open this folder in Claude Code.
2. Type `/start`.

Claude reads the state file and tells you the next command. Every command writes its output, updates the state, and stops.

## First-time order

```
/start                       you'll be told to run /setup first
/setup                       walks you through every credential
/setup-agency                your agency profile (founder, reviews, pricing, palette)
                             feeds every client proposal at Stage 13
/discovery                   Module 1, self-interview
/score-niches                Module 2A, score 5 candidates
/research                    Module 2B, deep Apify research on 3 finalists
/pick-niche                  Module 2C, lock the chosen niche
/build-niche-template        Module 2D, capture, score, pick, scaffold niche template
/craft-offer                 Module 3, offer pack and cold DMs
/load-factory-structure      Module 4 (auto)
/generate-wf-brief           Module 5, website factory brief
/tailor-factory              apply brief to the factory
/run-factory                 hand off into the factory's own pipeline
/load-engine-structure       Module 6 (auto)
/generate-ce-brief           Module 7, content engine brief
/deploy-engine               deploy the content engine to Vercel
/walk-engine                 paste the brief into the live dashboard
```

After your first client build:

```
/factory-feedback            capture what worked and what did not
/refine-template             apply lessons back to your niche template
```

Anytime utility:

```
/status                      print every gate and the next command
/help                        list every command, marked runnable or blocked
```

## Credentials you will need (handled by /setup)

| Service | What you do | Free signal |
|---|---|---|
| Anthropic | Sign up at console.anthropic.com | First $5 free |
| Apify | Sign up at apify.com/sign-up | $5 free credit covers Module 2B. Module 2D needs another $5 top-up. |
| Supabase | Create one project at supabase.com/dashboard | Free tier is enough |
| Vercel | Install CLI and `vercel login` | Hobby tier free |
| AssemblyAI | Sign up at assemblyai.com | $50 free credit |
| GitHub | `gh auth login` | Free |

All keys land in `.env.local` which is gitignored. Never commit secrets.

## Rules baked into this stack

- No em-dashes, no emojis in any output the stack produces.
- Plain language, short sentences, calm and direct.
- One module at a time. Hard gates between modules.
- Nothing publishes, pushes, or deploys without your explicit approval.

## Troubleshooting

- If a command refuses to run, check `stack-state.json` for which gate is false.
- `/status` prints all gates and the next command.
- `/help` lists every command and shows which ones are currently runnable.
- Apify spend climbing? Check `logs/apify-runs.jsonl` for per-actor cost.
