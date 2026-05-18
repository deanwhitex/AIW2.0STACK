---
description: Hand off into the website factory's own 13-stage pipeline.
---

Gates: `m2d.templateBuilt` AND `factory.generated` must BOTH be true.

If either is false, halt and tell the student to run
`/build-niche-template`. There is no shared baseline; Stage 10.1 cannot
build a client until Module 2D has generated the full per-niche factory
at `website-factory/templates/{niche-slug}/`.

Soft check: `agency.brandLocked` should be true. If it is false, warn
the student that Stage 13 (proposal builder) will halt mid-pipeline
because `website-factory/clients/_agency/agency-brand.json` is missing
its required values. Recommend they run `/setup-agency` first, but let
them proceed if they confirm they want to (some students prefer to ship
the site build first and add the proposal layer later).

Steps:

1. Ask the student for client-specific intake data:
   - Business name
   - Website URL (current site, or "none")
   - Phone
   - Email
   - Address
   - Primary city
   - State
   - Owner name
   - (optional) Special offers, financing, notes

2. Tell the student: "I'll drop you into the factory. It runs 13 stages and takes 1 to 3 hours depending on Apify scrapes and image generation. There's one approval gate at Stage 7 (brand-dna confidence) and another optional approval at brand resonance. Approve them when prompted. Ready?"

3. Wait for confirmation.

4. Switch into the factory:
```bash
cd website-factory
```

5. Create the client folder structure:
```bash
mkdir -p "clients/{Client Name}/Pipeline Data/intake"
```

6. Write the intake JSON to `clients/{Client Name}/Pipeline Data/intake/intake.json` with the fields gathered in Step 1.

7. Invoke the factory's master command:
```
/build-all
```

8. The factory's own CLAUDE.md and agents take over. Approve gates as they come up. Wait for completion.

9. On completion, capture outputs:
```bash
cat "clients/{Client Name}/Pipeline Data/deploy/vercel-url.txt"
```

Copy to `../deployments/factory/{client-slug}-vercel-url.txt` and `../deployments/factory/vercel-url.txt` (latest).

10. Append a run entry to `../stack-state.json.factoryRuns`:
```
{
  "runNumber": NN,
  "client": "{Client Name}",
  "deployUrl": "{url}",
  "deployedAt": "ISO",
  "templateVersion": "{git sha of factory at run time}"
}
```

11. Set `factory.deployed=true`. Switch back to stack root.

12. Tell the student: "Run complete. Live at {url}. Proposal at {proposal url}. Next: `/factory-feedback` to capture lessons, or continue to `/load-engine-structure` for the content engine."
