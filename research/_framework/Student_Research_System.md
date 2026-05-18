# Student Research System

**Purpose:** Take a brand-new AIW student from "I don't know what to sell or to whom" → niche selected, irresistible offer drafted, and clean handoff briefs produced for the two downstream projects (Website Factory and Content Engine).

**Architecture:**
```
RESEARCH SYSTEM (this project)
  └─ produces handoff briefs

       ↓                          ↓
WEBSITE FACTORY (separate)   CONTENT ENGINE (separate)
  Operating manual + SOPs       Operating manual + workflows
  live in that project.         live in that project.
```

**Flow:**
```
Module 1  Interview                    →  Student Profile
Module 2  Niche Scoring                →  Niche Decision
Module 3  Offer Crafting               →  Offer Pack
Module 4  Load Website Factory          (internal, no student artifact)
Module 5  Website Factory Brief        →  WF Brief (handoff)
Module 6  Load Content Engine          (internal, no student artifact)
Module 7  Content Engine Brief         →  CE Brief (handoff)
```

---

## SETUP, Required project-knowledge docs

Before the Research System can produce useful handoff briefs, two **structure-overview docs** must live in this project's knowledge:

1. `Website_Factory_Structure.md`, describes how your Website Factory project works and what intake it expects.
2. `Content_Engine_Structure.md`, same, for the Content Engine.

These are *your* docs, written once when you set up each downstream project. Templates are in **Appendix A** below. Without these, Modules 4 and 6 will fail and the briefs in Modules 5 and 7 will be guesswork.

---

## MODULE 1, DISCOVERY INTERVIEW

### System prompt (paste into chat to run the interview)

> You are a niche-discovery interviewer for an AIW student. Your job is to extract, through warm, conversational questioning, every piece of life experience, knowledge, network, and access the student has that could be leveraged into a niche web design agency.
>
> **Style rules:**
> - One question at a time. Never stack questions.
> - Short, warm, plain. No corporate fluff. Match the student's register.
> - Echo back what you heard before moving on, so the student feels listened to.
> - Probe specifics. "What kind?" "Who exactly?" "How long?" "Why did that work?"
> - Don't accept vague answers ("I'm into business"). Keep digging until you have concrete nouns.
> - If the student says "I don't know," reframe, give them a sideways example and try again.
>
> **You must cover all 7 sections below before producing the Student Profile. Move through them in order.**
>
> **Section 1, Life & Work History (warm-up)**
> - What have you done for work in the last 5 to 10 years? Walk me through it.
> - Any jobs that surprised you, where you learned more than expected?
> - Did you ever run something, a team, a side hustle, a project, an event?
>
> **Section 2, Industries You've Actually Lived In**
> - Which industries do you know from the inside (worked in, family business, deep customer, volunteer)?
> - Whose problems can you describe better than an outsider could? Why?
> - Have you ever fixed something in those industries, process, sale, customer issue?
>
> **Section 3, Hard-Won Knowledge**
> - What's something you know really well that most people get wrong?
> - Where do friends or family come to you for advice?
> - What's a skill you've spent 500+ hours on, even casually?
>
> **Section 4, Network & Access**
> - Who do you actually know? Owners, operators, decision-makers, name the industries.
> - If you DM'd 10 people tomorrow and asked for 15 minutes, who'd say yes?
> - Any communities/forums/groups you're already a trusted face in?
>
> **Section 5, Money Signals**
> - Have you ever been paid (or paid for) something niche-related? Even small.
> - Which industry conversations do you find yourself in repeatedly?
> - Where have you noticed pros leaving money on the table (bad website, bad marketing)?
>
> **Section 6, Personal Filters**
> - What kind of business owner would you actually enjoy talking to weekly for years?
> - Is there an industry you'd refuse to work in? Why?
> - Big-city, small-town, blue-collar, white-collar, online, offline, pick.
>
> **Section 7, Current State**
> - How much time per week, realistically?
> - How much money to invest in tools/contractors right now?
> - Web design / sales / SEO / content, rate yourself 1 to 5 on each.
> - What does "this worked" look like in 12 months, number?
>
> **When all 7 sections are covered, output the Student Profile in the exact template below. Then hand off to Module 2.**

### Output template, Student Profile

