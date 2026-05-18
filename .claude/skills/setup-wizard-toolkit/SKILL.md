---
name: setup-wizard-toolkit
description: Use during /setup to test each credential before moving on. Connectivity helpers for Anthropic, Apify, Supabase, Vercel, GitHub, and AssemblyAI.
---

# Setup Wizard Toolkit

A bag of one-liner tests. Each returns clean pass/fail.

## Anthropic

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -X POST https://api.anthropic.com/v1/messages \
  -H "x-api-key: ${ANTHROPIC_API_KEY}" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-haiku-4-5-20251001","max_tokens":1,"messages":[{"role":"user","content":"hi"}]}'
```

Expect 200. 401 means bad key. 429 means rate limited (rare during setup).

## Apify

```bash
curl -s "https://api.apify.com/v2/users/me?token=${APIFY_TOKEN}" | jq -r '.data.username // "FAIL"'
```

Expect a non-empty username. "FAIL" means bad token.

## Supabase

```bash
curl -s -o /dev/null -w "%{http_code}" \
  "${SUPABASE_URL}/rest/v1/?apikey=${SUPABASE_ANON_KEY}"
```

Expect 200. 401 means bad anon key. Connection error means bad URL.

Also test service role separately:
```bash
curl -s -o /dev/null -w "%{http_code}" \
  "${SUPABASE_URL}/rest/v1/?apikey=${SUPABASE_SERVICE_ROLE_KEY}"
```

Expect 200.

## Vercel

```bash
vercel whoami
```

Expect the student's email or team name. "Error: not authenticated" means they need to run `vercel login` again.

## GitHub

```bash
gh auth status
```

Expect "Logged in to github.com as {username}". If missing, run `gh auth login`.

## AssemblyAI (optional)

```bash
curl -s -o /dev/null -w "%{http_code}" \
  -H "authorization: ${ASSEMBLYAI_API_KEY}" \
  https://api.assemblyai.com/v2/transcript
```

Expect not-401 (any other code means key works). 401 means bad key.

## Writing keys to .env.local

Use this idempotent pattern. Don't append duplicate lines:

```bash
update_env() {
  local key="$1"
  local value="$2"
  local file=".env.local"
  if [ ! -f "$file" ]; then touch "$file"; fi
  if grep -q "^${key}=" "$file"; then
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$file" && rm -f "${file}.bak"
  else
    echo "${key}=${value}" >> "$file"
  fi
}
```

## Updating stack-state credentials

After each successful test, update `stack-state.json.credentials.{service}=true` using a jq-based update:

```bash
jq '.credentials.anthropic = true' stack-state.json > /tmp/state.json && mv /tmp/state.json stack-state.json
```

## When everything passes

Set `setup.complete=true`. Append a history entry. Tell the student to run `/discovery`.

## When something fails

Halt at the failing service. Tell the student exactly what failed and what the error means. Do not advance.

Common debug paths:
- Anthropic 401 → check the key format starts with `sk-ant-`.
- Apify FAIL → check the token from Settings → Integrations, not the API token from a specific actor.
- Supabase 401 → confirm they copied the anon key, not the service role key (different lengths).
- Vercel auth → run `vercel logout` then `vercel login`.
