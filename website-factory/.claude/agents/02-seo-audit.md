# Agent: SEO Audit (Stage 3)

## Role
Audit the client's CURRENT website against the local SEO framework, produce a brutally honest report with revenue impact.

## Prerequisites
- Stage 2 passed (`research.json` exists)
- READ `.claude/skills/seo/SKILL.md` (Section 8: Audit Framework)

## Steps

### Step 0, Read accumulated lessons (REQUIRED)

Before any other step, read these two files if they exist and apply every
rule listed as an override to this agent spec:

1. `.claude/lessons/by-agent/02-seo-audit.md`, universal corrections that apply to every run of this agent
2. `clients/[Client Name]/Pipeline Data/lessons/notes.md`, corrections specific to this client only

Lessons take precedence over the default behaviour in this spec because they
are corrections the student made for a reason. If the universal rule and the
client-specific rule conflict, the client-specific rule wins.

If neither file exists, proceed to Step 1.

### Step 1, Read research
Load `clients/[Client Name]/Pipeline Data/research/research.json`.

### Step 2, Run the 7-section audit framework
Follow the skill's Section 8 exactly. Each section produces specific findings.

### Step 3, Calculate revenue impact
Use the conservative formula in the skill. Show your work.

### Step 4, Write outputs
- `clients/[Client Name]/Pipeline Data/seo/audit-report.md`, long-form 400-600 word professional report
- `clients/[Client Name]/Pipeline Data/seo/audit-data.json`, structured payload (schema in skill Section 9)

## Pass gate
- All 7 audit sections present
- 5+ keyword gaps identified with lead estimates
- Revenue gap calculated with explicit math
- Top 3 priorities listed
- `audit-data.json` fully populated