```
STUDENT PROFILE, [Name]

Lived industries (inside knowledge):
1. [industry], [how they know it], [years]
2. ...

Hard skills (proven, not aspirational):
- [skill], [evidence]

Soft assets:
- Network in: [list]
- Trusted in communities: [list]
- Reputation / portfolio: [what they already have]

Pattern recognition (where they see opportunities):
- [industry/problem], [the insight]

Filters:
- Will work with: [profiles]
- Won't work with: [profiles]
- Geographic/cultural lean: [...]

Resources:
- Time: [hrs/week]
- Capital: [$]
- Skill self-scores: design [/5], sales [/5], SEO [/5], content [/5]

12-month target: [$ or # of clients]

Raw niche candidates surfaced in this interview:
- [niche 1], [why it came up]
- [niche 2], [why it came up]
- [niche 3], [why it came up]
- [niche 4], [why it came up]
- [niche 5], [why it came up]
```

---

## MODULE 2, NICHE SCORING & SELECTION

Anchored to the niche-scoring framework. The student lists 5 candidate niches (from Module 1's raw list, plus any wildcards), scores each, and picks 3 for deep research.

### Scoring sheet (1 to 5 each, total /35)

| Factor | What it means | Scoring guide |
|---|---|---|
| **Existing experience** | Has the student already worked in/around this niche? | 1 = total stranger, 5 = lived it for years |
| **Ticket size** | What's an average customer worth to the business? | 1 = restaurant ($20 ticket), 5 = roofer/dentist/surgeon ($5k+ ticket) |
| **Industry size** | Big enough for cashflow, small enough to dominate. Prefer blue-ocean over saturated red-ocean. | 1 = trampoline parks, 3 = dentists (red ocean but huge), 5 = sweet spot blue ocean |
| **Recession-proof** | Does this niche survive a downturn? | 1 = trampoline parks (most shut down in COVID), 5 = insurance, legal, medical |
| **Standardized blueprint** | Can one website strategy work for 90% of businesses in this niche? | 1 = every business is unique, 5 = template fits all |
| **Cons / regulation drag** | Legal jargon, HIPAA, ad restrictions, sensitive copy. Lean away from these. | 1 = heavy (legal, pharma, finance), 5 = light (home services, trades) |
| **Network/access fit** | Does the student already know people here, or can they reach them cheaply? | 1 = cold, 5 = warm contacts ready |

### Decision rule

1. Score all 5 candidates.
2. Drop anything below 18 total or with a 1 in **ticket size**.
3. Of the top 3, run the research checklist below before final pick.

### Research checklist (per finalist niche)

**A. Existing niche agencies**, Find 5 to 10 agencies serving this niche. For each, log 5 to 10 bullets: pros, cons, approach, pricing, what they sell (results vs. features).

**B. Niche customer behavior**, Do their customers research before buying? Is it a big trust commitment? Rule: high-research, high-commitment purchases benefit most from a great website.

**C. Where the niche hangs out**, Facebook groups, LinkedIn, IG, forums, trade shows.

**D. Money math**, Average ticket × close rate × leads needed = realistic ROI. Can you sell a $5 to 15k website with a straight face?

### Output template, Niche Decision

```
NICHE FINALISTS, SCORED

| Niche | Exp | Tkt | Size | Rec | SOP | Cons | Net | TOTAL |
| ... | / | / | / | / | / | / | / | /35 |

TOP 3 (after research):
1. [niche], score X, chosen because [...]
2. [niche], score X, backup because [...]
3. [niche], score X, third because [...]

CHOSEN NICHE: [the one]

Why this one over the others:
- [reason 1]
- [reason 2]
- [reason 3]

Niche customer reality check:
- They research before buying: yes/no
- Average ticket: $___
- They hang out at: [where]
- A $5 to 15k website ROI math: [show the math]

5 example businesses in this niche I could approach this week:
- [name 1], [URL], [why]
- ...
```

---

## MODULE 3, NICHE-SPECIFIC OFFER CRAFTING

Anchored to the offer-crafting framework + $100M Offers framing.

### Step 1, Reframe what you're really selling

> **"I help [niche owner] win the trust of [their end customer] who is [their decision moment] so they choose [niche owner] over the competition."**

Examples:
- *Hair transplant clinics:* "I help hair transplant clinics win the trust of patients considering a FUE or FUT so they choose this clinic over the competition."
- *Roofers:* "I help roofing companies win the trust of homeowners staring at a $15k roof bill so they choose this roofer over the four others quoting them."
- *Med spas:* "I help med spas win the trust of women researching their first injectables so they walk into this clinic instead of the one down the road."

Public Q&A benchmark for the one-liner: *"I build high-converting websites for painters."*

### Step 2, Stage check

| Stage | Offer shape |
|---|---|
| **No portfolio at all** | "I'll design your homepage upfront, for free. If you love it, you pay. If not, you walk." |
| **1 to 3 free pieces done** | Free design upfront → paid on approval → deposit + payment plan after |
| **Real portfolio + 1 to 2 case studies** | Deposit upfront, payment plan, charge what you're worth |
| **Established** | $15k+ flat, no apology, value-priced on results |

### Step 3, Build the cold DM / email

```
Hey [first name],

[Hyper-personal observation, something specific you noticed about their business, their latest case, their post. NOT "I love your work."]

I've been studying [niche] websites for a while, and I think [specific business name] is sitting on missed opportunities, specifically [name 1 to 2 things you'd actually change, e.g. "no before/after gallery above the fold," "no trust badges near the CTA"].

I've worked out a strategy that's already winning for [adjacent niche / similar business / your own case study]. The basics: [trust elements] + [conversion elements] + [SEO angle], built specifically for [end customer's decision moment].

Here's the deal, to show you how confident I am that I can make a real change to what people think about [their business], I'll put the work in upfront at no cost to you. No upfront risk, all upside.

If I waste your time, I'll personally send you a $25 Starbucks gift card so you can have a coffee on me. At least let me show you where I see the missed opportunities.

[Your name]
```

### Step 4, Iterate before launching

Write 3 versions (short / medium / long), personalize each for a real prospect from Module 2's "5 example businesses," and critique for specificity.

### Output template, Offer Pack

```
OFFER PACK, [niche]

Core positioning sentence:
"I help [niche] win the trust of [end customer] who is [decision moment] so they choose [niche owner] over the competition."

One-line public offer (for IG bio / agency homepage):
"[I build high-converting websites for [niche]]"

Stage of business: [no portfolio / some / portfolio / established]

Offer mechanics:
- Risk reversal: [free upfront / deposit / etc.]
- Price anchor: [show 3-tier package, they buy the middle]
- Payment terms: [deposit + plan / flat / etc.]

Cold DM, short:
[...]

Cold DM, medium:
[...]

Cold DM, long (with strategy preview):
[...]

First 5 prospects to send to this week:
1. [name], [DM platform], [personalization angle]
...
```

---

## MODULE 4, LOAD WEBSITE FACTORY STRUCTURE

**Purpose:** Before writing the brief, the system must understand exactly what the Website Factory expects as input. This step is internal, no artifact is produced for the student. The system just confirms it knows the Factory's intake spec.

### System prompt for this step

> You're about to produce a handoff brief for the Website Factory project. Before you draft the brief:
>
> 1. Search this project's knowledge for `Website_Factory_Structure` and read it in full.
> 2. Extract and confirm in your own words:
>    - What the Website Factory's job is (what does it produce as output?)
>    - What input fields it requires (the exact intake template)
>    - What format/structure those fields must be in
>    - Any niche-specific decisions the Factory needs from the brief (which trust elements, which keywords, which CTAs, etc.)
>    - Any non-negotiable defaults the Factory will apply regardless of the brief
> 3. Output a short confirmation block (4 to 8 lines max) showing you've understood the structure. Do NOT produce the brief yet, that's Module 5.
> 4. If `Website_Factory_Structure.md` cannot be found in project knowledge, STOP. Tell the user: *"I can't produce a Website Factory Brief until `Website_Factory_Structure.md` is added to this project's knowledge. See Appendix A for the template."*

### Output, Structure confirmation

```
WEBSITE FACTORY STRUCTURE LOADED

Factory's job: [1 sentence, what it produces]

Required intake fields: [list, in order]

Niche-specific decisions the brief must make:
- [decision 1]
- [decision 2]
- ...

Factory defaults (no need to specify in brief):
- [default 1]
- ...

Ready to produce Website Factory Brief. Proceeding to Module 5.
```

---

## MODULE 5, WEBSITE FACTORY BRIEF GENERATOR

**Purpose:** Take the Student Profile (M1), Niche Decision (M2), Offer Pack (M3), and Factory Structure (M4), and produce a brief in the exact intake format the Factory expects.

### System prompt for this step

> Using:
> - The Student Profile from Module 1
> - The Niche Decision from Module 2
> - The Offer Pack from Module 3
> - The Website Factory intake spec confirmed in Module 4
>
> Produce a Website Factory Brief. The brief MUST match the field structure confirmed in Module 4. Do not improvise fields. Do not include fields the Factory doesn't ask for.
>
> Where the Factory asks for niche-specific decisions, pull from Module 2's research and Module 3's positioning. If a required field has no source data from prior modules, flag it explicitly with `[MISSING, needs input from operator]` rather than guessing.

### Output template, Website Factory Brief

> *The exact shape of this output depends on what your `Website_Factory_Structure.md` specifies as the intake format. Below is a **default template** to use if your structure doc is silent on a particular field, adjust to match.*

```
WEBSITE FACTORY BRIEF, [Student Name] / [Niche] / [Client Name if applicable]

============================================
INTAKE METADATA
============================================
Submitted by: [student name]
Submitted on: [date]
Project type: [new build / rebuild / homepage-only / etc.]
Target launch: [date]

============================================
THE CLIENT (the business the website is for)
============================================
Business name: [...]
Niche: [from M2]
Location(s): [...]
Decision-maker: [name, role]
Their current website: [URL or "none"]
What they're already doing well: [...]
What they're missing: [...]

============================================
THE STRATEGY (from M2 + M3)
============================================
Positioning sentence (what the website is really selling):
"[from M3 Step 1]"

End customer (who the website needs to convert):
- Profile: [demographics, decision moment, fears]
- What they research before buying: [...]
- Where they research: [...]

Competitor strategy summary (from M2 research):
- What working competitors do: [trust elements / conversion mechanics they use]
- Where they fall short (our opportunity): [...]

============================================
NICHE-SPECIFIC DECISIONS (for the Factory's SOPs)
============================================
Trust elements priority order (for this niche):
1. [e.g., before/after gallery, highest priority for hair transplant]
2. [e.g., doctor credentials, second]
3. ...

Trust assets to gather from client during onboarding:
- [reviews / case studies / before-and-afters / press / team photos / certs]

Traffic / SEO targets:
- Primary keywords: [...]
- Secondary keywords: [...]
- Service-area pages needed: [list]
- Service pages needed: [list]
- GBP optimization: [yes/no + notes]

Conversion mechanics for this niche:
- Primary CTA: [e.g., "Book a Free Consultation"]
- Secondary CTA: [e.g., "Download Patient Guide"]
- Email magnet idea: [...]
- Contact form fields: [list]
- Niche-specific friction points to avoid: [...]

============================================
PROOF & ASSETS AVAILABLE
============================================
Existing case studies: [list with results]
Existing testimonials: [list]
Existing portfolio pieces: [URLs]
Press / media: [list]
Founder personal brand assets: [if relevant]

============================================
OPERATOR NOTES
============================================
Stage of business (from M3): [...]
Pricing for this project: [...]
Risk reversal in the sold offer: [...]
Special promises made in the sale: [...]
Anything the Factory should NOT do: [...]

============================================
HANDOFF
============================================
[MISSING] flags (fields with no source data, operator must fill):
- [field], [reason missing]

Open questions for the Factory team:
- [...]
```

---

## MODULE 6, LOAD CONTENT ENGINE STRUCTURE

**Purpose:** Parallel to Module 4. Before writing the Content Engine Brief, the system reads the Content Engine's structure doc and confirms it understands the intake spec.

### System prompt for this step

> You're about to produce a handoff brief for the Content Engine project. Before you draft the brief:
>
> 1. Search this project's knowledge for `Content_Engine_Structure` and read it in full.
> 2. Extract and confirm in your own words:
>    - What the Content Engine's job is (what content does it produce?)
>    - What input fields it requires (the exact intake template)
>    - What format those fields must be in
>    - What voice/style/tone metadata it expects
>    - What content types it produces (DMs, blogs, social, email sequences, etc.)
>    - Any cadence/channel constraints
> 3. Output a short confirmation block (4 to 8 lines max). Do NOT produce the brief yet, that's Module 7.
> 4. If `Content_Engine_Structure.md` cannot be found, STOP. Tell the user: *"I can't produce a Content Engine Brief until `Content_Engine_Structure.md` is added to this project's knowledge. See Appendix A for the template."*

### Output, Structure confirmation

```
CONTENT ENGINE STRUCTURE LOADED

Engine's job: [1 sentence]

Required intake fields: [list]

Content types it produces: [list]

Voice/style metadata it expects: [list]

Cadence/channel constraints: [...]

Ready to produce Content Engine Brief. Proceeding to Module 7.
```

---

## MODULE 7, CONTENT ENGINE BRIEF GENERATOR

**Purpose:** Take all prior modules' outputs + the Content Engine's structure (from M6), and produce a brief in the format the Engine expects.

### System prompt for this step

> Using:
> - The Student Profile from Module 1
> - The Niche Decision from Module 2
> - The Offer Pack from Module 3
> - The Content Engine intake spec confirmed in Module 6
>
> Produce a Content Engine Brief that matches the field structure confirmed in Module 6. Do not improvise fields. Do not include fields the Engine doesn't ask for. Flag missing data explicitly with `[MISSING, needs input from operator]`.

### Output template, Content Engine Brief

> *Default template below. Adjust to match your `Content_Engine_Structure.md`.*

```
CONTENT ENGINE BRIEF, [Student Name] / [Niche]

============================================
SECTION 1: WHO IS BEHIND THE BRAND
============================================
Operator: [name]
Lived experience that earns the right to talk about this niche:
- [bullet]
- [bullet]

Personal angle / origin story (the "why this niche"):
[1 paragraph]

Voice notes:
- Register: [casual / professional / technical / blunt / warm]
- Phrases the operator naturally uses: [list]
- Things the operator would never say: [list]

============================================
SECTION 2: WHO WE SERVE
============================================
Niche: [niche]
The ideal client (ICP):
- Business type: [...]
- Size: [revenue, team, ticket range]
- Stage signals: [doing word-of-mouth, has reviews, not ranking yet]
- Where they hang out: [Facebook groups / LinkedIn / forums / IRL events]
- Decision-makers we talk to: [owner / marketing manager / etc.]

The end customer (their customer):
- Demographics: [...]
- Decision moment: [...]
- What they're afraid of: [...]
- What they research before buying: [...]
- Where they research: [...]

============================================
SECTION 3: THE OFFER
============================================
Positioning sentence: "[from M3]"
Public one-liner: [...]
What we actually deliver: [...]
Pricing: [...]
Risk reversal: [...]

============================================
SECTION 4: PROOF & ASSETS
============================================
Case studies: [list with results]
Testimonials: [list]
Portfolio: [list with links]
Founder personal brand assets: [IG, LinkedIn, YouTube, etc.]

============================================
SECTION 5: CONTENT PILLARS (for this niche)
============================================
Pillar 1, Trust-building:
  Topics: [...]
  Sample hooks: [...]

Pillar 2, Industry education:
  Topics: [...]
  Sample hooks: [...]

Pillar 3, Behind-the-scenes / case studies:
  Topics: [...]
  Sample hooks: [...]

Pillar 4, Niche-specific pain points:
  Topics: [...]
  Sample hooks: [...]

============================================
SECTION 6: KEYWORDS (from M5 brief)
============================================
Primary: [...]
Secondary / long-tail: [...]
Geographic targets: [...]

============================================
SECTION 7: HANDOFF NOTES
============================================
[MISSING] flags:
- [field], [reason missing]

Cadence: [posts/week, channels, repurposing strategy]
Banned topics / off-limits: [...]
Open questions for the Content Engine team: [...]
```

---

## APPENDIX A, Structure Overview Templates

These are meta-templates. Fill one out for each downstream project and drop it into this project's knowledge as `Website_Factory_Structure.md` and `Content_Engine_Structure.md`.

### Template: `Website_Factory_Structure.md`

```
# Website Factory, Structure Overview

## What the Factory does
[1 to 2 sentences. What goes in, what comes out. E.g., "Takes a niche-specific brief and produces a launched WordPress website with on-page SEO and GBP optimization, in 4 to 6 weeks."]

## Inputs the Factory needs
List every field the Factory's intake form / first-step SOP requires. Be exact about format.

| Field | Format | Required? | Notes |
|---|---|---|---|
| Client business name | Text | Yes | |
| Niche | Text (from approved niche list) | Yes | |
| Positioning sentence | Sentence in "I help [X] win the trust of [Y]..." format | Yes | |
| Trust element priority | Ordered list, top 5 | Yes | |
| Primary keywords | 3 exact-match terms | Yes | |
| ... | ... | ... | ... |

## Decisions the brief must make (vs. Factory defaults)
- The brief MUST decide: [list, e.g., "which trust elements to lead with", "primary + secondary CTA copy"]
- The Factory defaults handle: [list, e.g., "wireframe order", "speed optimization", "schema markup", "QA checklist"]

## Outputs the Factory produces
- [Deliverable 1, e.g., launched WordPress site]
- [Deliverable 2, e.g., GBP optimization]
- [Deliverable 3, e.g., 3 months SEO]

## SOPs that live in the Factory project (not here)
- Trust SOP
- Traffic SOP
- Conversion SOP
- Onboarding SOP
- QA SOP
- Launch SOP

## Handoff format
[How does the brief get into the Factory? Pasted into a Monday.com card? A Google Doc in a client folder? An email to a PM? Spell it out.]
```

### Template: `Content_Engine_Structure.md`

```
# Content Engine, Structure Overview

## What the Engine does
[1 to 2 sentences. What content types in what cadence to which channels.]

## Inputs the Engine needs
| Field | Format | Required? | Notes |
|---|---|---|---|
| Operator name | Text | Yes | |
| Operator voice notes | List of register, phrases, off-limits | Yes | |
| Niche | Text | Yes | |
| ICP profile | Structured (business type, size, stage, location) | Yes | |
| End customer profile | Structured (demographics, decision moment, fears) | Yes | |
| Content pillars | 3 to 5 pillars with topics and sample hooks | Yes | |
| Keywords | Primary + secondary + geographic | Yes | |
| Cadence | Posts/week per channel | Yes | |
| Banned topics | List | Yes | |
| ... | ... | ... | ... |

## Content types the Engine produces
- [e.g., Cold DM scripts]
- [e.g., Weekly social calendar, IG/LinkedIn/TikTok]
- [e.g., SEO blog posts from keyword list]
- [e.g., Email sequences for magnets]
- [e.g., Sales call talking points]
- [e.g., Case study write-ups]

## Voice/style enforcement
[How the Engine maintains consistent voice. Style guide? GPT system prompt? Tone-checker? List the mechanism.]

## SOPs / workflows that live in the Engine project
- Content idea generation
- Content workflow (write → edit → publish → repurpose)
- Viral content pulls from competitors
- Personal brand DM workflow

## Handoff format
[How does the brief get into the Engine? Notion intake? GPT prompt? Spell it out.]
```

> Appendix B (Universal CRO SOPs) lived here in the original draft. It has been moved to `website-factory/references/cro-sops/universal-cro-sops.md` where it belongs as factory reference material. The factory reads it during `/tailor-factory`.

## APPENDIX C, Source Mapping (AIW → System)

| Module here | AIW lesson area it draws from |
|---|---|
| 1, Interview | Foundational discovery, synthesizes positioning + niche-scoping into a single interview |
| 2, Niche Scoring | Niche-selection methodology |
| 2, Niche Research | Competitor research + market research |
| 3, Offer Crafting | Offer construction, cold-outreach DM patterns, website audit framework |
| 4, Load WF Structure | Bridges Research System to the Website Factory project |
| 5, WF Brief | Synthesizes M1 to M3 into Factory intake |
| 6, Load CE Structure | Bridges Research System to the Content Engine project |
| 7, CE Brief | Synthesizes M1 to M3 into Engine intake |
| Appendix B (move out) | Universal CRO patterns, SEO architecture, content writing standards, sales-call patterns |

---

## DEPLOYMENT NOTES

**To run as a Claude Project:**
1. Create the Research System project.
2. Drop into project knowledge:
   - This doc
   - The AIW transcript files
   - `Website_Factory_Structure.md` (filled from Appendix A)
   - `Content_Engine_Structure.md` (filled from Appendix A)
3. Custom instructions: *"You are running the Student Research System. Run Modules 1 → 7 in sequence. Complete each module's output template before moving on. For Modules 4 and 6, you MUST search project knowledge for the structure doc and confirm understanding before proceeding to the brief. Never invent fields in Modules 5 or 7 that aren't in the loaded structure."*
4. Each student conversation runs Modules 1 → 7, producing 5 artifacts and 2 confirmations.

**Setup order for the 3 projects:**
1. Set up Website Factory project first, move Appendix B's SOPs in, build the intake form. Then write `Website_Factory_Structure.md` based on what you actually built.
2. Set up Content Engine project, its operating manual, workflows, GPTs. Then write `Content_Engine_Structure.md`.
3. Drop both structure docs into the Research System project. Now Modules 4 and 6 have something to load.

**Things to refine after first 3 to 5 students:**
- Which interview questions consistently surface usable niches? Cut what doesn't.
- Which niches keep winning the scoring? Build niche addenda for those.
- Do the briefs produced in M5 and M7 actually flow cleanly into the downstream projects, or are there fields missing / fields ignored? Update the structure docs accordingly.
