/**
 * Realistic stub responses for every Claude operation.
 * Used when ANTHROPIC_API_KEY is missing so the entire app is testable
 * without burning a single token. Keep these convincing — they are what
 * the student and the demo audience see during dev.
 */

import type {
  ContextSummary,
  ExpertBrainSeed,
  GeneratedScript,
  GenerationInput,
  HookFormula,
  IdeaProposal,
  IdeationInput,
  NicheProposal,
  PostMortem,
  RadarSeed,
  RadarSuggestion,
  ScriptFormat,
} from "./types"

const HOOK_FORMULAS: HookFormula[] = [
  "contrarian",
  "curiosity_gap",
  "pain_point",
  "secret_value",
  "time_bound_result",
  "mistake_callout",
  "numbered_list",
]

const REEL_TEMPLATES: Array<(niche: string) => Omit<GeneratedScript, "hook_formula" | "topic" | "angle">> = [
  (niche) => ({
    hook: `Most ${niche} are doing this wrong, and it's killing their leads.`,
    body: `Here's the thing nobody tells you about ${niche}. The old playbook is broken. Three weeks ago I tested a new approach with one of my clients. We changed one variable. Lead flow doubled in seven days. The variable: stop chasing volume, chase relevance. One specific avatar, one specific offer, one specific lead magnet. That's it.`,
    cta: "Comment WEB and I'll send you the full breakdown.",
    full_script: "",
    caption: "If you're in the trenches with this, you'll want this one. Comment WEB.",
    keyword: "WEB",
    hashtags: ["#trades", "#agencyowner", "#leadgen", "#smallbusiness"],
    target_length_s: 25,
  }),
  (niche) => ({
    hook: "I lost $40k chasing the wrong avatar last year.",
    body: `True story. I spent $40k on ads targeting every ${niche} in the country. Conversion rate: 0.3%. Then I narrowed to one specific persona. Same offer. Same ad spend. Conversion rate: 4.2%. The lesson: you do not have a marketing problem. You have a clarity problem. Pick one person you can describe by name and write everything to them.`,
    cta: "Comment AVATAR for the worksheet I use.",
    full_script: "",
    caption: "Most painful lesson of last year. Saving you the $40k. Comment AVATAR.",
    keyword: "AVATAR",
    hashtags: ["#agency", "#marketing", "#mistakes", "#lessonlearned"],
    target_length_s: 28,
  }),
  (niche) => ({
    hook: "Here's the one DM template that books 30% of my sales calls.",
    body: `Stop sending five-paragraph DMs. Here's what actually works. One: open with their first name and one specific compliment about their last post. Two: ask one question they want to answer. Three: shut up. Send it. The 30% book rate is from real data across 200 outreach DMs in the last 60 days. Try it on your next ten and tell me your numbers.`,
    cta: "Comment DM and I'll send you the exact template.",
    full_script: "",
    caption: "Three lines. 30% book rate. Save this. Comment DM.",
    keyword: "DM",
    hashtags: ["#sales", "#outbound", "#agency", "#dms"],
    target_length_s: 22,
  }),
  (niche) => ({
    hook: `If you're a ${niche} doing under $20k a month, this is for you.`,
    body: "I see the same three problems every time I audit accounts under $20k MRR. One: the offer is too vague. Two: there is no clear next action on the website. Three: the founder is doing 80% of the work that should be delegated. Fix those three in 30 days and you double. I have personally seen this happen with seven clients this quarter alone.",
    cta: "Comment AUDIT for the 30-day fix list.",
    full_script: "",
    caption: "The 3 things killing your MRR right now. Honest audit. Comment AUDIT.",
    keyword: "AUDIT",
    hashtags: ["#agencylife", "#mrr", "#founder", "#scaling"],
    target_length_s: 30,
  }),
  (niche) => ({
    hook: "Stop building courses. Start building systems.",
    body: `Every ${niche} I know is trying to make a $497 course. The math doesn't work. You need 200 sales for a $100k year. You need maybe 8 retainer clients at $1k a month for the same. The course is a treadmill. The retainer is a base. Build the system that gets you eight retainer clients. The course can come later, when you actually have something to teach.`,
    cta: "Comment SYSTEM for the retainer framework.",
    full_script: "",
    caption: "Honest take. The course economy is a trap for most. Comment SYSTEM.",
    keyword: "SYSTEM",
    hashtags: ["#course", "#retainer", "#agency", "#founder"],
    target_length_s: 27,
  }),
]

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length]
}

