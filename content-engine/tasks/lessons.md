# Lessons, Patterns From This Project

The self-improving loop. Every time the user corrects something, I add a rule here. Reviewed at session start.

---

## Lesson 01, Use the operator's actual name, not a placeholder from docs

**Pattern:** Earlier I referred to the operator by a placeholder name from project docs (the PRD had a fictitious name listed, which is the source of the slip).

**Rule:** Always use the operator's actual name. Placeholder names in docs are documentation artifacts, not the person you're working with.

---

## Lesson 02, Do not impose timelines the operator did not ask for

**Pattern:** I anchored on the PRD's "7-day mastermind deadline" and built my plan around that. The operator responded that the timeline in the doc was no longer live.

**Rule:** Ask about pace, do not assume it from documents. The operator sets the timeline, not the PRD. If a timeline is in a doc, confirm it is still live before planning around it.

---

## Lesson 03, "Lean and effective" does not mean cutting features

**Pattern:** I proposed cutting the voice rewrite pass, IG Graph API, weekly email, and TikTok ingestion to fit a tight timeline. The operator responded with "no cutting anything."

**Rule:** When the operator says "efficient, lean, effective" they mean clean execution and no waste, not reduced scope. Default to building the full thing well, not a stripped-down version fast.

---

## Lesson 04, Reference repos are read-only context

**Pattern:** I cloned a reference repo into the project folder for context. Clarified: "do not touch the existing repo, i only gave it for context."

**Rule:** Any reference clone is read-only context. Build the new app in `/AIW CONTENT ENGINE/`. Lift code patterns and components from the reference, but the new project has zero coupling to it.

---

## Lesson 05, Plan first, present, wait for approval, then execute

**Pattern:** From the operator's global CLAUDE.md and reinforced repeatedly. The operator stops the build if I start working before the plan has been reviewed.

**Rule:** Every non-trivial step gets a plan written down (todo.md or in-message), presented, and explicitly approved before execution. The cost of pausing is low. The cost of building the wrong thing is high.

---

## Lesson 06, No em-dashes, no emojis, no jargon

**Pattern:** From the operator's global CLAUDE.md. Hard rule, no exceptions.

**Rule:** Banned forever in any output: em-dashes, emojis, "leverage", "synergize", "robust", "seamless", "game-changer", "cutting-edge", "optimize". Banned in commit messages, code comments, READMEs, UI copy, everything.

---

## Lesson 07, Stack consolidation: Anthropic + Apify + AssemblyAI + Supabase

**Pattern:** I proposed a 6-service stack. The operator pushed back hard. After two rounds: cut OpenAI (replaced by Postgres full-text + single Claude call), cut Resend (in-dashboard digest), keep AssemblyAI but narrow it to one job (reel transcription only).

**Why:** Every additional service is friction for the student during setup. But cutting too far hurts product quality, reel transcripts genuinely matter for the inspiration data and the Radar.

**How to apply:** Default to one provider per role. Use Claude for everything LLM (generation, summarisation, voice match, tagging, single call where possible, no second-pass rewrite). Drop OpenAI embeddings in favour of Postgres full-text search with Claude-generated summaries and keyword tags. Drop Resend by putting the digest in-dashboard. Keep AssemblyAI but only for Instagram and TikTok reel transcription, not for voice capture (which is text-paste only). Only add a new service when the quality gap is clearly worth the friction.

---

## Lesson 12, Never run `npm audit fix --force`

**Pattern:** The operator ran `npm audit fix --force` to silence vulnerability warnings. npm rewrote `package.json` to install Next.js 9.3.3 (a 7-year-old release) because that was the easiest way to remove the transitive vulnerable deps. Everything broke.

**Why:** `--force` lets npm make breaking changes including major version downgrades to satisfy audit constraints. Most "vulnerabilities" listed by `npm audit` are in dev tooling or deep transitive deps that never reach production. A blunt `--force` is almost always worse than the alleged problem.

**How to apply:** If `npm audit` flags something, run plain `npm audit` to read the list. Identify if any flagged package is in production runtime code. Upgrade that specific package by name (`npm install foo@latest`) rather than letting npm rewrite the whole tree. Banned forever from this project: `npm audit fix --force` and any flag that says "force" on a package manager.

---

## Lesson 11, Disable Supabase email confirmation for single-tenant deploys

**Pattern:** First signup got stuck on "check your email to confirm." Default Supabase Auth requires email confirmation before sign-in is allowed.

**Why:** Single-tenant model: each student is the only user of their own deployment. Email confirmation adds zero security and creates onboarding friction. They already proved identity by provisioning Vercel and Supabase projects under their name.

**How to apply:** Add to the student setup guide: `Authentication → Providers → Email → toggle "Confirm email" OFF`. Existing unconfirmed users need to be deleted manually from `Authentication → Users` before retry. Pre-deployment script could disable this via Supabase Management API when we automate further.

---

## Lesson 10, Postgres generated columns reject `to_tsvector`

**Pattern:** Tried to put `setweight(to_tsvector('english', ...), 'A') || ...` inside a `generated always as (...) stored` column on `context_items`. Postgres rejected with `ERROR: 42P17: generation expression is not immutable`.

**Why:** `to_tsvector(regconfig, text)` is classified as STABLE not IMMUTABLE because the text-search configuration could in theory be redefined. Generated columns require strict immutability.

**How to apply:** For full-text search, use a regular `tsvector` column + a `BEFORE INSERT OR UPDATE` trigger that sets it from the source columns. Same end result, immutable enough for Postgres. Same pattern applies to any function classified STABLE/VOLATILE that we want to derive from.

---

## Lesson 09, Next.js 16 proxy convention requires both file and function rename

**Pattern:** Renamed `middleware.ts` → `proxy.ts` to silence the Next 16 deprecation warning. Forgot to also rename the exported function. Got a 500 error: "Proxy is missing expected function export name."

**Why:** Next.js 16 looks specifically for an export named `proxy` (or default). The old `middleware` export name no longer matches.

**How to apply:** When migrating Next.js conventions, treat the file rename and the export rename as one atomic change. Same rule applies if we ever rename other framework-recognised files.

---

## Lesson 08, Build before requiring paid API keys

**Pattern:** The operator asked if the whole product could be built before he loads any paid API keys, with a one-time setup wizard at the end.

**Why:** Lets us build and validate the full UI without spending a cent on AI calls. Also forces the setup wizard to be a real product feature, since every student goes through it.

**How to apply:** Every API route that calls a paid service checks for the key. If missing, return a realistic mock response. The setup wizard is built as a permanent feature, not a temporary scaffold. Supabase is still set up early (it's free and is the database), but Anthropic and Apify keys are entered via the in-app setup wizard at the end.
