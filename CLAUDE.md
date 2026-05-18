# AIW 2.0 Stack

You are running the AIW 2.0 Stack. The stack productizes the full lifecycle for an AIW student starting a niche web and marketing agency: self-discovery, niche selection, deep niche research, offer crafting, factory tailoring, factory run, content engine deploy, and engine context paste.

## Who is involved (keep these straight at all times)

| Actor | Example for niche = roofers | What we do for them |
|---|---|---|
| **The student** | An AIW grad starting their niche agency | Runs this stack. Gets a productized offer, a niche-tuned website factory they sell to clients, and a content engine they run for themselves to generate inbound leads |
| **The student's client** | A roofing company | Buys a website the student builds for them via the factory |
| **The end customer** | A homeowner staring at a $15k roof bill | The website's actual audience. Every trust, CRO, and copy decision targets them |

Every research output, every trust signal, every CRO pattern, every word of copy in the website factory is optimized for the **end customer** of the niche business. The factory builds websites for the student's clients, but the websites must convert the client's customers.

**The content engine is the student's own lead-generation system, not a client deliverable.** The student deploys it to their own Vercel project, populates it with niche-specific context, and uses it to surface ideas and content they post on their own social channels to pull leads inbound. It is an alternative or complement to grinding cold DMs from Module 3. Clients never see the engine and never pay for it.

## How this stack runs

The student types a slash command. Claude does the work for that command and stops. State lives in `stack-state.json`. Hard gates prevent forward motion until prerequisites are locked.

When the student types nothing (or `/start`), read `stack-state.json` and tell them the next `/command` to run. Never auto-advance stages.

## Operator rules

These are the universal operating principles for every output this stack produces. Apply on every run:

- No em-dashes. Ever.
- No emojis. Ever.
- Calm, direct, professional tone. Plain words, short sentences, one idea per sentence.
- Match the student's region for slang and currency. Use the student's local currency when discussing student-facing costs (USD default, can be GBP/EUR/ZAR/etc).
- No buzzwords. No "leverage", "synergize", "robust", "seamless", "game-changer", "cutting-edge".
- Never publish, push, deploy, or send anything without the student's explicit approval.
- Plan first, present, wait, execute.
- If you are not 100% sure, ask a clarifying question before proceeding.

## The 8-module flow (Stage 1: Research, Offer, and Template)

1. **Module 1, Discovery Interview** (`/discovery`), self-interview, 7 sections, output `research/01-student-profile.md`.
2. **Module 2A, Niche Scoring** (`/score-niches`), score 5 candidates on 7 factors, top 3 flagged.
3. **Module 2B, Deep Niche Research** (`/research`), Apify-driven intelligence on 3 finalists. Seven sub-tasks per niche.
4. **Module 2C, Niche Decision** (`/pick-niche`), pick the niche.
5. **Module 2D, Niche Template Builder** (`/build-niche-template`), capture top-of-niche sites, score, pick a winner, scaffold a Vite + React template inside the factory.
6. **Module 3, Offer Crafting** (`/craft-offer`), positioning, stage, cold DMs, output `research/03-offer-pack.md`.
7. **Module 4, Load Factory Structure** (`/load-factory-structure`), auto-scan `website-factory/` tree.
8. **Module 5, Website Factory Brief** (`/generate-wf-brief`), output `research/output/website-factory-brief.md`.
9. **Stage 2, Tailor and Run Factory** (`/tailor-factory`, `/run-factory`), apply brief, then hand off into factory's own pipeline.
10. **Module 6, Load Engine Structure** (`/load-engine-structure`).
11. **Module 7, Content Engine Brief** (`/generate-ce-brief`), output `research/output/content-engine-brief.md`.
12. **Stage 3, Deploy and Walk Engine** (`/deploy-engine`, `/walk-engine`), Vercel deploy plus bucket-by-bucket paste.
13. **Lessons loop** (`/factory-feedback`, `/refine-template`), capture post-run learnings, refine the niche template.

The framework is at [research/_framework/Student_Research_System.md](research/_framework/Student_Research_System.md). Treat it as canonical. Never edit it.

## Subfolder boundaries

- When working inside `website-factory/`, defer to that folder's [CLAUDE.md](website-factory/CLAUDE.md). It has its own 13-stage pipeline.
- When working inside `content-engine/`, defer to that folder's CLAUDE.md if present.
- The root only orchestrates handoffs and tailoring. Don't reach inside subfolders for logic; call their commands.

## Niche scope

Module 2D scaffolds a fresh Vite + React template inside the factory for each chosen niche, based on the best-of-niche websites captured via Apify. The factory's `config/template-routes.json` registers each niche template. The default website template (home-services / contractor) is used if no niche-specific template exists for a client's niche. This means the stack supports any niche, not just home-services.

## State machine

`stack-state.json` tracks every gate. Read it before suggesting a command. Update it after each module completes. Append an entry to `history` on every transition with timestamp, command, and outcome.

Gate chain (read top to bottom):

```
setup.complete
  → m1.profileLocked
  → m2a.scoresLocked
  → m2b.researchComplete
  → m2c.nicheDecided  (sets stack-state.json.niche)
  → m2d.templateBuilt  (scaffolds website-factory/templates/{niche-slug}/)
  → m3.offerLocked
  → m4.factoryStructureLoaded  (auto)
  → m5.factoryBriefLocked
  → factory.tailored
  → factory.deployed  (factory's own pipeline writes this)
  → m6.engineStructureLoaded  (auto)
  → m7.engineBriefLocked
  → engine.deployed
  → engine.contextPasted
```

If a student tries to run a command whose prerequisite gate is false, refuse and tell them which command to run first.

## Files this stack touches

Stack root:
- `stack-state.json`, read on every command, written after every transition.
- `.env.local`, credentials, created by `/setup`, never committed.
- `logs/stack-run.log`, append-only audit trail.
- `logs/apify-runs.jsonl`, one line per Apify actor invocation.

Research:
- `research/_framework/Student_Research_System.md`, canonical framework, read-only.
- `research/_structure/*.md`, auto-generated by Modules 4 and 6.
- `research/_state/project.json`, current module pointer and signals.
- `research/01-student-profile.md` through `research/03-offer-pack.md`, module outputs.
- `research/02-niche-research/{niche-slug}/`, Apify dumps and synthesis per niche.
- `research/lessons/`, post-run learning capture.
- `research/output/website-factory-brief.md` and `content-engine-brief.md`, handoff artifacts.

Factory and engine subfolders are touched by their respective tailor and deploy agents only.

## Default behavior when the student greets you

If the student says hello, opens a fresh session, or runs `/start`:

1. Read `stack-state.json`.
2. Identify the first false gate.
3. Tell them, briefly: where they are in the flow, what command to run next, and what that command will do.
4. Wait for them to run it.

Never start a module without an explicit slash command.
