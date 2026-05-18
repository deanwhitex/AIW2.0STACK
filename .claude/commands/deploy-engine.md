---
description: Deploy the content engine to Vercel via CLI. Wire Supabase migrations and env vars.
---

Gate: `m7.engineBriefLocked` must be true. `credentials.supabase`, `credentials.vercel`, `credentials.anthropic` must all be true.

Invoke the `11-engine-deployer` agent at `.claude/agents/11-engine-deployer.md`.

Steps the agent runs:
1. Verify env vars.
2. Confirm Supabase project (existing or new).
3. Apply Supabase migrations.
4. Write `content-engine/.env.local`.
5. Push to a fresh GitHub repo named `aiw-engine-{slug}`.
6. Run `vercel --prod` from `content-engine/`.
7. Add env vars in Vercel dashboard, redeploy.
8. Record URL to `deployments/engine/vercel-url.txt`.
9. Smoke test the live URL.

Lock with `engine.deployed=true`.
