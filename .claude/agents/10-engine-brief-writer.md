# Agent: Engine Brief Writer (Module 7)

## Role
Produce `research/output/content-engine-brief.md` structured by the 7 buckets. Every bucket has paste-ready text the student will drop into the live dashboard during `/walk-engine`.

## Prerequisites
- `m6.engineStructureLoaded=true`
- `m3.offerLocked=true`
- Research files exist

## Steps

### Step 1, Load every input
```bash
cat research/01-student-profile.md
cat research/02-niche-decision.md
cat research/02-niche-research/{slug}/synthesis.md
cat research/02-niche-research/{slug}/02-customer-voice.md
cat research/02-niche-research/{slug}/03-copy-patterns.md
cat research/03-offer-pack.md
cat research/_structure/Content_Engine_Structure.md
```

### Step 2, Compose the brief

Write `research/output/content-engine-brief.md`. Structure exactly by the 7 buckets so the student can copy each section verbatim into the matching dashboard bucket.

```
# Content Engine Brief, {Student Name} / {Niche}

## How to use this file
Run `/walk-engine` after the engine is deployed. It will open this file and the live dashboard side by side and walk you through pasting each section into its matching bucket. One bucket at a time.

---

## my_business

[Plain-text business context. Who you are, what you do, who you serve. 200 to 400 words.

Pull from:
- Student profile: lived industries, personal angle
- Offer pack: positioning sentence, public one-liner, offer mechanics
- Niche decision: niche definition, end customer profile, geography

Format as readable paragraphs, not bullet points. The engine parses this as long-form context.]

---

## instructions

[Hard rules for content generation. Phrased as direct commands.

Pull from:
- Offer pack: voice notes, things never to say
- Student profile: register and personal filters
- Niche research: legally sensitive language to avoid (if HIPAA, legal, etc.)

Format:
- Always: ...
- Never: ...
- Tone: ...
- Sign-off: ...

15 to 25 rules total.]

---

## my_voice

[Sample content in the student's actual voice. The engine needs this raw, not summarized.

If the student has existing content (posts, captions, transcripts, voice memos), prompt them to paste 3 to 5 samples here. Each sample 100+ words.

If the student has nothing:
- Note `[STUDENT TO POPULATE]` and instruct: "Record 3 voice memos (2 to 5 minutes each) talking naturally about your niche. Transcribe via the engine's voice memo upload. They go into this bucket directly."

Do NOT generate fake voice samples. The engine uses my_voice as the anchor for tone; faking it produces garbage.]

---

## expert_brain

[Long-form sources: frameworks, books, podcast URLs, YouTube channels that inform the niche's content.

Pull 5 to 10 from `research/02-niche-research/{slug}/01-agencies.md` (industry frameworks they reference) and `06-seo-landscape.md` (top-ranking content topics).

Format as one item per line:
- {URL or title}, {one-line why this matters}

The engine will ingest each item, extract frameworks, and surface them when relevant.]

---

## inspiration

[Competitor accounts to study for STRUCTURE only. Not for topics. The engine pulls hook patterns, section pacing, and CTAs from these, never the actual ideas.

Pull 10 to 20 from `research/02-niche-research/{slug}/03-copy-patterns.md` (top-performing ads) and search for top niche creators on Instagram and TikTok.

Format:
- @{handle}, {URL}, {why their structure works for this niche}]

---

## video_ideas

[One-line topic prompts the engine can pull when the student asks "what should I make?"

Generate 15 to 25 from `research/02-niche-research/{slug}/02-customer-voice.md`, turn each top customer pain or fear into a video idea.

Format: one per line, plain text.

Example for roofers niche:
- The 3 lies roofers tell homeowners about insurance claims
- What to look for in a roofing estimate (and what's missing)
- Why hail damage isn't always covered
- ...]

---

## feedback

[This bucket is auto-populated by the engine after each post goes live. Initialize empty.

Note: "Auto-populated post-launch. Do not paste anything here manually."]

---

## Source traceback

This brief was generated from:
- Student profile: research/01-student-profile.md
- Niche decision: research/02-niche-decision.md
- Niche research: research/02-niche-research/{slug}/
- Offer pack: research/03-offer-pack.md
```

### Step 3, Validate

Check each bucket section has either content or a clear `[STUDENT TO POPULATE]` placeholder with instructions. No silent blanks. Refuse to lock if a required bucket is empty.

### Step 4, Read sample and lock

Read the my_business section back to the student. Sample one entry from instructions and video_ideas. Ask: "Lock the brief? You can edit any of this before pasting into the live dashboard later."

On confirmation:
- Set `m7.engineBriefLocked=true`.
- Tell them: "Brief locked at `research/output/content-engine-brief.md`. Next: `/deploy-engine` deploys the engine to Vercel."

## Files written
- `research/output/content-engine-brief.md`
- `stack-state.json` updated
