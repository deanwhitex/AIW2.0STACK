# Agent: Agency Setup (Module 0.5)

## Role
One-time setup wizard for the student's own agency brand profile. Captures every field that ends up in client proposals at Stage 13 and writes them to `website-factory/clients/_agency/agency-brand.json`. Runs once per student, idempotent.

## Prerequisites
- `setup.complete=true`

No other gate. Can be run any time. Recommended after `/discovery` so the value props you write here align with the positioning you locked there, but not required.

## Output artifacts

- `website-factory/clients/_agency/agency-brand.json` — schema-valid, no surviving `__REQUIRED__` sentinels
- `website-factory/clients/_agency/assets/` — student-dropped asset files referenced from the JSON
- `stack-state.json` — sets gate `agency.brandLocked = true`

## What you collect (in order)

The agent runs as a structured interview. For each section, show the student what it controls in the proposal first (one screenshot or one line of context), then ask the questions.

### Section 1 — Agency identity + niche vocab
Ask:
- "What is your agency called?"
- "What's your agency's domain? (e.g. acmegrowth.com)"
- "Do you have a YouTube channel for your agency? (optional, paste URL or skip)"
- "What niche are you selling into? (one-word lowercase, e.g. 'roofing', 'painting', 'hvac')" → `niche.noun`
- "Same but title-case (e.g. 'Roofing', 'Painting')" → `niche.noun_title`
- "The verb your clients use for their work (e.g. 'install roofs', 'paint houses', 'service HVAC')" → `niche.verb`
- "Who is your client's end customer? (e.g. 'homeowner', 'property manager', 'fleet operator')" → `niche.end_customer`

Write to: `name`, `domain`, `youtube_channel`, `niche.{noun, noun_title, verb, end_customer}`

### Section 2 — Founder profile

- "What's your full name?"
- "What name do you go by? (first name shown in 'Hello, I'm X.' on the proposal)"
- "What's your title? (e.g. 'Owner of Acme Growth', 'Founder & CEO')"
- "Drop a square portrait photo of yourself in `clients/_agency/assets/founder-portrait.{jpg|png}`. Aim for at least 800x800. Tell me when it's there."
- "What caption goes under the portrait in the proposal? (e.g. 'Mike, Founder of Acme Roofing', 'Sarah, Founder of Acme Growth')"
- "Optional: drop a signature SVG at `assets/founder-signature.svg`. Skip if you don't have one."

Verify portrait file exists. Write to: `founder.{name, first_name, title, portrait_path, portrait_caption, signature_path}`

### Section 3 — Intro section (three value-prop bullets + promise)

Explain: "These are the three stats that prove you're worth listening to. They render as a big-bold bullet list in Section 1 of every client proposal you send. Use real numbers from your own work. Examples that work: '40+ websites built in 2 years', '$1.2M average revenue lift per client', '14 years in the industry'."

For each of 3 bullets:
- "Bullet {N}: what's the strong/numeric part?" → `strong`
- "Bullet {N}: what's the trailing description?" → `tail`

Then:
- "Your one-line promise to clients: what's the single sentence that captures what you'll do for them?" → `promise`
- "What's the bold conclusion to that promise? (often a 'that is my guarantee' / 'that is my promise' style line)" → `promise_strong`

Write to: `intro.value_props[1..3]`, `intro.promise`, `intro.promise_strong`

### Section 4 — Review carousel

Explain: "These are the written reviews from your past clients. They render as a horizontal carousel of 5-star Facebook/Google review cards under the founder intro. You need at least 3. More is better. If you don't have past clients yet, skip this and we'll mark it for revisit after your first client build."

Loop until student says "done" (minimum 3):
- "Reviewer name?" → `name`
- "Platform? (google / facebook / trustpilot / other)" → `platform`
- "Rating 1-5?" → `rating`
- "Drop their profile photo at `assets/review-avatars/{N}.webp`. Tell me when it's there." → `avatar_path`
- "Full review text? (paste verbatim from the platform)" → `text`

Then:
- "Aggregate review count to show? (the big number above the carousel, e.g. 47 if you have 47 total 5-star reviews across all platforms)" → `review_total_count`

