# SOP 08, Hero Image (Stage 9)

## Purpose

Generate the single 1500×700 photorealistic hero image per the niche's composition rules,
brand-dna palette, and mood lighting. Direct Gemini Image API (Nano Banana 2), not MCP.

## Niche customisation

The composition is **not hardcoded in this SOP**. It comes from the niche playbook:

- `templates/{active-niche-slug}/niche-playbook/hero-composition.md`, the prompt
  fragment that defines subject placement, foreground/midground/background, whether
  people are in the frame, what objects (vehicle, product, room, scenic element) anchor
  the composition
- `templates/{active-niche-slug}/niche-playbook/hero-mood-mapping.json`, `brand-dna.hero.mood`
  → lighting brief table

If either file is missing, the agent halts with a Module-2D pointer.

## Inputs

Required:
- `.env` with `GEMINI_API_KEY`
- `clients/[Client Name]/Pipeline Data/brand/brand-dna.json`
- `clients/[Client Name]/[Client Name] Assets/logo/logo.{png,svg,jpg}`
- `templates/{active-niche}/niche-playbook/hero-composition.md`
- `templates/{active-niche}/niche-playbook/hero-mood-mapping.json`

Optional (used when present):
- `clients/[Client Name]/Pipeline Data/research/research.json`, services/offerings, service area
- `clients/[Client Name]/Pipeline Data/intake/intake.json`, company name, city, state
- People / subject reference photos at the path the niche playbook prescribes

## Outputs

- `clients/[Client Name]/Pipeline Data/hero-image/hero-final.png` (1500×700 target)
- `clients/[Client Name]/Pipeline Data/hero-image/hero-prompt.md` (filled prompt for audit)
- `clients/[Client Name]/Pipeline Data/hero-image/hero-metadata.json` (logo used, subject used,
  mood, region, model, size)

## Process
1. **Asset gate.** Logo must exist. Subject photo optional unless the niche playbook
   marks it required.
2. **Niche playbook gate.** Confirm `hero-composition.md` and `hero-mood-mapping.json`
   exist. Halt with Module-2D pointer if missing.
3. **Run executor:**
   ```bash
   python3 tools/generate-hero.py --client "[Client Name]"
   ```
   Add `--no-owner` to force subject-less composition.
4. **Validate.** Script checks dimensions, file size, not-solid-colour. Retries x3 with
   exponential backoff on API errors.
5. **Update pipeline state** with `stage_9: complete` (or `stage_9: needs_regeneration`
   if `REGENERATION-NEEDED.md` present).

## Universal composition rules (apply regardless of niche)

These hold for every niche. The niche playbook may add but never override.

- Photorealistic (no illustration, no painterly filter)
- LEFT 40% of frame stays relatively unobstructed (text overlay zone)
- Logo used as multimodal reference, never re-coloured or re-styled in the output
- No watermarks, no overlaid text not part of the source photography
- Output dimensions ≥ 1000×500 (Gemini variance allowed from the 1500×700 target)
- Non-zero bytes, not solid colour

## Niche composition rules

Loaded from `niche-playbook/hero-composition.md`. The niche playbook defines: subject
placement and scale, foreground/midground/background composition, whether people are in
the frame, what brand-coupled objects anchor the composition, mood lighting baseline.

## Pass gate
- `hero-final.png` exists, ≥ 1000×500, non-zero bytes, not solid colour
- `hero-prompt.md` and `hero-metadata.json` saved
- OR `REGENERATION-NEEDED.md` present and `stage_9: needs_regeneration` recorded
  (pipeline can continue with placeholder)

## Failure handling
| Failure | Action |
|---|---|
| Logo missing | Halt with `MANUAL-DROP-NEEDED.md` |
| Niche playbook files missing | Halt with Module-2D pointer |
| Gemini API error | Retry x3 with exponential backoff (2s, 4s, 8s) |
| Validation fails (corrupt, undersized, solid colour) | Retry generation x3 |
| All retries exhausted | Write `REGENERATION-NEEDED.md` with error + filled prompt; pipeline can continue |
