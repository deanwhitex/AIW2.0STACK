---
description: Walk through every credential the stack needs and test each one.
---

Invoke the `01-setup-wizard` agent at `.claude/agents/01-setup-wizard.md`. Follow its steps in order: Anthropic, Apify, Supabase, Vercel, GitHub (required), then AssemblyAI and Gemini (optional).

Write keys to `.env.local`. Update `stack-state.json.credentials`. Set `setup.complete=true` only when all five required services pass connectivity tests.