Write to: `reviews[]`, `review_total_count`

### Section 5 — Client-build carousel

Explain: "These are the live websites you've built for past clients. They render as a horizontal carousel in Section 2 ('Setting industry standards'). Each tile pairs a screenshot with an owner quote. You need at least 1 to render this section. Skip with 0 to omit the section."

Loop until student says "done":
- "Client business name?" → `name`
- "Live URL?" → `url`
- "Drop a desktop screenshot at `assets/client-builds/{N}.webp`. Tell me when it's there." → `screenshot_path`
- "Owner's name?" → `owner_name`
- "A short quote from the owner about the build? (1-2 sentences)" → `owner_quote`

Write to: `client_builds[]`

### Section 6 — Case-study videos

Explain: "These are short video testimonials from your past clients. They render as a 2x2 grid in Section 3 (the proof section). 1-4 entries. MP4 format, ideally 30-60 seconds each."

Loop:
- "Client owner's name?" → `owner_name`
- "Drop the MP4 at `assets/case-studies/{N}.mp4`. Tell me when it's there." → `video_path`
- "Optional: drop a poster frame at `assets/case-studies/{N}-poster.webp`. Skip if not." → `poster_path`

Write to: `case_studies[]`

### Section 7 — Proof video + stat

Explain: "This is your flagship 'this is what we deliver' video, embedded in Section §4. It's the closer — the one piece of proof that makes the prospect want to sign. Either a YouTube link or a local MP4."

- "YouTube URL or local MP4? (paste URL OR say 'local')" → branches into `video_url` or `video_path`
- "What's the proof stat? (one big number for the H2, e.g. '$500K', '$1.2M', '47 clients')" → `stat`
- "Subtitle/context for the stat (e.g. 'booked in 90 days', 'live across 14 cities')" → `stat_subtitle`
- "One-sentence intro paragraph that sits under the stat? (e.g. 'A real client went from zero to seven figures in 90 days. Watch his story.')" → `intro_paragraph`
- "What should we call the video? (e.g. 'The 90-Day Story', 'How Acme 5x'd Their Pipeline')" → `video_title`
- "Thumbnail image URL for the video? (if YouTube, the agent will derive from the video ID; otherwise paste a hosted image URL)" → `video_thumbnail_url`

Write to: `proof.{stat, stat_subtitle, intro_paragraph, video_url, video_path, video_title, video_thumbnail_url, video_caption}`

### Section 8 — Winning Formula (3 pillars · cards each · outcome line)

Explain: "The Winning Formula is the spine of your sales proposal. Three pillars (Traffic / Trust / Conversion), each one an accordion. When the prospect clicks 'How?' on a pillar, the cards below explain exactly how you deliver that outcome. The student fills these from their niche research, offer crafting, and prior client wins."

**Source upstream:** these cards should be informed by Module 2 (niche research), Module 3 (offer crafting), and the student's actual delivery process. The student doesn't invent these from scratch — they distill them from the research stage.

#### 8a · Outcome line

- "Outcome line at the end of the equation (e.g. 'More Leads Booked', 'More Jobs Won', 'More Customers Converted')" → `outcome_line`

#### 8b · Traffic pillar

This pillar is "Get found first on Google + AI". One feature card + the "things we do on your SEO" audit bullets.

Feature card:
- "Card title (3-7 words, with optional emoji prefix). Example: '🌐 SEO + AEO architecture'" → `traffic.feature_card.title`
- "One-line meta (subtitle below the title)" → `traffic.feature_card.meta`
- "3 bullets (each is one short claim, can include `<strong>` tags)" → `traffic.feature_card.bullets[]`
- "Stat number (the big number in the callout, e.g. '50%', '+30%', '5 sec')" → `traffic.feature_card.stat_num`
- "Stat text (one sentence explaining the stat, can lead with `<strong>Why this works:</strong>`)" → `traffic.feature_card.stat_text`
- "CTA label + anchor (where on the client's site does it link to? e.g. 'See it in your service-area grid' → '#service-area')" → `traffic.feature_card.{cta_label, cta_anchor}`

