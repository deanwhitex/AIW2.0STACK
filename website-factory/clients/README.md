# clients/

Per-client output of the website factory pipeline. Created by Stage 1 (intake) for each new client.

## Per-client structure

```
clients/[Client Name]/
├── [Client Name] Assets/         # Stage 4 asset harvest
│   ├── badges/
│   ├── founder-photos/
│   ├── logo/
│   └── project-images/
│
├── Pipeline Data/                # All stage outputs
│   ├── intake/                   # Stage 1
│   │   └── intake-form.json
│   ├── research/                 # Stage 2
│   │   ├── research.json
│   │   ├── raw-google.json       # gitignored (regenerable)
│   │   ├── raw-facebook.json     # gitignored
│   │   ├── raw-websites.json     # gitignored
│   │   ├── raw-instagram.json    # gitignored
│   │   ├── raw-reddit.json       # gitignored
│   │   ├── apify-cache/          # gitignored
│   │   ├── apify-cost.json
│   │   └── .apify-logs/          # gitignored
│   ├── strategy/                 # Stage 3
│   │   ├── strategy.json
│   │   └── sitemap.json
│   ├── seo/                      # Stage 5
│   │   └── audit-data.json
│   ├── copy/                     # Stage 6
│   │   ├── copy-deck.md
│   │   └── social-resonance.json # SOP 15
│   ├── brand/                    # Stage 7
│   │   ├── brand-dna.json
│   │   └── extraction-report.md
│   ├── hero-image/               # Stage 9
│   │   ├── hero-final.png
│   │   ├── hero-prompt.md
│   │   └── hero-metadata.json
│   ├── build-cache/              # gitignored (regenerable)
│   │   ├── sections.json
│   │   └── changed-sections.txt
│   ├── deploy/                   # Stage 11
│   │   ├── vercel-url.txt
│   │   └── deploy-log.json
│   ├── delivery/                 # Stage 12
│   │   ├── delivery-report.md
│   │   └── delivery-checklist.md
│   └── logs/
│       ├── pipeline-state.json
│       ├── build-log.md
│       └── lcp-report.json
│
├── [Client Name] Proposal/       # Stage 13, separate folder, can deploy independently
│   └── proposal.html
│
└── [Client Name] Website/        # Stage 10.1 build output
    ├── index.html
    ├── package.json
    ├── vite.config.ts
    ├── tsconfig.json
    ├── tailwind.config.ts
    ├── postcss.config.js
    ├── public/                   # hero-final.png, badges, logo, etc.
    ├── node_modules/             # gitignored
    ├── dist/                     # gitignored
    ├── qa-screenshots/           # gitignored
    └── src/
        ├── App.tsx
        ├── main.tsx
        ├── pages/
        ├── sections/             # 14 canonical, copied from .claude/components/sections/
        ├── components/           # primitives, copied from .claude/components/
        ├── data/
        │   ├── brand-dna.ts      # typed export of brand-dna.json
        │   └── site-data.ts      # parsed from copy-deck.md
        └── styles/
            ├── tokens.css
            └── brand-override.css
```

## Notes

- This folder must exist before /build-all can run.
- Client names with spaces are kept as-is (e.g. "Acme Construction LLC").
- Some client website folders may have their own nested `.git/` pointing to a separate GitHub repo. Handle with care when deleting.
- Apify cache, build cache, raw scrape outputs, node_modules, dist, and QA screenshots are gitignored to keep the repo lean.