export function stubGenerateIdeas(input: IdeationInput): IdeaProposal[] {
  const niche = input.business.niche ?? "creators"
  const out: IdeaProposal[] = []
  for (let i = 0; i < input.count; i++) {
    const formula = pick(HOOK_FORMULAS, i)
    const topics = [
      `What most ${niche} get wrong about lead gen`,
      `The one offer change that doubled my close rate`,
      `Why $40k in ads taught me clarity beats volume`,
      `The KEYWORD CTA that flips strangers into leads`,
      `5 signals you're chasing the wrong avatar`,
      `What I'd do with my first 30 days back`,
      `The mistake every ${niche} makes after their first win`,
      `One slide of context, three years of pain`,
      `Selling without sounding like a vendor`,
      `When the lead magnet is the problem`,
    ]
    const t = pick(topics, i)
    if (input.format === "reel") {
      out.push({
        id: `idea-stub-${i}`,
        format: "reel",
        topic: t,
        angle: `Counter-intuitive: most advice in this space is wrong because it ignores [specific avatar pain].`,
        hook: `Most ${niche} are doing this wrong, and it's killing their leads.`,
        hook_formula: formula,
        why_it_works: `Pattern interrupt + identity threat. Targets the creator's avatar directly.`,
      })
    } else if (input.format === "long_form") {
      out.push({
        id: `idea-stub-${i}`,
        format: "long_form",
        title: t,
        topic: t,
        angle: `5-section breakdown with a contrarian framing in section 2.`,
        why_it_works: `Anchored on a measurable outcome the avatar can repeat themselves.`,
      })
    } else {
      out.push({
        id: `idea-stub-${i}`,
        format: input.format,
        topic: t,
        angle: `Open with the painful version of the problem before the framework lands.`,
        why_it_works: `Pain-first framing increases save and share rates.`,
      })
    }
  }
  return out
}

export function stubGenerateScripts(
  input: GenerationInput
): GeneratedScript[] {
  const niche = input.business.niche ?? "creators"
  const out: GeneratedScript[] = []

  for (let i = 0; i < input.count; i++) {
    if (input.format === "reel") {
      const tmpl = pick(REEL_TEMPLATES, i)(niche)
      const formula = pick(HOOK_FORMULAS, i)
      const fullScript = `${tmpl.hook}\n\n${tmpl.body}\n\n${tmpl.cta}`
      out.push({
        ...tmpl,
        full_script: fullScript,
        hook_formula: formula,
        topic: tmpl.hook.split(" ").slice(0, 4).join(" "),
        angle: ["story", "contrarian-take", "framework", "audit"][i % 4],
      })
    } else if (input.format === "carousel") {
      out.push(stubCarousel(niche, i))
    } else {
      out.push(stubStorySequence(niche, i))
    }
  }
  return out
}

function stubCarousel(niche: string, i: number): GeneratedScript {
  const slides = [
    { order: 1, text: `5 things every ${niche} should stop doing today`, on_screen: "Big bold title", image_prompt: "Bold sans-serif title on dark bg" },
    { order: 2, text: "1. Trying to please everyone — pick one avatar.", on_screen: "Single point", image_prompt: "Minimal one-line text on dark bg" },
    { order: 3, text: "2. Posting without a CTA. Every post earns a DM.", on_screen: "Single point", image_prompt: "Same as above" },
    { order: 4, text: "3. Confusing pricing. Make it dead simple.", on_screen: "Single point", image_prompt: "Same as above" },
    { order: 5, text: "4. Hiding behind anonymous brand accounts. Show your face.", on_screen: "Single point", image_prompt: "Same as above" },
    { order: 6, text: "5. Working in your business instead of on it.", on_screen: "Single point", image_prompt: "Same as above" },
    { order: 7, text: "Save this for the next time you sit down to plan content.", on_screen: "CTA", image_prompt: "Save + share callout" },
    { order: 8, text: "Comment LIST and I'll send you the audit checklist.", on_screen: "Comment CTA", image_prompt: "Bold CTA on dark bg" },
  ]
  return {
    hook: slides[0].text,
    hook_formula: pick(HOOK_FORMULAS, i),
    body: slides.map((s) => s.text).join("\n"),
    cta: slides[slides.length - 1].text,
    full_script: slides.map((s) => `[Slide ${s.order}] ${s.text}`).join("\n"),
    caption: `Save this carousel. Comment LIST for the full audit checklist.`,
    keyword: "LIST",
    hashtags: ["#carousel", "#agencyowner", "#smallbusiness", "#audit"],
    topic: "audit checklist",
    angle: "numbered list",
    target_length_s: 0,
    slides,
  }
}

function stubStorySequence(niche: string, i: number): GeneratedScript {
  const frames = [
    { order: 1, text: `${niche}: this changes how you post forever`, on_screen: "Hook frame", image_prompt: "Bold frame with talking head" },
    { order: 2, text: "I tested it for 30 days...", on_screen: "Build curiosity", image_prompt: "Phone screen with notebook" },
    { order: 3, text: "Quiz: have you tried this approach?", on_screen: "Poll sticker", image_prompt: "Yes/No sticker frame" },
    { order: 4, text: "Here's what worked: one CTA per post.", on_screen: "Reveal", image_prompt: "Single sentence on screen" },
    { order: 5, text: "DM me KEYWORD or tap up to see the breakdown.", on_screen: "CTA", image_prompt: "Swipe-up frame" },
  ]
  return {
    hook: frames[0].text,
    hook_formula: pick(HOOK_FORMULAS, i),
    body: frames.map((f) => f.text).join("\n"),
    cta: frames[frames.length - 1].text,
    full_script: frames.map((f) => `[Frame ${f.order}] ${f.text}`).join("\n"),
    caption: "Story sequence. Save it for tomorrow's posting block.",
    keyword: "STORY",
    hashtags: ["#storysequence", "#contentstrategy", "#agency"],
    topic: "story experiment",
    angle: "experiment + reveal",
    target_length_s: 60,
    slides: frames,
  }
}