SEO audit bullets (the "X things we do on your SEO" list):
- "Heading (e.g. '10 things we do on your SEO')" → `traffic.audit_heading`
- "5-10 bullets (each one HTML, can include `<strong>` tags)" → `traffic.audit_bullets[]`

#### 8c · Trust pillar

This pillar is "Win them in 5 seconds". 2-4 feature cards proving you deliver trust.

For each card (loop until student says "done"):
- "Card title (with emoji prefix, e.g. '⭐ Real Google + Facebook reviews above the fold')" → `trust.cards[N].title`
- "Tag label (e.g. 'TRUST')" → `trust.cards[N].tag`
- "Meta line" → `trust.cards[N].meta`
- "3-4 bullets" → `trust.cards[N].bullets[]`
- "Stat num + stat text" → `trust.cards[N].{stat_num, stat_text}`
- "CTA label + anchor (optional)" → `trust.cards[N].{cta_label, cta_anchor}`
- "AI-highlight this card? (true/false — gives it a gold accent treatment)" → `trust.cards[N].ai_highlight`

#### 8d · Conversion pillar

This pillar is "Turn visits into booked work". 2-4 feature cards proving you convert.

Same shape as Trust cards. Loop until done.

Write to: `winning_formula.{outcome_line, traffic, trust, conversion}` per the schema in `agency-brand.example.json`.

### Section 8.5 — Three reasons (the §E "worth the call" block)

Explain: "These are the three reasons the proposal gives for why a prospect should call you today. They show as 3 stacked cards under the proof section. Card 01 is usually your guarantee. Card 02 is usually a value-vs-cost angle. Card 03 is usually your niche expertise. Use your own copy — the goal is to make the prospect feel they cannot lose."

For each reason 1, 2, 3:
- "Reason {N} title? (3-6 words)" → `title`
- "Reason {N} body? (2-3 sentences)" → `body`

Write to: `three_reasons[0..2]`

### Section 9 — AI Infrastructure stack

- "What do you call your AI lead-handling stack? (e.g. 'The Conversion Stack', 'AI Sales Engine')" → `stack_name`
- "Which platforms are in it? (comma-separated: GoHighLevel, Make.com, OpenAI, Twilio, etc.)" → `platforms[]`
- "Details paragraph (HTML): what does the stack actually do?" → `details_html`

Write to: `ai_infrastructure.{stack_name, platforms, details_html}`

### Section 10 — Timeline

- "Headline for the speed-of-delivery section? (e.g. 'Sign today, live in 3 days', 'From signature to launch in a week')" → `headline`
- "How many days to live?" → `days_to_live`
- "Step-by-step breakdown: for each day, what happens? Loop until done."

Write to: `timeline.{headline, days_to_live, steps[]}`

### Section 11 — Guarantee

- "Guarantee headline (e.g. '100% money-back if we miss the timeline')" → `headline`
- "Full guarantee terms as HTML" → `details_html`
- "Drop a guarantee seal image at `assets/guarantee-seal.png` (transparent PNG, ~200x200). Tell me when it's there." → `seal_path`

Write to: `guarantee.{headline, details_html, seal_path}`

### Section 12 — Pricing (the proposal §Pricing block)

Explain: "These are the actual prices the prospect sees in the proposal. Every value below renders into the proposal HTML, so the prospect sees exactly what you charge. Use display strings (e.g. `$5,000` not `5000`) so the formatting is preserved verbatim."

Agency-level pricing model:
- "Short description of your pricing model? (e.g. 'Setup + monthly retainer', 'Flat project fee')" → `model`
- "Currency? (default USD, can be GBP/EUR/ZAR/etc.)" → `currency`

Hero pricing display (the dark price card):
- "One-Time Setup price (the public-facing setup fee, e.g. `$5,000`)" → `setup_fee_price_display`
- "Monthly fee display (e.g. your standard monthly fee display string)" → `monthly_fee_price_display`

One-time offer (the modal that pops on 'Reveal One-Time Offer' click):
- "One-Time Offer price (the discounted setup fee for sign-on-call, e.g. `$3,000`)" → `one_time_offer_price_display`
- "Standard setup fee referenced in the modal copy (typically same as setup_fee_price_display)" → `setup_fee_standard_display`

