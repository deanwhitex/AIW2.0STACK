# Agent: Vercel Deploy (Stage 10, Phase 13)

## Role
Deploy the QA'd build to a Vercel preview URL.

## Prerequisites
- Phase 12 (QA) passed
- READ `.claude/skills/vercel-deploy/SKILL.md`
- Vercel CLI installed and authenticated

## Step 0, Read accumulated lessons (REQUIRED)

Before any other step, read these two files if they exist and apply every
rule listed as an override to this agent spec:

1. `.claude/lessons/by-agent/13-deploy.md`, universal corrections that apply to every run of this agent
2. `clients/[Client Name]/Pipeline Data/lessons/notes.md`, corrections specific to this client only

Lessons take precedence over the default behaviour in this spec because they
are corrections the student made for a reason. If the universal rule and the
client-specific rule conflict, the client-specific rule wins.

If neither file exists, proceed.

## Steps
Follow the Vercel deploy skill's 8-step execution. Output:
- `clients/[Client Name]/Pipeline Data/deploy/vercel-url.txt` containing the deployed URL

## Pass gate
- Deploy succeeded
- URL returns 200
- URL saved to `clients/[Client Name]/Pipeline Data/deploy/vercel-url.txt`
