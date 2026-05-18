# `clients/_agency/` — YOUR agency's brand data

This folder holds **your** agency's branding data. It's not a client folder —
it's the student-owned profile that the website factory's proposal builder
(Stage 13) merges into every client proposal so the closing artifact you send
prospects represents your agency, not the factory's defaults.

Every per-agency placeholder in
`website-factory/templates/proposal/proposal-template.html` (anything matching
`{{AGENCY_*}}`) gets filled from this folder at build time.

## Contents

```
clients/_agency/
├── README.md                       this file
├── agency-brand.example.json       sample shape, never edit, never used at build
├── agency-brand.json               YOUR populated brand profile (gitignored)
└── assets/                         YOUR brand assets (gitignored)
    ├── founder-portrait.{jpg,png}  square, ≥800x800
    ├── agency-logo.svg             your wordmark/disc, transparent bg
    ├── guarantee-seal.png          your money-back / guarantee badge
    ├── proof-video.mp4             your flagship proof video (optional, can be a URL instead)
    ├── case-studies/               your video testimonials, .mp4
    │   ├── 1.mp4
    │   ├── 2.mp4
    │   └── ...
    ├── client-builds/              screenshots of websites you've built
    │   ├── 1.webp
    │   ├── 2.webp
    │   └── ...
    └── review-avatars/             profile photos for written reviews
        ├── 1.webp
        ├── 2.webp
        └── ...
```

## How to populate

Two paths:

### A) Guided (recommended for first-time setup)

```
/setup-agency
```

The agency-setup agent walks you through every field, shows you what each
will be used for in the proposal, captures your data, and writes
`agency-brand.json`. Run once. The proposal builder reads it on every client
build forever after.

### B) Manual

1. Copy `agency-brand.example.json` to `agency-brand.json`
2. Fill every `__REQUIRED__*__` sentinel with your real value
3. Drop your assets into `assets/` matching the filename patterns in the JSON
4. Validate: `python3 website-factory/tools/build-proposal.py --validate-agency`

## What ships in your client's proposal

Once `agency-brand.json` is populated, every client proposal Stage 13
generates will include:

- **Section 1 (Founder Intro)**: your name, your portrait, your value-prop
  bullets, your promise statement, your signature block
- **Review carousel**: testimonials you've collected from past clients,
  formatted as 5-star review cards
- **Client-build carousel**: live URLs + screenshots of websites you've built,
  paired with quote from the owner
- **Case-study video grid**: short video testimonials from past clients
- **Proof video** (Section §4): your flagship "this is what we deliver" video
  embedded with your proof stat
- **Winning Formula** (Section §3): the three levers you actually pull when
  you ship a website for a client
- **AI Infrastructure stack** (Section §11): the lead-handling stack you set up
- **Guarantee + money-back seal**: your specific guarantee language + badge
- **SOP password gate**: the password you give clients to open the technical
  SOP PDF mid-proposal

## Why this is separate from per-client data

The agency profile changes rarely (when you collect new testimonials, ship
new builds, refine your value prop). The client profile changes per lead.
Keeping them separate means:

- One `/setup-agency` run fills the agency side once
- Every `/run-factory` for a new client only needs per-client data (intake,
  research, brand DNA, copy)
- Adding a new testimonial later? Just edit `agency-brand.json` and rebuild
  any proposal

## Privacy

Both `agency-brand.json` and `assets/` are **gitignored** by default. They
contain your specific business data, real testimonials with named reviewers,
real client URLs. They live on your local disk and in your own Vercel/local
deploy of the proposal artifact. The repo only ships the schema and example.

If you fork this repo to your own private GitHub for backup, those files
will travel with you. If you keep working from the public clone, they stay
on your machine only.

## When the proposal builder runs

```
/run-factory  → ... → Stage 13 (proposal) → build-proposal.py
```

Stage 13 reads:
1. `clients/[Client Name]/Pipeline Data/...` (per-client data)
2. `clients/_agency/agency-brand.json` (your agency data)
3. `clients/_agency/assets/` (your assets, copied into the proposal artifact)
4. `website-factory/templates/proposal/proposal-template.html` (the shell)

Output:
```
clients/[Client Name]/[Client Name] Proposal/
├── proposal.html
├── agency-assets/
│   ├── founder-portrait.jpg          [copied from clients/_agency/assets/]
│   ├── agency-logo.svg
│   ├── case-studies/...
│   └── client-builds/...
└── build/                            [per-client website preview]
```

Deploy that folder to Vercel and send the URL to your prospect. They see a
proposal that's 100% your agency, with the prospect's own brand woven through.

## Required vs optional fields

See `agency-brand.example.json` for the full schema with comments. Minimum
required to render a working proposal:

- `name`, `founder.name`, `founder.first_name`, `founder.title`
- `intro.value_props[1..3]` (three bullets)
- `intro.promise`
- `reviews[]` with at least 3 entries
- `proof.video_url` OR `proof.video_path`
- `sop_password`

Optional but strongly recommended:

- Client-build carousel (3+ entries)
- Case-study videos (1+ entries)
- Guarantee seal asset
- Founder portrait at 800x800+

Without the optional content, the proposal still builds but specific
sections render with placeholder copy or are skipped entirely (the JSON
controls which sections appear).
