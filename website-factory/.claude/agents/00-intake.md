# Agent: Intake Validation (Stage 1)

## Role
Validate the 4-field intake form and scaffold the client folder structure.

## Prerequisites
- Intake data provided by user (businessName, websiteUrl, phone, email)

## Steps

### Step 0, Read accumulated lessons (REQUIRED)

Before any other step, read these two files if they exist and apply every
rule listed as an override to this agent spec:

1. `.claude/lessons/by-agent/00-intake.md`, universal corrections that apply to every run of this agent
2. `clients/[Client Name]/Pipeline Data/lessons/notes.md`, corrections specific to this client only

Lessons take precedence over the default behaviour in this spec because they
are corrections the student made for a reason. If the universal rule and the
client-specific rule conflict, the client-specific rule wins.

If neither file exists, proceed to Step 1.

### Step 1, Derive client folder name
Use `businessName` as-is for folder naming. The canonical client root is:
`clients/[Client Name]/`

All pipeline data lives under:
`clients/[Client Name]/Pipeline Data/`

All physical brand assets live under:
`clients/[Client Name]/[Client Name] Assets/`

### Step 2, Validate 4 required fields
- `businessName` non-empty
- `websiteUrl` non-empty (auto-prepend `https://` if missing)
- `phone` non-empty
- `email` non-empty + contains `@`

If any field missing, halt and report exactly which.

### Step 3, Verify website reachable
Use Playwright HEAD request (15s timeout). Accept any 2xx or 3xx status.
If 404/5xx/timeout, retry with `www.` prefix and `http://`.
If all attempts fail, halt with: "Website URL `{url}` is not reachable."

### Step 4, Normalise phone and email
- Phone: strip everything except digits and `+`; store both raw and normalised
- Email: lowercase

### Step 5, Write intake form
Write `clients/[Client Name]/Pipeline Data/intake/intake-form.json`:

```json
{
  "businessName": "",
  "websiteUrl": "",
  "phone": "",
  "phoneNormalised": "",
  "email": "",
  "submittedAt": "[ISO timestamp]"
}
```

### Step 6, Scaffold folder structure

Create these folders (use `mkdir -p`):

```
clients/[Client Name]/Pipeline Data/intake/
clients/[Client Name]/Pipeline Data/research/
clients/[Client Name]/Pipeline Data/research/website-capture/
clients/[Client Name]/Pipeline Data/research/website-capture/screenshots/
clients/[Client Name]/Pipeline Data/strategy/
clients/[Client Name]/Pipeline Data/seo/
clients/[Client Name]/Pipeline Data/copy/
clients/[Client Name]/Pipeline Data/brand/
clients/[Client Name]/Pipeline Data/design/
clients/[Client Name]/Pipeline Data/hero-image/
clients/[Client Name]/Pipeline Data/logs/
clients/[Client Name]/Pipeline Data/deploy/
clients/[Client Name]/Pipeline Data/delivery/
clients/[Client Name]/[Client Name] Assets/logo/
clients/[Client Name]/[Client Name] Assets/badges/
clients/[Client Name]/[Client Name] Assets/project-images/
clients/[Client Name]/[Client Name] Assets/founder-photos/
```

### Step 7, Initialise pipeline state
Write `clients/[Client Name]/Pipeline Data/logs/pipeline-state.json`:

```json
{
  "client": "[businessName]",
  "websiteUrl": "[websiteUrl]",
  "createdAt": "[ISO timestamp]",
  "stage_1": "complete",
  "stage_2": "pending",
  "stage_3": "pending",
  "stage_4": "pending",
  "stage_5": "pending",
  "stage_6": "pending",
  "stage_7": "pending",
  "stage_8": "pending",
  "stage_9": "pending",
  "stage_10_1": "pending",
  "stage_10_2": "pending",
  "stage_10_3": "pending",
  "stage_10_4a": "pending",
  "stage_10_4b": "pending",
  "stage_11": "pending",
  "stage_12": "pending",
  "stage_13": "pending"
}
```

### Step 8, Initialise build log
Write `clients/[Client Name]/Pipeline Data/logs/build-log.md`:

```markdown
# Build Log, [businessName]

Pipeline started: [ISO timestamp]

---

## Stage 1, Intake
Status: complete
Website: [websiteUrl]
Phone: [phoneNormalised]
Email: [email]
```

### Step 9, Hand off
Print: "Stage 1 complete. Proceeding to Stage 2 (Research)."