export function stubSummariseContent(input: {
  raw: string
  source_type: string
}): ContextSummary {
  const firstLine = (input.raw || "").split(/\n|\.\s/).filter(Boolean)[0] ?? ""
  const summary = [
    `Source type: ${input.source_type}`,
    `Lead bullet: ${firstLine.slice(0, 140)}`,
    "Captures core argument or hook in one sentence.",
    "Highlights the strongest claim or takeaway.",
    "Notes the implied audience and tone.",
  ].join("\n- ")

  const words = (input.raw || "")
    .toLowerCase()
    .match(/[a-z]{4,}/g) ?? []
  const freq: Record<string, number> = {}
  for (const w of words) freq[w] = (freq[w] || 0) + 1
  const tags = Object.entries(freq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([w]) => w)

  return {
    summary: `- ${summary}`,
    tags: tags.length > 0 ? tags : ["stub", "demo", "context"],
  }
}

export function stubProposeNiche(_answers: Record<string, string>): NicheProposal {
  return {
    niche: "Roofing companies in the southern United States",
    avatar:
      "Owner-operator roofing company doing $1M-$5M in revenue, 5-20 employees, currently inconsistent on lead flow, frustrated with marketing agencies that overpromise.",
    offer:
      "AI-built websites with lead funnels and automated follow-up sequences for $4500 cash or $5000 in two installments.",
    voice_tone:
      "Direct, no-fluff, profanity-friendly when it lands, regional southern American, talks to the operator like a peer not a prospect.",
  }
}

export function stubProposeRadarSeed(_niche: string): RadarSeed {
  return {
    hashtags: [
      { platform: "instagram", value: "#roofingcompany" },
      { platform: "instagram", value: "#roofingbusiness" },
      { platform: "instagram", value: "#contractormarketing" },
      { platform: "instagram", value: "#agencyowner" },
      { platform: "instagram", value: "#aiagency" },
      { platform: "instagram", value: "#leadgen" },
      { platform: "instagram", value: "#smb" },
      { platform: "instagram", value: "#websitedesign" },
      { platform: "instagram", value: "#funnels" },
      { platform: "instagram", value: "#localseo" },
    ],
    creator_handles: [
      { platform: "instagram", value: "@hormozi" },
      { platform: "instagram", value: "@charliemorgan" },
      { platform: "instagram", value: "@codykerns" },
      { platform: "instagram", value: "@officialalexberman" },
      { platform: "instagram", value: "@codysanchez" },
      { platform: "instagram", value: "@example_agency_owner" },
      { platform: "instagram", value: "@iman_gadzhi" },
      { platform: "instagram", value: "@brettkylelarkin" },
      { platform: "instagram", value: "@brookecastillo" },
      { platform: "instagram", value: "@noahkagan" },
    ],
  }
}

export function stubProposeExpertBrain(_niche: string): ExpertBrainSeed {
  return {
    sources: [
      {
        title: "$100M Offers — Alex Hormozi",
        url: "https://www.youtube.com/watch?v=pQ2vGl-pELU",
        reason: "Definitive offer construction framework. Used for offer hypothesis.",
      },
      {
        title: "Charlie Morgan agency YouTube channel",
        url: "https://www.youtube.com/@CharlieMorgan",
        reason: "Agency operator who has dialed paid ad funnels. Useful for ads.",
      },
      {
        title: "Iman Gadzhi YouTube",
        url: "https://www.youtube.com/@ImanGadzhi",
        reason: "Cold outbound playbook for SMMA. Applies one-to-one to AIW.",
      },
      {
        title: "Donald Miller — Building a StoryBrand",
        url: "https://www.youtube.com/watch?v=lwSP3VNSf_8",
        reason: "Clear messaging framework. Applies to website copy + reel hooks.",
      },
      {
        title: "Justin Welsh — Solopreneur newsletter",
        url: "https://www.justinwelsh.me",
        reason: "Premium content frameworks for one-person creators.",
      },
    ],
  }
}

export function stubRadarSuggestion(_input: {
  caption: string
  transcript: string
  metrics: Record<string, unknown>
}): RadarSuggestion {
  return {
    why: "This reel is heating up because it names a specific dollar amount and a specific timeframe in the first three seconds. The audience leans in to verify or refute the claim.",
    hook_idea:
      "I added $40k MRR in 30 days using one offer change. Here is the change.",
    hook_formula: "time_bound_result",
  }
}

export function stubPostMortem(_input: {
  hook: string
  hook_formula: HookFormula
  views: number
  median: number
}): PostMortem {
  return {
    text:
      "Hook landed because it named a specific outcome in the first three seconds. The body delivered on the promise without padding. Replicate the structure: specific result → specific cause → specific next action.",
  }
}

export function stubFormat(_format: ScriptFormat): ScriptFormat {
  return _format
}