Value Stack (5 line items shown above the hero price card):
For each of 5 items:
- "Line {N} name (e.g. 'Custom Website Build', 'AI Lead-Handling Stack', 'SEO Foundation')" → `value_stack[N].name`
- "Line {N} MSRP display string (e.g. `$12,000`, `$3,600/yr` — use your own MSRPs)" → `value_stack[N].msrp`

Then:
- "Stacked Value total display (sum of your value-stack MSRPs, formatted with optional `+`, e.g. `$12,000`)" → `stacked_value_total_display`

ROI calculator defaults (illustrative; the prospect can adjust sliders live):
- "Default 'monthly site leads now' value for the ROI slider (typical for your niche)" → `roi_defaults.leads_per_month`
- "Default 'average ticket size' display (e.g. `12,500`, `8,000`, `2,400`)" → `roi_defaults.ticket_size_display`
- "Default 'expected monthly lift' display (e.g. `37,500`, `15,000`)" → `roi_defaults.lift_display`

Write to: `pricing.{model, currency, setup_fee_price_display, monthly_fee_price_display, one_time_offer_price_display, setup_fee_standard_display, value_stack[], stacked_value_total_display, roi_defaults}`

### Section 12.5 — Brand palette (proposal colors)

Explain: "These hex codes drive every accent color in the proposal. The build tool injects them as CSS variables so every CTA, kicker, eyebrow, and section accent renders in your agency's actual brand colors. Three values needed."

- "Primary accent hex (your main brand color — CTAs, kickers, primary buttons). Format: `#RRGGBB`. Example: `#0F172A` for navy, `#7C3AED` for purple, `#1E40AF` for royal blue, `#065F46` for forest green." → `palette.primary`
- "Primary-deep hex (a darker variant used on button hover + button bevel). Typically 15-25% darker than primary." → `palette.primary_deep`
- "Accent hex (secondary highlight color — eyebrows, gold text, callouts). Often gold, amber, or warm contrast color. Example: `#EAB308`, `#F59E0B`, `#D97706`." → `palette.accent`

Validate each value matches `/^#[0-9A-Fa-f]{6}$/`. Reject if not. Write to: `palette.{primary, primary_deep, accent}`

### Section 13 — SOP password + blueprint

- "What password unlocks the technical SOP PDF mid-proposal? (any string)" → `sop_password`
- "Drop your blueprint/methodology PDF at `assets/blueprint.pdf`. Skip if not available." → `blueprint_pdf_path`
- "Title for the blueprint? (e.g. 'The Acme Growth Playbook')" → `blueprint_pdf_title`

Write to: `sop_password`, `blueprint_pdf_path`, `blueprint_pdf_title`

## Validation

After every section, write incremental progress to `agency-brand.json`. After the final section:

1. Schema validation: every `__REQUIRED__*__` sentinel from the example file must be replaced. Run a substring grep on the written JSON; any surviving sentinel halts with the field name flagged.
2. Asset existence check: every referenced `assets/...` path must exist as a real file.
3. Minimum-viable check: must have at least 3 reviews, at least 1 client-build entry OR 1 case-study video, a populated proof section, a sop_password, and three populated value props.

If any check fails, return to the failing section and re-prompt the student.

## Re-running

`/setup-agency` is idempotent. If `agency-brand.json` already exists, the agent reads the existing values and asks: "Want to update existing answers, or start fresh?" Then walks through only sections the student wants to revise.

## State machine

On successful completion:
```json
{
  "gates": {
    "agency.brandLocked": true
  },
  "history": [
    { "timestamp": "...", "command": "/setup-agency", "outcome": "agency-brand.json written with N reviews, N client builds, N case studies" }
  ]
}
```

Stage 13 (proposal builder) refuses to run if `agency.brandLocked` is false. Refer the student back to this command.

## Files written
- `website-factory/clients/_agency/agency-brand.json`
- `website-factory/clients/_agency/assets/*` (the student drops these, the agent confirms presence)
- `stack-state.json`
- `logs/stack-run.log` entry
