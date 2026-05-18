# Web Design and UI/UX Research from X and Design Community

Date: 2026-05-14
Researcher: Claude (Opus 4.7, 1M context)
Trigger: First factory build (https://{TEMPLATE_REFERENCE_DEPLOY_URL}) felt under-polished. Boutique hotel and wedding venue niche.
Goal: Mine X (Twitter) and the surrounding design community for specific, actionable upgrades to bake into the website-factory templates, copy generation, and asset pipeline.

Stack: Vite + React + Tailwind. Current defaults: Cormorant Garamond + Inter, near-black + warm tan + cream, 15 sections.

This is a synthesis. Every tactic below is implementable in the current factory tech stack unless explicitly noted.

---

## Section 1: Top 15 actionable tactics (highest priority)

### 1. Kill Inter as the body default and pair Fraunces variable with a humanist sans
What it is: The single fastest way out of AI-slop. AI tools and template libraries default to Inter, so it is the typeface that signals "no taste decisions were made here." Fraunces is a variable serif with an optical-size axis (opsz) and two extra axes (SOFT, WONK) that adapts its letterforms between display and text sizes automatically. Pair it with Epilogue or Söhne-style humanist sans for body, not Inter.
Why it works: Optical sizing means the same font file renders correctly at 12px and at 96px. The serif-with-personality plus humanist-sans pairing is the editorial taste signal premium hospitality buyers respond to.
Source: prg.sh "Why Your AI Keeps Building the Same Purple Gradient Website", beautifulwebtype.com/fraunces, dev.to "10 Font Pairings", nanx.me on Inter optical sizing.
Apply to factory: In the boutique-wedding template, replace Inter with Fraunces (display, weights 300/500/700, opsz axis on) + Plus Jakarta Sans or Epilogue (400/500). Set `font-optical-sizing: auto` globally. Keep Cormorant only as an alternate brand option, not the default.

### 2. Replace flat hero CTAs with editorial layouts using cinematic stillness
What it is: Premium hospitality sites (Aman, Como, Aesop, Six Senses) do not yell. They use one large quiet photograph, generous top margin, a short editorial headline, and one CTA. No badge cluster. No three-column trust strip above the fold. The hero is meant to slow the user's nervous system, not energize them.
Why it works: Premium audiences respond to restraint, not urgency. Editorial restraint is the single biggest visual tell of luxury vs. mid-market.
Source: typza.com, mediaboom.com luxury-hotel-website-design, ward.studio Aesop case study, work.co Aesop case study.
Apply to factory: Rebuild Hero.tsx. Remove the badge strip and Capacity strip from above the fold. Move them to a second screen. Hero now contains: full-bleed image, generous 12vh top padding, eyebrow label, headline, single CTA. Nothing else.

### 3. Use a 1.25 or 1.333 modular type scale, not Tailwind defaults
What it is: Tailwind's text size defaults (text-sm, text-base, text-lg, text-xl) jump in roughly 1.125x increments. That feels cramped at the high end. Premium editorial sites use a modular scale of 1.25 (major third) or 1.333 (perfect fourth), generating sizes like 14, 18, 24, 32, 42, 56, 75, 100.
Why it works: Bigger jumps between heading levels create real hierarchy. Cramped scales make every heading feel like every other heading.
Source: Adobe Typekit and Type Scale conventions, prg.sh "3x+ increases, not 1.5x", todaymade.com typography trends.
Apply to factory: In `tailwind.config.js`, override the `fontSize` scale with a 1.25 modular scale starting at 16px. Set `display-xl` to roughly 96px on desktop, `display-lg` to 72px. Display sizes get a tight line-height (1.05 to 1.1). Body stays at 1.55 line-height.

### 4. Set body line-height to 1.55-1.65 and tighten heading line-height to 1.05-1.1
What it is: Default Tailwind line-height for body is 1.5. Premium long-form sets body to 1.55 to 1.65. Headlines tighten dramatically to 1.05 to 1.1 so multi-line headlines feel like a single visual block, not three separated lines.
Why it works: Tight headings read like editorial print. Loose body copy reduces cognitive load and signals comfort.
Source: developer.mozilla.org line-height, useful.codes typography, joshwcomeau.com.
Apply to factory: Add Tailwind utility classes: `leading-display` = 1.05, `leading-tight-display` = 1.1, `leading-body` = 1.6. Apply to all headline and paragraph components.

### 5. Use letter-spacing negatively for headlines, positively for eyebrows
What it is: Large headlines (40px+) at default tracking look slightly loose. Tighten them to -0.02em to -0.03em (Stripe uses -0.03em on 56px). Eyebrow labels above headlines get positive tracking (0.08em to 0.16em) plus uppercase and small size.
Why it works: Big text at default tracking has loose-looking white space inside letterforms. Tightening it makes display feel intentional and architectural. Letter-spaced uppercase eyebrows are the editorial signal of premium magazines and luxury catalogs.
Source: refero.design Stripe analysis, fontsinuse.com Stripe 2020, Vercel design guidelines.
Apply to factory: Add Tailwind utilities `tracking-display` (-0.025em), `tracking-eyebrow` (0.12em uppercase). Apply across Hero, sections headings, and section eyebrows.

### 6. Use curly quotes, en dashes, ellipsis character, and tabular numbers
What it is: Real premium sites use proper typographic characters: " " not " ", - not -, … not ..., and `font-variant-numeric: tabular-nums` on prices and numbers so they align vertically.
Why it works: This is the layer of polish AI-generated content never gets right. Designers notice. Most users feel it without naming it.
Source: Vercel design guidelines.
Apply to factory: Add a `smartquotes` utility to the copy-deck and copy-resonance SOPs. Apply `tabular-nums` Tailwind class to capacity numbers, prices, dates. Run a build-time replacement script that converts straight quotes to curly in all generated copy.

### 7. Hero image is everything. Replace stock with curated golden-hour or candlelit shots
What it is: Generic stock photos are the biggest single tell of templated work. Hospitality buyers (couples planning weddings, travelers booking suites) need to see the actual place, not a moody beach. Photograph (or commission) at golden hour (first hour after sunrise, last hour before sunset) and one candlelit interior shot. Show one detail (texture, foliage, ceramic) not a wide vista.
Why it works: 93% of hospitality buyers read reviews and look at real photos before booking. Stock crashes trust the moment a single shot looks like Unsplash.
Source: mediaboom.com Aesop and Aman analysis, mannixmarketing.com hotel website photos, heidikirn.com, plerdy.com hotel website design.
Apply to factory: Update `04-assets.sop.md` to require, per client: 1 golden hour hero, 1 candlelit interior, 1 detail shot, 3 wide rooms, 6 wedding moments. Reject stock entirely. Add an Apify or scraping flow that pulls the client's existing Instagram or shoot folder. If a client cannot supply, generate a brief and price a photo shoot into the proposal.

### 8. Replace the 3-column feature grid with asymmetric two-column or split-screen layouts
What it is: "Three boxes with icons in a grid" is THE AI-slop layout. Premium sites use asymmetric pairings (image left 60%, text right 40%) or split-screen (full-height image one side, scrolling text other). Any factory section that defaults to a symmetric three-column grid (capacity strip, two-paths feature, planning journey, etc.) is susceptible.
Why it works: Asymmetry feels deliberate. Symmetric three-column grids signal "we used a template."
Source: prg.sh, 925studios.co AI slop guide, wix.com avoid generic AI content.
Apply to factory: In any niche template that currently uses symmetric column-grid sections (two-paths, capacity strip, planning journey), refactor to asymmetric layouts. A capacity-strip equivalent becomes a single long horizontal bar with three numbers and one accent quote, not three boxes.

### 9. Add scroll-linked word-by-word text reveal to one headline per page
What it is: Pick the most important headline on each page (Hero for home, Inquiry headline for wedding page) and reveal each word as the user scrolls into view. Uses Motion (formerly Framer Motion) or framer-motion's `useScroll` and a per-word stagger. Each word transitions from opacity 0.2 to 1.0 as the scroll progress reaches that word.
Why it works: One scroll-linked headline reveal is the cheapest motion that reads as "this is premium." Used by Vercel, Linear, Refokus, premium real estate sites. The key is one per page, not everywhere.
Source: motion.dev React scroll animations, framer.com text reveal components, framer.university 10 scroll animations.
Apply to factory: Build a `<ScrollRevealHeadline>` component in the factory. Use `framer-motion` `useScroll` with `transform` to drive per-word opacity. Add to Hero by default. Honor `prefers-reduced-motion` and disable the reveal when true.

### 10. Use `prefers-reduced-motion` and never animate with `transition: all`
What it is: Wrap all motion in `prefers-reduced-motion` media queries. Use explicit transition properties (`transition-property: transform, opacity`), never `transition: all`. GPU-accelerated transform and opacity only. Avoid animating width, height, top, left.
Why it works: Performance and accessibility. Vercel and every modern design system enforce this. `transition: all` kills frame rate on slower devices and triggers layout shift.
Source: vercel.com/design/guidelines, motion.dev easing functions.
Apply to factory: Add a Tailwind plugin or global CSS that defines safe transition tokens. Add a `prefers-reduced-motion: reduce` block that sets all animations to 0.01ms. Ban `transition: all` in linting.

### 11. Replace ease-out-cubic with custom cubic-bezier and use spring physics for hover
What it is: Default CSS `ease` and `ease-out` are fine, but premium sites use specific curves. For UI reveals, use `cubic-bezier(0.16, 1, 0.3, 1)` (easeOutExpo equivalent). For hover, use spring physics via framer-motion with stiffness 300, damping 30. Enter snappy (300ms), exit slow (500ms).
Why it works: Specific curves feel deliberate. The mismatch between fast enter and slow exit creates the responsive-but-relaxed quality of premium products.
Source: easings.net, motion.dev easing-functions, animations.dev easing-blueprint, pixelfreestudio hover effects.
Apply to factory: Add Tailwind transition timing utilities: `ease-premium-out` = cubic-bezier(0.16, 1, 0.3, 1), `ease-premium-in` = cubic-bezier(0.7, 0, 0.84, 0). Use spring physics on all interactive components (buttons, cards, gallery items).

### 12. Build a real spacing scale on 8pt grid with intentional variation
What it is: Use 8px as the base unit. Spacing scale: 4, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192. Between sections, use 96 or 128 on desktop. Inside cards, use 24 to 32. Headline-to-eyebrow gap: 12 to 16. Headline-to-supporting-paragraph gap: 24 to 32. Never 16 everywhere.
Why it works: Visible rhythm. Identical 16px padding everywhere flattens visual hierarchy. Variation guides attention.
Source: designsystems.com space-grids-and-layouts, atlassian.design spacing, carbondesignsystem.com spacing, 925studios.co AI slop guide.
Apply to factory: Override Tailwind spacing scale in config to use 8pt with named sizes (`section-gap` = 96, `section-gap-lg` = 128, `card-pad` = 32). Audit current factory components and remove default p-4 and m-8 everywhere.

### 13. Use a "quiet premium" neutral palette with one disciplined accent
What it is: Bone, sand, taupe, stone, ivory, smoke. Pair with one accent (not multiple). Current {TEMPLATE_REFERENCE_CLIENT} defaults of warm tan + cream + near-black is on the right track, but the accent should be a single warm gold or oxblood, used sparingly on links, CTA, and decorative dividers. Never use more than 5 hex values total in the entire site.
Why it works: Premium brands (Aman, Aesop, Hermes, Loro Piana) live in muted tones. Reducing palette discipline is the single biggest brand maturity signal.
Source: aifire.co premium AI websites guide, mediaboom luxury hotel, lummi.ai web design best practices.
Apply to factory: Lock the boutique-wedding template palette to 5 tokens: ink (#1A1817), bone (#F4EDE3), cream (#FAF5EB), tan (#B8956A), accent (single hex per client, default oxblood #6B2C2A). All component styling references these tokens only.

### 14. Add a sticky compact booking/inquiry bar on mobile, never desktop
What it is: On mobile (under 768px), a thin sticky bar at the bottom containing one CTA ("Check Availability" or "Inquire About Your Wedding"). Has a close button. Does not appear on desktop. Sits below scroll content with `position: fixed; bottom: 0`.
Why it works: Mobile drives 65% of hospitality traffic. Sticky CTAs on mobile increased conversion ~4% in A/B tests. On desktop, sticky bars feel pushy and break the editorial feel.
Source: goodui.org pattern 41, abtasty mobile stick-to-scroll, ralabs.org booking UX 2025.
Apply to factory: Add a `<MobileStickyInquiry>` component. Use Tailwind responsive classes to hide on `md:` and up. Include a small dismiss button.

### 15. Layer shadows like real light: ambient + direct, not single drop
What it is: Use two shadow layers per card or elevated component. One small tight shadow simulating direct light (e.g., `0 1px 2px rgba(0,0,0,0.06)`), one larger soft shadow simulating ambient light (e.g., `0 24px 48px rgba(0,0,0,0.08)`). Add a 1px semi-transparent border for edge clarity.
Why it works: Real objects in real light cast two shadows. Single drop shadows look 2010. Layered shadows are the Linear, Vercel, Stripe pattern.
Source: vercel.com design guidelines, prg.sh, andrew.ooo taste skill review.
Apply to factory: Add Tailwind shadow utilities `shadow-card`, `shadow-card-lg`, `shadow-floating`. Use layered values. Audit current cards (RoomsSuites, WeddingPackages) and replace single shadows.

---

## Section 2: Top 10 anti-patterns to ban from the factory

### 1. Inter as the only typeface
Why it screams AI: Inter is the default in Tailwind, shadcn, Vercel, Figma, every component library, and every AI design tool. Pairing Inter with a system-font fallback signals zero typographic choice. Even pairing Inter with a generic serif fails because Inter itself is the tell.
Source: prg.sh, 925studios.co, mindstudio.ai.

### 2. Purple-to-blue or any gradient hero background
Why it screams AI: AI image models and templated SaaS were trained on these. Linear, Stripe (older), Cluely, every YC site uses them. They are the AI default and now signal generic.
Source: prg.sh, aifire.co, 925studios.co.

### 3. Three-column feature grid with icons
Why it screams AI: "Three boxes with icons in a grid" is the most common AI generated layout pattern. Any factory section that defaults to that shape (capacity strips, two-paths feature blocks, planning-journey grids, etc.) is susceptible.
Source: prg.sh, 925studios.co.

### 4. Stock photography of generic happy people
Why it screams AI: "Diverse group of people looking at a laptop in an impossibly well-lit office" is the AI default. For boutique hospitality, the equivalent is "smiling couple holding champagne in a generic vineyard."
Source: 925studios.co, mannixmarketing.com hotel photos, justinmind.com hero images.

### 5. Vague aspirational headlines ("Build the future of work")
Why it screams AI: AI averages every headline. Specific, founder-voiced headlines beat aspirational ones every time. {TEMPLATE_REFERENCE_CLIENT}'s hero copy currently risks this.
Source: 925studios.co, mindstudio.ai.

### 6. Em dashes everywhere
Why it screams AI: ChatGPT sprinkles em dashes in everything. Real human writing uses them sparingly. The project rule already bans them. Enforce in copy gen and resonance QA.
Source: oliviacal.com AI writing tells, productiveshop.com AI patterns.

### 7. "Realm", "Tapestry", "Beacon", "Symphony", "Testament" in copy
Why it screams AI: These are documented AI vocabulary tells. Plus phrases like "rich tapestry of," "stands as a testament to," "in the realm of," "in today's fast-paced world."
Source: oliviacal.com, productiveshop.com.

### 8. Uniform 16px border radius and 24px padding everywhere
Why it screams AI: Same radius and padding on every element flattens hierarchy. Premium sites vary radius (4px on tags, 8px on buttons, 16px on cards, 24px on hero modules).
Source: 925studios.co, vercel.com design guidelines.

### 9. Centered hero with one button on a gradient background
Why it screams AI: This is the SaaS template. Premium hospitality is asymmetric, full-bleed photographic, eyebrow-led copy, and the CTA is contextual ("Begin Your Stay", "Plan a Tasting Visit"), not "Get Started."
Source: prg.sh, mediaboom luxury hotels, ward.studio Aesop.

### 10. Auto-playing motion or "scroll-jacking"
Why it screams AI: Heavy GSAP scroll-jacking, parallax for parallax's sake, and autoplaying hero videos are 2018. Premium 2025 is restrained motion: one or two scroll reveals, smooth section fades, hover springs. No video autoplay.
Source: vercel.com design guidelines, ewebdesign.com subtle motion, lodgingmagazine charisma.

---

## Section 3: Hero design specifically (5 tactics)

### H1. Photograph at golden hour, candle light, or blue hour. Never midday.
Golden hour (first/last hour of sun) softens shadows and warms tones. Blue hour creates a cinematic, painterly quality that signals luxury. Midday is for product flat-lays, not architecture.
Source: heidikirn.com hotel photography, mannixmarketing.com.

### H2. Open with the location-as-protagonist, not a wide aerial
Aman, Como, and most awarded boutique hotels open with one image of the building's most distinctive material or detail (a stone wall, a teak doorway, a hand-thrown ceramic) rather than a sweeping landscape. The detail tells the brand story; the landscape says "hotel."
Source: hotelsabovepar.com, mediaboom 52 examples.

### H3. Eyebrow + Headline + Sub + One CTA. Nothing else above the fold.
The hero should fit on one screen. Strip every badge, every trust-badge strip, every capacity strip. Eyebrow is a small uppercase italic 12-14px. Headline is 72-96px display serif. Sub is one sentence. CTA is one ghost button.
Source: typza.com hero premium, mediaboom luxury hotel.

### H4. Use a 1-3 second slow Ken Burns or static high-res photo, never autoplay video
Premium hospitality sites do not autoplay video heroes in 2025. Instead, a slow zoom (1.0 to 1.04 scale over 8-12 seconds, ease-out) on a single photograph. If video is needed, add a play-to-open thumbnail.
Source: mediaboom 52 examples, fireart.studio hotel design.

### H5. Strong vignette and dark gradient overlay only on bottom 30%
For legible white text on a photo hero, use a linear gradient from rgba(0,0,0,0) at 50% to rgba(0,0,0,0.55) at 100% on the bottom of the image. Never a full overlay. Never `mix-blend-mode: overlay` (looks dated).
Source: justinmind.com hero images, agentimage.com realtor hero design.

---

## Section 4: Trust + social proof (5 tactics)

### T1. Real reviews with named source, photo, and date. Pull from Google or TripAdvisor live.
93% of hospitality buyers read reviews before booking. The single biggest trust win is real reviews from a recognized source (Google, TripAdvisor, The Knot, WeddingWire), with the reviewer's actual name, profile image (if public), date, and a star rating. Generic "Sarah, Cape Town" with no source kills trust.
Source: incremys.com hospitality e-reputation, atlasperk.com trust signals travel, datapins.com social proof statistics.

### T2. Show the host's face. Once, prominently. Not as a stock smiling avatar.
Boutique hotels are a relationship business. A real photo of the proprietor (or wedding coordinator), warm, in the property, with their first name. Builds the parasocial trust ratchet.
Source: lodgingmagazine charisma, sonas.events wedding venue, ravecapture trust signals.

### T3. Display certifications and association memberships as small wordmarks, not badge clusters
Tablet Hotels, Mr & Mrs Smith, Relais & Chateaux, The Knot Best of Weddings, WeddingWire Couples Choice. Show these as small monochrome wordmarks in a single thin row, not as gaudy colored badges. the website template's TrustBadgeStrip is currently susceptible to this.
Source: ravecapture, atlasperk trust signals, hotelsabovepar.

### T4. Real wedding stories, named couples, hero photo per story
The Photo Gallery section should not be a generic masonry. It should be a small set of named real weddings, each with one hero photo, the couple's names, the wedding date, and a one-line quote. Refreshed quarterly.
Source: johnsonjonesgroup, sonas.events, idodesign.studio.

### T5. Transparent pricing or pricing range
Couples who plan weddings are emotionally exhausted and reject sites that hide pricing. Show a "starting at R [X]" or "weekday weddings from R [X]". This filters unqualified leads and builds trust simultaneously.
Source: cvent.com wedding venue website design, weddingvenuemarketing.com checklist, idodesign.studio 10 ways.

---

## Section 5: Motion + microinteractions (5 tactics)

### M1. One scroll-linked headline reveal per page, gated by `prefers-reduced-motion`
Already covered as Tactic 9. The single highest-leverage motion. Implementation: `framer-motion` `useScroll` driving opacity from 0.15 to 1.0 per word, staggered, with `cubic-bezier(0.16, 1, 0.3, 1)`.
Source: motion.dev scroll, framer.community on scroll text mask.

### M2. Spring hover on buttons and cards (300ms in, 500ms out)
Hover enter is snappy (200-300ms easeOutCubic). Hover exit is slower (400-500ms easeOutExpo). Translate the button up 2px on hover. Scale image card 1.02 on hover. Brightness change on image overlay.
Source: pixelfreestudio hover, joshwcomeau CSS transitions, sitepoint button microinteractions.

### M3. Image cards fade-in on scroll with subtle scale and translate
When an image card enters the viewport, fade from opacity 0 to 1 over 600ms while translating from y=24px to y=0 with `easeOutExpo`. Stagger sibling cards by 80ms. Disable on `prefers-reduced-motion`.
Source: framer.university 10 scroll animations, motion.dev, framer.com academy.

### M4. Sticky elements use `position: sticky`, never `position: fixed` for in-content elements
For section eyebrows that "stick" while scrolling within a section, use CSS `position: sticky` with `top: 80px`. Native, performant, no JS. Reserve `position: fixed` only for the mobile booking bar.
Source: rebelmouse.com sticky positions, motion.dev, vercel design guidelines.

### M5. Page transitions: 200ms fade + 8px upward translate, not slide
On Vite/React with React Router, wrap routes in framer-motion `<AnimatePresence>`. Exit: opacity 1->0 + y 0->-8 in 200ms. Enter: opacity 0->1 + y 8->0 in 300ms with 50ms delay. Subtle. Not slide. Not curtain.
Source: motion.dev React animation, nextjs.org view transitions, logrocket framer page transitions.

---

## Section 6: Typography + spacing (5 tactics)

### Ty1. Variable font with optical sizing axis as the default rule
Use variable fonts (Fraunces, Inter Variable, Plus Jakarta Sans Variable, Epilogue Variable) and set `font-optical-sizing: auto` globally in the base layer. One font file covers all weights and renders correctly at every size.
Source: developer.mozilla.org font-optical-sizing, nanx.me Inter optical sizing, beautifulwebtype Fraunces, pixelambacht.

### Ty2. 1.25 modular scale with display step at 1.333
Body scale: 14, 16, 18 (1.25 modular). Heading scale: 24, 32, 42, 56, 75, 100 (1.333 modular). On desktop only. On mobile, cap at 56-64 for hero, 32-42 for h2.
Source: prg.sh, todaymade.com typography trends, todaymade.

### Ty3. Display tracking -0.025em, eyebrow tracking +0.12em uppercase
Headlines tighten visibly at 40px+. Eyebrows go uppercase, small (12-14px), with 0.12em tracking, in the accent color.
Source: refero.design Stripe, fontsinuse.com Stripe, vercel design guidelines.

### Ty4. Body line-height 1.6, display line-height 1.05-1.1
For multi-line body copy, 1.6 reduces cognitive load. For multi-line display headlines, 1.05 keeps them visually grouped.
Source: developer.mozilla.org line-height, useful.codes typography line-height, joshwcomeau animation.

### Ty5. Max paragraph width 65-72ch
Set paragraphs to `max-width: 68ch`. Beyond 75 characters per line, comprehension drops. This is the editorial print rule that premium websites follow.
Source: nngroup, joshwcomeau, designsystems.com.

---

## Section 7: Sources cited

This list aggregates every URL, X handle, and article that informed the synthesis. 35+ distinct sources.

### X handles referenced (per task brief, recent design content)
- @rauchg (Guillermo Rauch, Vercel) https://x.com/rauchg
- @shadcn (Shadcn) https://twitter.com/shadcn
- @addyosmani (Addy Osmani, Chrome) https://twitter.com/addyosmani
- @samuelkraft (Samuel Kraft) https://twitter.com/samuelkraft
- @adamwathan (Adam Wathan, Tailwind) https://twitter.com/adamwathan
- @brian_lovin (Brian Lovin, Notion) https://x.com/brian_lovin
- @jasonzhou1993 (Jason Zhou) https://x.com/jasonzhou1993
- @mds (Mark Otto, Bootstrap)
- @jaredpalmer (Jared Palmer, Vercel)
- @t3dotgg (Theo Browne)
- @cassidoo (Cassidy Williams)
- @SaraSoueidan (Sara Soueidan)
- @lukew (Luke Wroblewski)
- @kentcdodds (Kent C Dodds)
- @AndyBitz
- @paco_ui (paco)

### Threads, articles, and design system documentation
- https://threadreaderapp.com/thread/1806385778064564622.html (rauchg thread on app router migration and modern web stack)
- https://vercel.com/design/guidelines (Vercel Web Interface Guidelines)
- https://vercel.com/geist (Geist Design System)
- https://vercel.com/geist/typography
- https://vercel.com/font (Geist font)
- https://prg.sh/ramblings/Why-Your-AI-Keeps-Building-the-Same-Purple-Gradient-Website
- https://www.925studios.co/blog/ai-slop-web-design-guide
- https://aiproductivity.ai/news/how-to-spot-ai-slop-websites/
- https://www.mindstudio.ai/blog/claude-design-avoid-ai-slop-design-system
- https://unpromptable.substack.com/p/5-ai-website-design-tips-for-websites
- https://andrew.ooo/posts/taste-skill-anti-slop-ai-frontend-review/
- https://thomas-wiegold.com/blog/claude-code-frontend-design-plugin/
- https://www.aifire.co/p/building-premium-ai-built-websites-2026-design-guide

### Typography and font pairing
- https://www.beautifulwebtype.com/fraunces/
- https://nanx.me/blog/post/inter-optical-sizing/
- https://fraunces.undercase.xyz/
- https://fontsinuse.com/typefaces/121631/fraunces
- https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/font-optical-sizing
- https://maxibestof.one/typefaces/inter
- https://jenwagner.co/5-fonts-to-pair-with-inter/
- https://orangeblueweb.com/best-google-fonts-in-2025-20-modern-serif-sans-serif-combos-that-convert-visitors-into-customers/
- https://mantlr.com/blog/google-fonts-pairing-cheat-sheet
- https://www.designity.com/blog/typography-trends
- https://www.creativebloq.com/design/fonts-typography/breaking-rules-and-bringing-joy-top-typography-trends-for-2026

### Hospitality and luxury website design
- https://www.typza.com/blog/website-hero-section-design-for-premium-brands
- https://mediaboom.com/news/luxury-hotel-website-design/
- https://www.plerdy.com/blog/best-hotel-website-design-examples/
- https://hoteltechreport.com/news/hotel-website-designs
- https://htmlburger.com/blog/best-hotel-website-design/
- https://www.hotelsabovepar.com/travel-guides/the-best-boutique-hotels-for-weddings
- https://www.rmscloud.com/blog/hotel-website-examples
- https://spiltmilkwebdesign.com/hospitality-website-branding-luxury-resorts-web-design-in-2025/
- https://tophotel.news/how-aman-carved-a-niche-in-luxury-hotel-and-resort-design/
- https://lodgingmagazine.com/the-charisma-factor-how-emotional-design-makes-a-hotel-memorable/
- https://www.awwwards.com/sites/aesop-taxonomy-of-design
- https://www.ward.studio/work/aesop
- https://work.co/clients/aesop/

### Wedding venue specific
- https://www.flyingvgroup.com/wedding-venue-website-design
- https://www.cvent.com/en/blog/hospitality/wedding-venue-website-design
- https://johnsonjonesgroup.com/best-wedding-venue-website-design/
- https://www.weddingvenuemarketing.com/blog/the-ultimate-wedding-venue-website-checklist-for-maximum-conversions/
- https://idodesign.studio/10-ways-to-boost-lead-conversion-on-your-wedding-venue-website/
- https://www.whitestonemarketing.com/wedding-venue-websites
- https://www.musegroupmarketing.com/our-work/wedding-venue-marketing-case-study
- https://socialhospitality.com/2025/07/6-digital-marketing-strategies-for-wedding-venues/
- https://www.sonas.events/blog/how-to-build-a-wedding-venue-website-that-converts-visitors-into-bookings

### Motion, animation, and interaction
- https://motion.dev/
- https://motion.dev/docs/easing-functions
- https://motion.dev/docs/react-scroll-animations
- https://motion.dev/docs/react-animation
- https://www.framer.com/marketplace/components/motion-text-reveal/
- https://www.framer.com/marketplace/components/mask-text-reveal/
- https://www.framer.com/academy/lessons/scroll-animations
- https://framer.university/blog/10-scroll-animations-to-make-your-website-stand-out
- https://framer.university/blog/4-amazing-framer-scroll-animations-(and-how-they-re-built)
- https://easings.net/
- https://animations.dev/learn/animation-theory/the-easing-blueprint
- https://www.svgator.com/blog/easing-functions/
- https://www.joshwcomeau.com/animation/css-transitions/
- https://www.sitepoint.com/button-micro-interactions/
- https://blog.pixelfreestudio.com/how-to-create-hover-effects-with-micro-interactions/
- https://ewebdesign.com/subtle-motion/
- https://nextjs.org/docs/app/guides/view-transitions
- https://blog.logrocket.com/advanced-page-transitions-next-js-framer-motion/

### Microinteractions and UX
- https://thesoftking.com/resources/microinteractions-in-ui-design
- https://affoweb.com/blog/top-ui-design-trends/
- https://nacardesign.com/2025/03/12/how-to-create-powerful-micro-interactions-from-basics-to-better-ux/
- https://njtechpioneers.com/blog/how-microinteractions-and-motion-are-shaping-ux-in-2025/
- https://techtio.io/blog/not-just-eye-candy-how-microanimations-boost-ux-in-2025/
- https://www.justinmind.com/web-design/micro-interactions
- https://medium.com/@atnoforuiuxdesigning/top-10-ui-design-trends-you-cant-ignore-in-2025-27c89cd3d971
- https://www.blazedream.com/blog/microinteractions-enhancing-ux-2025/

### Hero, gallery, and image
- https://reallygooddesigns.com/hero-section-design-examples/
- https://blog.hubspot.com/marketing/hero-image
- https://cxl.com/blog/hero-image/
- https://www.justinmind.com/blog/inspiring-hero-image-websites/
- https://www.crazyegg.com/blog/hero-image-best-practices/
- https://www.dreamhost.com/blog/homepage-hero-design/
- https://www.causalfunnel.com/blog/10-hero-section-mistakes-you-must-avoid-in-2026/
- https://heidikirn.com/blog/hotel-photography
- https://www.mannixmarketing.com/blog/hotel-website-photos/
- https://www.littlehotelier.com/blog/get-more-bookings/hotel-photography-marketing-bookings-website/

### Trust signals
- https://www.infinitywebcoders.com/blog/2025/12/09/social-proof-that-sells-how-testimonials-case-studies-trust-badges-boost-conversions-2025-guide/
- https://atlasperk.com/guides/website-conversion-for-travel/trust-signals/
- https://www.datapins.com/social-proof-statistics/
- https://trustmary.com/social-proof/trust-signals/
- https://ravecapture.com/building-trust-signals-beyond-traditional-reviews/
- https://mailchimp.com/resources/trust-signals/
- https://www.incremys.com/en/resources/blog/hospitality-e-reputation

### Spacing and design systems
- https://www.designsystems.com/space-grids-and-layouts/
- https://www.thehangline.com/8px-grid-spacing-system-explained-for-web-designers/
- https://atlassian.design/foundations/spacing
- https://carbondesignsystem.com/elements/spacing/overview/
- https://wise.design/foundations/spacing
- https://designsystem.digital.gov/design-tokens/
- https://hakan-ertan.com/designers-ultimate-spacing-guide-from-design-tokens-to-final-design/
- https://www.imagine.art/blogs/white-space-in-design
- https://pixelstreet.in/blog/white-space-in-web-design/

### AI writing tells (relevant to copy)
- https://www.oliviacal.com/post/ai-writing-tells
- https://productiveshop.com/how-to-avoid-ai-writing-patterns/
- https://michaelkristof.substack.com/p/5-tell-tale-signs-that-copy-has-been
- https://medium.com/@jess_33150/7-dead-giveaways-of-ai-writing-df5145f13498
- https://www.theaugmentededucator.com/p/the-ten-telltale-signs-of-ai-generated

### Tailwind, fonts, performance
- https://tailwindcss.com/docs/font-family
- https://tailwindcss.com/docs/line-height
- https://beavercheck.com/learn/font-display-swap
- https://brazy.one/blog/how-to-manage-and-preload-local-fonts-with-tailwind-in-astro/
- https://docs.astro.build/en/guides/fonts/

### Sticky CTAs and mobile UX
- https://goodui.org/patterns/41/
- https://www.abtasty.com/blog/mobile-stick-to-scroll/
- https://ralabs.org/blog/booking-ux-best-practices/
- https://www.rebelmouse.com/css-position-sticky

### Editorial and font scaling references
- https://rectangle.substack.com/p/the-linear-effect
- https://medium.com/design-bootcamp/the-rise-of-linear-style-design-origins-trends-and-techniques-4fd96aab7646
- https://blog.logrocket.com/ux-design/linear-design/
- https://fonts.google.com/specimen/Inter
- https://en.wikipedia.org/wiki/Inter_(typeface)

### Stripe and design analysis
- https://styles.refero.design/style/48e5de76-05d5-4c4e-a269-c7c245b291ec
- https://fontsinuse.com/uses/35338/stripe-website-2020
- https://getdesign.md/stripe/design-md
- https://www.onething.design/post/a-guide-to-typography-in-web-design

End of synthesis.
