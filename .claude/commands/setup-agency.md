---
description: One-time agency-brand setup. Captures the student's own agency profile (name, founder, intro, value props, reviews, case studies, client builds, proof video, guarantee, pricing model, SOP password) that the proposal builder injects into every client proposal.
---

Gate: `setup.complete` must be true. No other gate required, but recommend running after `/discovery` so your value props are anchored to your real positioning.

This command runs the agency-setup agent. It walks you through every field that ends up in your client proposals so the proposal you send a prospect represents YOUR agency, not the factory's defaults.

Why it matters: Stage 13 (proposal builder) reads `website-factory/clients/_agency/agency-brand.json` on every client build. Without this file populated, the proposal HTML renders with `__REQUIRED__*__` sentinels and the build halts.

What the agent collects:

1. **Agency identity + niche vocab**: agency name, domain, YouTube channel, plus the niche noun (e.g. "roofing", "painting"), title-case version, niche verb, and your client's end customer (e.g. "homeowner"). The niche vocab fills the niche-specific sentinels in the proposal so the same template works for any vertical.
2. **Founder profile**: full name, first name, title, portrait photo, signature, owner pronoun
3. **Intro section**: three value-prop bullets (numbered stats with descriptors), a one-line promise, a bold conclusion line, portrait caption
4. **Review carousel**: 3+ written testimonials with reviewer name, platform (google/facebook/etc.), rating, avatar photo, full text. Pulled from your existing past work.
5. **Client-build carousel**: 3+ websites you've built. Live URL + screenshot + owner quote + owner name.
6. **Case-study videos**: 1-4 short video testimonials from past clients. MP4 files dropped into `clients/_agency/assets/case-studies/`.
7. **Proof video + stat**: your flagship "this is what we deliver" video. Either a YouTube URL or a local MP4. Big proof stat for the H2, stat subtitle, one-sentence intro paragraph, video title, thumbnail URL.
8. **Winning Formula**: the three levers you pull when you ship a website. Title + one-liner + details HTML for each. Plus the outcome line at the end of the equation (e.g. "More Leads Booked").
9. **Three reasons "worth the call"**: the three cards in §E. Title + body for each. Usually guarantee / value / niche-expertise.
10. **AI Infrastructure stack**: the platforms you set up for lead handling (e.g., GoHighLevel, Make.com, etc.) + a details paragraph.
11. **Timeline**: how fast you ship (default 3 days) + the step-by-step breakdown.
12. **Guarantee**: your money-back terms + headline + seal image.
13. **Pricing block** (drives every $ in the proposal):
   - Hero pricing card: One-Time Setup display + Monthly Fee display (e.g. `$3,000` setup + `$199/mo` recurring — student picks their own price points)
   - One-Time Offer modal: discounted offer price + standard rate referenced in copy
   - Value Stack: 5 line items, each with a name + MSRP display string (e.g. `Custom Website Build` → `$12,000` (use your standard MSRP))
   - Stacked Value total: sum of the 5 MSRPs (e.g. `$12,000` — student's own value-stack total)
   - ROI calculator defaults: leads-per-month + ticket-size + expected monthly lift (illustrative; prospect adjusts via sliders)
14. **Brand palette** (drives every accent color in the proposal):
   - Primary hex (CTAs, kickers, primary buttons)
   - Primary-deep hex (button hover + bevel; darker variant of primary)
   - Accent hex (eyebrows, secondary highlights; often gold or warm contrast)
   - `tools/build-proposal.py` injects these as CSS variables on `:root`, overriding the template defaults so every proposal renders in YOUR agency's brand colors.
15. **SOP password**: the password you give clients to unlock the technical SOP PDF mid-proposal. Plus the blueprint PDF path/title.

The agent writes everything to `website-factory/clients/_agency/agency-brand.json`. Both that file and the assets folder are gitignored, so your real testimonials, real client URLs, and real photos never accidentally get pushed to a public clone.

Output: a validated `agency-brand.json` that satisfies every `{{AGENCY_*}}` placeholder in `templates/proposal/proposal-template.html`. Subsequent `/run-factory` runs will produce proposals branded fully to your agency.

If you skip this command, the FIRST `/run-factory` run will halt at Stage 13 with a pointer back here. You can run it any time, including after your first client build, but the proposal won't ship until it's done.
