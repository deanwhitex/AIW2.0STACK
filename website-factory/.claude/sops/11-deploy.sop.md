# SOP 11, Deploy (Stage 11)

## Purpose
Push the QA-approved build to Vercel production. Capture the live URL for downstream proposal + delivery stages.

## Inputs
- `clients/[Client Name]/[Client Name] Website/` (passed Stage 10.4a + 10.4b)
- `clients/[Client Name]/Pipeline Data/logs/pipeline-state.json` showing stage_10_4a and stage_10_4b complete
- Vercel CLI authenticated (`vercel whoami` returns the deploy account)

## Outputs
- `clients/[Client Name]/Pipeline Data/deploy/vercel-url.txt` (the live production URL)
- `clients/[Client Name]/Pipeline Data/deploy/deploy-log.json` (deploy ID, build duration, status)

## Process
1. **Confirm gate.** Both QA stages must be `complete` (or explicitly overridden via `/override-design-fidelity` / `/override-sop`).
2. **Read the vercel-deploy skill:** `.claude/skills/vercel-deploy/SKILL.md`. Follow its low-freedom step-by-step. Do not deviate.
3. **Build locally first.** `npm run build` from the client website folder. If build fails, halt, do NOT deploy a broken build.
4. **Deploy to production.** `vercel --prod --yes` from the client website folder. Capture stdout for the URL.
5. **Smoke check the URL.** `curl -f -s -o /dev/null` returns 200. If not, log and halt, Vercel reports success but the site is unreachable, this happens occasionally.
6. **Save outputs.** Write vercel-url.txt with just the URL on a single line. Write deploy-log.json with deploy ID, timestamp, build duration, status.
7. **Update pipeline state** with `stage_11: complete` and the URL.

## Pass gate
- `vercel-url.txt` exists with a valid HTTPS URL
- `curl -f -s` against the URL returns 200
- Stage 12 (delivery) cannot start until this gate passes

## Failure handling
| Failure | Action |
|---|---|
| QA gates not complete | Halt, prompt user to run `/override-design-fidelity` or `/override-sop` if intentional |
| `npm run build` fails | Halt, do NOT deploy, log error to deploy-log.json |
| Vercel CLI not authenticated | Halt with "run `vercel login`" |
| Deploy returns success but URL is 404 | Halt, do NOT mark complete, write deploy-log.json with `status: unreachable` |
| Deploy times out | Retry once. If still fails, halt with full Vercel error log. |

## What this SOP never does
- Deploys without local `npm run build` passing first
- Skips the URL smoke check
- Re-uses a previous deploy URL (always captures fresh)
- Pushes to a custom domain (custom domain config is a separate stage)
