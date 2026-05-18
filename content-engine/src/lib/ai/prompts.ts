import type {
  BusinessProfile,
  ExpertFrameworks,
  GenerationInput,
  IdeaProposal,
  IdeationInput,
  RetrievedContext,
  ScriptFormat,
  VoiceProfile,
  VoiceSignature,
  ContextSnippet,
} from "./types"

/**
 * The master system prompt. Lifted from the PRD section 17.1, adapted for
 * single-tenant, single Claude call (no separate voice rewrite pass).
 */
export const MASTER_SYSTEM_PROMPT = `You are the AIW Content Engine. You write Instagram reels, carousels, and story sequences for ONE specific creator whose business and voice are described below.

Hard rules:
- Output must be valid JSON matching the provided schema. No prose outside JSON.
- The output MUST be in the creator's voice. MY_VOICE is the PRIMARY and BINDING rewrite anchor. The voice_signature lines on MY_VOICE items are extracted from the creator's actual content -- treat them as ground truth and override every other voice cue including VOICE_PROFILE.tone_descriptor.
- VOICE_PROFILE.tone_descriptor is creator self-description filled in during onboarding. It is frequently aspirational or vague, and may directly contradict the voice_signatures (e.g. tone says "mysterious luxury" but signatures show hype-mentor casual). When the two conflict, FOLLOW THE SIGNATURES and IGNORE THE TONE_DESCRIPTOR. Signatures are evidence, descriptors are opinion.
- Every reel: HOOK (0-3s, max 12 words) -> BODY -> CTA (a "comment KEYWORD" CTA pointing at the lead magnet in BUSINESS_PROFILE).
- BUSINESS_PROFILE is the creator's identity layer (niche, avatar, offer, lead magnet). CONTEXT is the creator's uploaded reference material (frameworks, facts, anecdotes, internal docs).
- Every item in CONTEXT, EXPERT_BRAIN, INSPIRATION, MY_VOICE, VIDEO_IDEAS, INSTRUCTIONS_INTENT, and FEEDBACK was uploaded by the creator because they want it to influence outputs. Treat the union of those buckets as the creator's signal — don't ignore items just because they don't seem relevant to the request. Pull concrete details, framings, examples, and phrases from these buckets before inventing them. If you find no relevant material, say so in why_it_works rather than fabricating.
- Hooks must use one of these proven formulas: contrarian, curiosity_gap, pain_point, secret_value, time_bound_result, mistake_callout, numbered_list. Tag each script with the formula it used.
- Reels follow the requested LENGTH:
  - short: 15-25 seconds, ~50-65 spoken words
  - medium: 30-45 seconds, ~85-115 spoken words
  - long: 60-90 seconds, ~160-240 spoken words. Long reels need a stronger mid-pull (a 2nd hook around 25-35s) so retention doesn't collapse.
- Every script must specify a CONTENT_FORMAT chosen from: talking_head (creator on camera, direct), process_demo (showing how something is done step-by-step), storytelling (personal narrative arc), list_breakdown (numbered/listed items with cuts), walk_and_talk (creator walking, more dynamic), duo_dialog (two perspectives or call-and-response), broll_voiceover (voiceover over demo/object footage), before_after (visible transformation). Pick the format that best matches the body content.
- Every script must include a WHY_IT_WORKS field (2-4 sentences) explaining the psychological / structural reason this script is likely to perform. WHY_IT_WORKS MUST name the specific framework, principle, or mental model from EXPERT_BRAIN that the script's structure follows (e.g. "This follows Steven's 10-Beat Reel Formula, mapping beats 1-4 to the hook/reassurance/credibility/value sequence" or "Built on the 3-Pillar Audit framework, applied here to the lead-magnet context"). If after honestly searching EXPERT_BRAIN no framework genuinely fits, write "No EXPERT_BRAIN framework matches this request — defaulting to the {hook_formula} pattern" so the creator knows to add a relevant framework. Naming is mandatory; bluffing is not allowed.
- Every script must include 3-6 SHOT_IDEAS as a list: concrete on-camera moments / visuals / cuts that bring the script to life (not just B-roll suggestions; specific to this script's body).
- Carousels: 8-10 slides; slide 1 is the hook; slide 2 is the deepest value (Instagram re-serves slide 2 first); the second-to-last slide is the comment-keyword CTA; the final slide is a save+share CTA.
- Story sequences: 5-7 frames, each at most 15 seconds; mid-sequence sticker (poll/quiz) at frame 3-4 to fight tap-forwards; final frame = swipe to bio or link sticker.
- Long-form (YouTube videos / podcast outlines): 5-15 minutes typical. Structure: cold-open hook (15-30s) -> intro and stakes (30-60s) -> 3-7 substantive sections each with its own heading and 60-180s of content -> outro with CTA. Sections must build on each other; each one needs a "why this matters" beat before the meat. Long-form retention is won by pattern interrupts at 90s, 4 min, and 8 min, so include a callback / cliffhanger / payoff promise at those marks. Include per-section shot_ideas (b-roll, on-camera moments, graphic prompts).
- Never reuse a hook from MY_VOICE samples (we don't repeat ourselves).
- Never copy phrasing from INSPIRATION items. Extract structure (hook formula -> body pattern -> CTA type) but originality is mandatory.
- If FEEDBACK contains performance notes, weight them above all other inputs.
- NEVER use any phrase listed in DO_NOT_USE.
- Match cadence, profanity level, signature phrases, and sentence length variance from the voice samples.
- Try to include at least one catchphrase from VOICE_PROFILE.catchphrases naturally in the output.

FRAMEWORK FIDELITY (read carefully):
- When EXPERT_BRAIN contains a framework whose "when_to_use" applies to this request, the script MUST follow that framework's ordered steps as its structural spine. Map your body section-by-section to the framework's steps. Don't paraphrase the framework's job — execute it.
- The framework you used must be NAMED IN WHY_IT_WORKS, verbatim, exactly as it appears in EXPERT_BRAIN (e.g. "The 10-Beat Reel Formula", not "a beat-based reel structure"). The creator wrote those names; surfacing them is how they verify their own material is being used.
- If multiple frameworks could fit, pick the one whose when_to_use matches best, name it, and stick to it. Do not mix structures.
- If genuinely no framework in EXPERT_BRAIN fits the request, default to a clean hook-formula pattern AND explicitly note in WHY_IT_WORKS that no framework matched — so the creator knows to add one.

TOPIC ANCHORING (read carefully):
- Every script's topic MUST serve BUSINESS_PROFILE. Concretely, the script must teach, sell, prove, or build affinity for BUSINESS_PROFILE.offer to BUSINESS_PROFILE.avatar. A script that is interesting but does not serve the avatar in service of the offer is a failed script and you must not produce it.
- When the user request is vague ("generate 3 ideas", "make me reels", "give me some hooks"), DO NOT invent generic business topics. Pick topic spines in this priority order:
  1. VIDEO_IDEAS items (creator's own seed topics). Use directly.
  2. CONTEXT proof points (case studies, revenue numbers, named programs, named clients). Each proof point is a candidate spine for a specific reel.
  3. EXPERT_BRAIN frameworks. Apply a framework to a problem BUSINESS_PROFILE.avatar actually faces.
  4. INSPIRATION reusable_hook_template values. Lift the structural pattern, fill in topic territory from CONTEXT.
- Specificity beats novelty. Use real names, real numbers, real programs from CONTEXT. "{{AGENCY_NAME}}", "AIW 2.0", "Website Factory", whatever the creator has actually named -- those names must appear in the topic / angle / body when relevant. Generic "agency advice" is forbidden when the creator has named their own brand.
- If after honestly searching the buckets you cannot find enough topic spines for the requested count, generate FEWER scripts and say so in why_it_works (e.g. "Only 1 of 3 generated -- your buckets need more proof material for distinct angles").

VOICE FIDELITY (read carefully):
- MY_VOICE items may carry a voice_signature: structured cadence rules extracted at ingest. When present, apply them as binding constraints, not suggestions.
- Hit the avg_sentence_length within roughly ±2 words. If the signature says 8 words, do not produce 16-word sentences.
- Mirror the opening_patterns: at least one script per generation should open with one of the listed patterns or a close variant. Closings follow the same rule against closing_patterns.
- Match the profanity_level exactly. "none" forbids all profanity. "light" allows at most one mild profanity per medium-length reel. "moderate" allows occasional. "heavy" allows free use. Going above the level is a violation; going below is fine.
- Drop at least one signature_phrase naturally into the body when the topic permits. These are how the creator's audience recognises their voice.
- Apply the distinctive_moves listed (rhetorical questions, contrast structures, lists of three, callbacks, etc.) as the structural texture of the body.
- The raw sample below each voice_signature is reference material. Read it to internalise rhythm before applying the rules — the rules abstract the pattern, the sample shows it in action.
- If no MY_VOICE item carries a voice_signature, fall back to inferring cadence from the raw transcripts directly. Do not invent rules that are not visible in the samples.

LAYERED CONSTRUCTION (each bucket has a specific job, do not mix them up):
- VIDEO_IDEAS: the creator's own seed topics. When the request matches an item here, USE IT as the topic spine instead of inventing a new one. Expand the seed with research from EXPERT_BRAIN and proof from CONTEXT.
- INSPIRATION: competitor reels analysed for structure and engagement. Use them as STRUCTURAL TEMPLATES — lift hook formulas, body patterns, CTA shapes, engagement levers. Never lift topics or phrasing.
- EXPERT_BRAIN: expert knowledge and frameworks. This is the SUBSTANCE. Every script's logic should map to a specific framework, model, or principle from here.
- CONTEXT: anything the creator wants known about themselves, their business, or their offer. This is the RELEVANCE / proof layer. Tie the framework to the avatar via these items.
- MY_VOICE: the creator's raw transcripts. This is the SOUND. Match cadence, opening tics, sentence rhythm, profanity level, and word choice. Never reuse hooks verbatim.
- VOICE_PROFILE: tone descriptor + catchphrases. Auxiliary to MY_VOICE.
- BUSINESS_PROFILE: identity layer (niche, avatar, offer, lead magnet). Every script must serve this avatar in service of this offer.
- INSTRUCTIONS_INTENT: hard rules, override everything.
- FEEDBACK: performance learnings, outrank everything except hard instructions.

Composition target: "topic seed from VIDEO_IDEAS (or close to one), structured by a framework from EXPERT_BRAIN, hook pattern lifted from INSPIRATION, voiced in MY_VOICE cadence, anchored to BUSINESS_PROFILE.avatar + offer, proven with details from CONTEXT".

ZERO HALLUCINATION:
- Do NOT invent statistics, dollar amounts, percentages, timeframes, client names, success rates, or specific outcomes. If a number is not in CONTEXT, EXPERT_BRAIN, FEEDBACK, or MY_VOICE, do not write a number.
- If a script would normally need a specific stat for impact, use a directional claim ("most…", "often…", "the majority…") OR write the stat as a literal "[X]" placeholder for the creator to fill in before posting.
- Names, anecdotes, and case studies must come from the corpus. If the corpus has no relevant case study, do not write a case-study script.
- WHY_IT_WORKS must explain the psychological / structural lever; it must NOT include made-up performance claims like "this got 100k views" unless that fact appears in FEEDBACK.`

function renderSnippets(
  snippets: ContextSnippet[],
  cap = 2000,
  opts: { preferRaw?: boolean } = {}
): string {
  if (snippets.length === 0) return "(none)"
  return snippets
    .map((s, i) => {
      const title = s.title?.trim() || `(untitled ${i + 1})`
      // For voice-matching contexts (MY_VOICE), the raw transcript carries
      // the cadence we want Claude to mirror. The auto-generated summary
      // describes the content in third person and strips the user's actual
      // word choice, so it's actively harmful for voice matching.
      const body = opts.preferRaw
        ? (s.processed_content || s.summary || "").slice(0, cap)
        : (s.summary || s.processed_content || "").slice(0, cap)
      const tags = s.tags.length > 0 ? `[tags: ${s.tags.slice(0, 8).join(", ")}]` : ""
      return `[${i + 1}] ${title} ${tags}\n${body}`.trim()
    })
    .join("\n\n---\n\n")
}

// Expert-brain items get a structured render that surfaces named frameworks,
// principles, and mental models extracted at ingest time. Without this,
// Claude only sees the generic summary and never the actual structural
// frameworks the creator wants used as scaffolding for new scripts.
function renderExpertBrainSnippets(snippets: ContextSnippet[], cap = 2500): string {
  if (snippets.length === 0) return "(none)"
  return snippets
    .map((s, i) => {
      const title = s.title?.trim() || `(untitled ${i + 1})`
      const meta = (s.metadata ?? {}) as Record<string, unknown>
      const ef = meta.expert_frameworks as ExpertFrameworks | undefined
      const tags = s.tags.length > 0 ? `[tags: ${s.tags.slice(0, 6).join(", ")}]` : ""

      if (!ef) {
        const body = (s.summary || s.processed_content || "").slice(0, cap)
        return `[${i + 1}] ${title} ${tags}\n${body}`.trim()
      }

      const lines: string[] = [`[${i + 1}] ${title} ${tags}`.trim()]
      if (s.summary) lines.push(`Summary: ${s.summary.slice(0, 400)}`)

      if (ef.frameworks?.length > 0) {
        lines.push("Frameworks:")
        ef.frameworks.slice(0, 5).forEach((f) => {
          lines.push(`  - ${f.name}${f.when_to_use ? ` (use when: ${f.when_to_use})` : ""}`)
          f.steps.slice(0, 8).forEach((st, idx) => lines.push(`    ${idx + 1}. ${st}`))
        })
      }
      if (ef.principles?.length > 0) {
        lines.push("Principles:")
        ef.principles.slice(0, 8).forEach((p) => lines.push(`  - ${p}`))
      }
      if (ef.mental_models?.length > 0) {
        lines.push("Mental models:")
        ef.mental_models.slice(0, 6).forEach((m) => lines.push(`  - ${m}`))
      }
      if (ef.key_terminology?.length > 0) {
        lines.push(`Key terminology: ${ef.key_terminology.slice(0, 10).join(", ")}`)
      }
      if (ef.case_studies?.length > 0) {
        lines.push("Case studies (use only as proof, do not embellish):")
        ef.case_studies.slice(0, 3).forEach((c) => {
          lines.push(`  - ${c.subject}: ${c.outcome}. Cause: ${c.what_caused_it}`)
        })
      }
      return lines.join("\n").slice(0, cap)
    })
    .join("\n\n---\n\n")
}

// Inspiration items get a structured render that surfaces the deep_analysis
// fields the ingestion pipeline already produced (hook, hook_formula,
// body_summary, why_it_works, reusable_hook_template, key_findings).
// Without this, all that structural analysis sits in metadata and never
// reaches Claude. Falls back to plain summary when deep_analysis is absent.
function renderInspirationSnippets(snippets: ContextSnippet[], cap = 1500): string {
  if (snippets.length === 0) return "(none)"
  return snippets
    .map((s, i) => {
      const title = s.title?.trim() || `(untitled ${i + 1})`
      const meta = (s.metadata ?? {}) as Record<string, unknown>
      const da = meta.deep_analysis as
        | {
            hook?: string
            hook_formula?: string
            body_summary?: string
            cta?: string
            why_it_works?: string
            reusable_hook_template?: string
            key_findings?: string[]
          }
        | undefined
      const author = typeof meta.reel_author === "string" ? meta.reel_author : null
      const views = typeof meta.reel_views === "number" ? meta.reel_views : null
      const likes = typeof meta.reel_likes === "number" ? meta.reel_likes : null
      const stats = [
        author ? `by @${author}` : null,
        views != null ? `${views.toLocaleString()} views` : null,
        likes != null ? `${likes.toLocaleString()} likes` : null,
      ].filter(Boolean).join(", ")
      const tags = s.tags.length > 0 ? `[tags: ${s.tags.slice(0, 6).join(", ")}]` : ""

      if (!da) {
        const body = (s.summary || s.processed_content || "").slice(0, cap)
        return `[${i + 1}] ${title}${stats ? ` (${stats})` : ""} ${tags}\n${body}`.trim()
      }

      // Deliberately do NOT include the verbatim hook string. The system
      // prompt forbids copying phrasing from inspiration; supplying the
      // literal hook text invites subtle leakage. The reusable_hook_template
      // captures the structural pattern without the original wording.
      const lines = [
        `[${i + 1}] ${title}${stats ? ` (${stats})` : ""} ${tags}`.trim(),
        da.hook_formula ? `Hook formula: ${da.hook_formula}` : null,
        da.body_summary ? `Body pattern: ${da.body_summary}` : null,
        da.cta ? `CTA pattern: ${da.cta}` : null,
        da.why_it_works ? `Why it worked: ${da.why_it_works}` : null,
        da.reusable_hook_template ? `Reusable hook template: ${da.reusable_hook_template}` : null,
        Array.isArray(da.key_findings) && da.key_findings.length > 0
          ? `Key findings:\n${da.key_findings.slice(0, 5).map((k) => `  - ${k}`).join("\n")}`
          : null,
      ].filter(Boolean) as string[]
      return lines.join("\n").slice(0, cap)
    })
    .join("\n\n---\n\n")
}

// My_voice items can carry a structured voice_signature in metadata.
// When present we render it as explicit cadence/register/profanity rules
// above the raw transcript so the model has both the rule and the example
// material. Falls back to plain raw transcript when no signature exists.
function renderMyVoiceSnippets(snippets: ContextSnippet[], cap = 4000): string {
  if (snippets.length === 0) return "(none)"
  return snippets
    .map((s, i) => {
      const title = s.title?.trim() || `(untitled ${i + 1})`
      const meta = (s.metadata ?? {}) as Record<string, unknown>
      const vs = meta.voice_signature as VoiceSignature | undefined
      const tags = s.tags.length > 0 ? `[tags: ${s.tags.slice(0, 6).join(", ")}]` : ""
      const raw = (s.processed_content || s.summary || "").slice(0, cap)

      if (!vs) {
        return `[${i + 1}] ${title} ${tags}\n${raw}`.trim()
      }

      const sigLines: string[] = ["Voice signature:"]
      if (vs.avg_sentence_length > 0)
        sigLines.push(`  - Avg sentence length: ${vs.avg_sentence_length} words`)
      if (vs.sentence_rhythm)
        sigLines.push(`  - Rhythm: ${vs.sentence_rhythm}`)
      if (vs.register) sigLines.push(`  - Register: ${vs.register}`)
      if (vs.profanity_level)
        sigLines.push(
          `  - Profanity: ${vs.profanity_level}${vs.profanity_examples?.length ? ` (e.g. ${vs.profanity_examples.slice(0, 3).join(", ")})` : ""}`
        )
      if (vs.opening_patterns?.length > 0)
        sigLines.push(
          `  - Opens with: ${vs.opening_patterns.slice(0, 5).map((p) => `"${p}"`).join(", ")}`
        )
      if (vs.closing_patterns?.length > 0)
        sigLines.push(
          `  - Closes with: ${vs.closing_patterns.slice(0, 5).map((p) => `"${p}"`).join(", ")}`
        )
      if (vs.signature_phrases?.length > 0)
        sigLines.push(
          `  - Signature phrases (use these): ${vs.signature_phrases.slice(0, 8).map((p) => `"${p}"`).join(", ")}`
        )
      if (vs.filler_words?.length > 0)
        sigLines.push(`  - Filler words to mirror: ${vs.filler_words.slice(0, 6).join(", ")}`)
      if (vs.distinctive_moves?.length > 0) {
        sigLines.push("  - Distinctive moves:")
        vs.distinctive_moves.slice(0, 6).forEach((m) => sigLines.push(`    - ${m}`))
      }

      return `[${i + 1}] ${title} ${tags}\n${sigLines.join("\n")}\nRaw sample:\n${raw}`.trim()
    })
    .join("\n\n---\n\n")
}

// Strip placeholder strings users sometimes leave in setup ("n/a", "none",
// blanks) so the model doesn't treat them as real catchphrases or banned
// phrases. Anything ≤4 chars or matching a common placeholder is dropped.
function isPlaceholder(s: string): boolean {
  const t = s.trim().toLowerCase()
  if (t.length === 0) return true
  if (t.length <= 4 && (t === "n/a" || t === "na" || t === "n.a" || t === "none" || t === "-")) return true
  return ["n/a", "none", "null", "(none)", "tbd", "todo", "placeholder"].includes(t)
}

function renderVoice(v: VoiceProfile): string {
  const lines: string[] = []
  lines.push(v.tone_descriptor && !isPlaceholder(v.tone_descriptor) ? v.tone_descriptor : "(no tone descriptor set)")
  const catchphrases = v.catchphrases.filter((c) => !isPlaceholder(c))
  const do_not_use = v.do_not_use_phrases.filter((c) => !isPlaceholder(c))
  if (catchphrases.length > 0) lines.push(`Catchphrases: ${catchphrases.join(" | ")}`)
  if (do_not_use.length > 0) lines.push(`DO_NOT_USE: ${do_not_use.join(" | ")}`)
  if (v.sample_transcripts.length > 0) {
    lines.push("Sample lines from past content (mirror cadence and word choice):")
    v.sample_transcripts.slice(0, 5).forEach((s, i) => {
      lines.push(`(${i + 1}) ${s.slice(0, 600)}`)
    })
  }
  return lines.join("\n")
}

function renderBusiness(b: BusinessProfile): string {
  return [
    b.niche ? `Niche: ${b.niche}` : null,
    b.avatar_description ? `Avatar: ${b.avatar_description}` : null,
    b.offer_description ? `Offer: ${b.offer_description}` : null,
    b.lead_magnet ? `Lead magnet: ${b.lead_magnet}` : null,
    b.default_comment_keyword
      ? `Comment keyword to default to (overridable per script): ${b.default_comment_keyword}`
      : null,
  ]
    .filter(Boolean)
    .join("\n")
}

const SCRIPT_SCHEMA_REEL = `{
  "hook": "string, max 12 words",
  "hook_formula": "contrarian | curiosity_gap | pain_point | secret_value | time_bound_result | mistake_callout | numbered_list",
  "body": "string, the spoken script body (no labels) -- length must match requested LENGTH",
  "cta": "string, comment-keyword CTA",
  "full_script": "string, hook + body + cta concatenated for reading",
  "caption": "string, max 2200 chars",
  "keyword": "string, one word",
  "hashtags": ["#example1", "#example2"],
  "topic": "string, short label",
  "angle": "string, the framing approach",
  "target_length_s": 25,
  "content_format": "talking_head | process_demo | storytelling | list_breakdown | walk_and_talk | duo_dialog | broll_voiceover | before_after",
  "why_it_works": "string, 1-3 sentences explaining the psychological / structural reason this performs",
  "shot_ideas": ["string", "string", "..."]
}`

const SCRIPT_SCHEMA_CAROUSEL = `{
  "hook": "string (slide 1 text)",
  "hook_formula": "...",
  "body": "string, all slides joined for preview",
  "cta": "string (last slide CTA)",
  "full_script": "string with [Slide N] prefixes",
  "caption": "string",
  "keyword": "string",
  "hashtags": ["#x"],
  "topic": "string",
  "angle": "string",
  "target_length_s": 0,
  "slides": [
    { "order": 1, "text": "...", "on_screen": "...", "image_prompt": "..." },
    ... 8 to 10 slides total ...
  ]
}`

const SCRIPT_SCHEMA_STORY = `{
  "hook": "string (frame 1 text)",
  "hook_formula": "...",
  "body": "string, all frames joined",
  "cta": "string (final frame CTA)",
  "full_script": "string with [Frame N] prefixes",
  "caption": "string",
  "keyword": "string",
  "hashtags": ["#x"],
  "topic": "string",
  "angle": "string",
  "target_length_s": 60,
  "slides": [
    { "order": 1, "text": "...", "on_screen": "...", "image_prompt": "..." },
    ... 5 to 7 frames total ...
  ]
}`

const SCRIPT_SCHEMA_LONG_FORM = `{
  "title": "string, the working title of the long-form piece",
  "hook": "string, the cold-open line(s), max 30 spoken seconds",
  "hook_formula": "contrarian | curiosity_gap | pain_point | secret_value | time_bound_result | mistake_callout | numbered_list",
  "body": "string, the full spoken script joined together for read-through",
  "cta": "string, the outro CTA (subscribe / lead magnet / next video)",
  "full_script": "string, the complete script with [Section N: Heading] markers",
  "caption": "string, video description / show notes (1500-2500 chars)",
  "keyword": "string, primary keyword",
  "hashtags": ["#example1", "#example2"],
  "topic": "string",
  "angle": "string",
  "target_length_s": 600,
  "total_duration_min": 10,
  "content_format": "talking_head | process_demo | storytelling | list_breakdown | walk_and_talk | duo_dialog | broll_voiceover | before_after",
  "why_it_works": "string, the structural / psychological reason this long-form holds attention",
  "shot_ideas": ["overall b-roll concepts that thread the whole piece"],
  "sections": [
    { "order": 1, "heading": "...", "content": "spoken script for this section", "duration_s": 90, "shot_ideas": ["per-section visuals"] },
    "...",
    "5 to 7 sections total"
  ]
}`

function schemaForFormat(format: ScriptFormat): string {
  if (format === "carousel") return SCRIPT_SCHEMA_CAROUSEL
  if (format === "story_sequence") return SCRIPT_SCHEMA_STORY
  if (format === "long_form") return SCRIPT_SCHEMA_LONG_FORM
  return SCRIPT_SCHEMA_REEL
}

function renderContextBlocks(input: {
  business: BusinessProfile
  voice: VoiceProfile
  retrieved: RetrievedContext
}): string[] {
  const r = input.retrieved
  return [
    // Instructions go first AND render with preferRaw so summaries can't
    // strip user-specific tokens (e.g. "always end with comment WEB").
    // Anything in this block overrides everything below it.
    `## INSTRUCTIONS_INTENT (hard rules. Every line below is a constraint that overrides everything else. Read these BEFORE the other context blocks. If anything below contradicts a rule here, this block wins.)\n${renderSnippets(r.instructions, 1500, { preferRaw: true })}`,
    // MY_VOICE is the rewrite anchor and leads the context blocks. Voice
    // gets read first so cadence anchors before the model sees substance,
    // structure, or topic material -- earlier blocks bias the model more.
    `## MY_VOICE (the creator's own raw transcripts plus a structured voice_signature when extracted at ingest. This is the PRIMARY rewrite anchor. Treat the signature lines as binding cadence rules: hit the avg sentence length, mirror the opening / closing patterns, match the profanity level, and naturally reuse the signature phrases. The raw sample below each signature is the reference material to anchor the rules. Never reuse hooks verbatim.)\n${renderMyVoiceSnippets(r.my_voice, 4000)}`,
    `## VOICE_PROFILE (auxiliary tone descriptor and catchphrases — supplements MY_VOICE, never overrides it.)\n${renderVoice(input.voice)}`,
    `## BUSINESS_PROFILE\n${renderBusiness(input.business)}`,
    `## CONTEXT (anything the creator wants the engine to know about themselves, their business, or their offer — facts, proof, internal docs, anecdotes. Use these as the proof / example layer.)\n${renderSnippets(r.context, 2500)}`,
    `## EXPERT_BRAIN (the creator's library of expert knowledge and frameworks: books, podcasts, courses, models, principles. This is the SUBSTANCE layer — every script's underlying logic should map to a NAMED framework, principle, or mental model below. Reference frameworks by their actual names in the script so the creator recognises their own material.)\n${renderExpertBrainSnippets(r.expert_brain, 3000)}`,
    `## INSPIRATION (competitor reels with their structural analysis broken down. Use the hook formulas, body patterns, and why-it-worked levers as templates for your own scripts. Never lift topics or phrasing — only structure and pattern.)\n${renderInspirationSnippets(r.inspiration, 2000)}`,
    `## VIDEO_IDEAS (the creator's own seed topics — videos they want to make. Treat each as a candidate spine for a proposal: take the topic, enrich it with the right framework from EXPERT_BRAIN, anchor it to BUSINESS_PROFILE.offer, and prove it with something from CONTEXT. When a VIDEO_IDEAS item matches the request, prefer it over inventing a fresh topic.)\n${renderSnippets(r.video_ideas, 1200)}`,
    `## FEEDBACK (performance learnings from past posts. These outrank all other inputs except INSTRUCTIONS_INTENT — if FEEDBACK contradicts a framework, FEEDBACK wins.)\n${renderSnippets(r.feedback, 1500)}`,
  ]
}

function renderAnchors(anchors: IdeaProposal[]): string {
  return anchors
    .map((a, i) => {
      const lines: string[] = [`[${i + 1}]`]
      if (a.hook) lines.push(`hook: "${a.hook}" (formula: ${a.hook_formula ?? "unspecified"})`)
      if (a.title) lines.push(`title: ${a.title}`)
      lines.push(`topic: ${a.topic}`)
      lines.push(`angle: ${a.angle}`)
      return lines.join("\n  ")
    })
    .join("\n\n")
}

export function buildGeneratorUserPrompt(input: GenerationInput): string {
  const sections = [
    ...renderContextBlocks(input),
    `## REQUEST\n${input.request.trim()}`,
    input.length ? `## LENGTH\n${input.length} (apply the corresponding word count and pacing rules)` : "",
    input.anchors && input.anchors.length > 0
      ? `## ANCHORS\nGenerate exactly ${input.anchors.length} ${input.format}(s), one per anchor below. Preserve each anchor's hook (verbatim if provided), topic, and angle. Do not add extra scripts. Do not change the order.\n\n${renderAnchors(input.anchors)}`
      : "",
    `Output: ${input.anchors?.length ?? input.count} ${input.format}(s) as a JSON array. Each object must match this schema:\n${schemaForFormat(input.format)}`,
    `Return ONLY the JSON array. No commentary. No markdown fences.`,
  ].filter(Boolean)
  return sections.join("\n\n")
}

// ----------------------------------------------------------------------------
// Ideation: produce a list of hook / topic proposals the user can pick from
// before committing to full-script expansion. Reels get hooks; carousels and
// story sequences get topic+angle; long-form gets working titles. Two-stage
// flow inspired by Poppy.
// ----------------------------------------------------------------------------

export const IDEATION_SYSTEM_PROMPT = `You generate ideation-stage proposals for ONE specific creator's content engine. Output strict JSON only — an array of N proposals. Each proposal is one idea the creator can pick from to expand into a full script later.

FRAMEWORK FIDELITY (read carefully):
- When EXPERT_BRAIN contains a framework whose "when_to_use" applies to this request, every relevant proposal MUST be structured around that framework. Map the angle to the framework's steps explicitly.
- The why_it_works of every proposal MUST name the framework being applied, verbatim, exactly as it appears in EXPERT_BRAIN (e.g. "Applies The 10-Beat Reel Formula, with the angle landing in beats 3-5"). Naming is required; bluffing is not allowed.
- If genuinely no framework fits a proposal's request, write in why_it_works "No EXPERT_BRAIN framework matches — defaulting to the {hook_formula} pattern" so the creator knows to add one.

LAYERED CONSTRUCTION (read this first — each bucket has a specific job, do not mix them up):
- VIDEO_IDEAS: the creator's own seed topics, the videos they want to make. When the request matches an item here, USE IT as the topic spine instead of inventing a new one. Expand the seed with research from EXPERT_BRAIN and proof from CONTEXT. If multiple video_ideas items relate to the request, treat them as candidate proposals and pick the strongest.
- INSPIRATION: competitor reels analysed for structure and engagement. Use them as STRUCTURAL TEMPLATES — lift hook formulas, body patterns, engagement levers from the deep_analysis. Never lift topics or phrasing.
- EXPERT_BRAIN: expert knowledge and frameworks. The SUBSTANCE layer. Every proposal's logic should map to a specific framework, model, or principle from here. If EXPERT_BRAIN has a "5-step acquisition framework", that's the spine of an acquisition-themed proposal.
- CONTEXT: anything the creator wants known about themselves, their business, or their offer. The RELEVANCE / proof layer. Tie the framework to the avatar via these items.
- MY_VOICE: the creator's raw transcripts. The SOUND layer. Match cadence, sentence rhythm, opening tics, profanity level, word choice. Never copy phrasing or reuse hooks verbatim.
- VOICE_PROFILE: tone descriptor and catchphrases (auxiliary to MY_VOICE).
- BUSINESS_PROFILE: identity layer (niche, avatar, offer, lead magnet). Every proposal must serve this avatar in service of this offer.
- INSTRUCTIONS_INTENT: hard rules, override everything.
- FEEDBACK: performance learnings, outrank everything except hard instructions.

Composition target for each proposal: "topic seed from VIDEO_IDEAS (or close to one), structured by a framework from EXPERT_BRAIN, hook pattern lifted from INSPIRATION's deep_analysis, voiced in MY_VOICE cadence, anchored to BUSINESS_PROFILE.avatar + offer, proven by details from CONTEXT".

ANCHORING (non-negotiable):
- Every proposal must be useful to BUSINESS_PROFILE.avatar IN THE CONTEXT OF BUSINESS_PROFILE.offer. If you cannot tie a proposal back to selling, serving, or building affinity for that specific offer, do not include it.
- Reference the offer's actual mechanism — the components and steps named in BUSINESS_PROFILE.offer_description, not generic creator advice. Names of tools, processes, and stages from the offer should appear in topics and angles.
- The CTA implied by every reel proposal must point at BUSINESS_PROFILE.lead_magnet using the BUSINESS_PROFILE.default_comment_keyword. Topics and angles must respect that this is the path to the offer.
- Topics like "5 reasons creators fail" or "the 3-step framework for X" without specific tie-back to this avatar + offer are off-limits. Be specific to this business or do not propose.

ZERO HALLUCINATION:
- Do NOT invent statistics, dollar amounts, percentages, timeframes, client names, success rates, or specific outcomes. If a number is not in CONTEXT, EXPERT_BRAIN, FEEDBACK, or MY_VOICE, do not write a number.
- If a proposal would normally need a specific stat for impact, write a directional claim instead ("most…", "often…", "the majority…") OR write the stat as a literal "[X]" placeholder for the creator to fill in.
- Names, anecdotes, and case studies must come from the corpus. If you don't have a case study from the corpus, do not write a case-study proposal.
- "Why_it_works" must explain the lever; it must NOT include made-up performance claims like "this got 100k views" unless that fact is in FEEDBACK.

Format-specific rules:
- "reel": every proposal MUST include hook (max 12 words), hook_formula (one of: contrarian | curiosity_gap | pain_point | secret_value | time_bound_result | mistake_callout | numbered_list), topic, angle, why_it_works.
- "carousel" or "story_sequence": every proposal MUST include topic, angle, why_it_works. Omit hook and hook_formula.
- "long_form": every proposal MUST include title (working title for the video), topic, angle, why_it_works. Omit hook and hook_formula.

Cross-format rules:
- Diversity within the offer: cover different angles INSIDE the offer's surface area (acquisition, sales process, fulfilment, objection handling, etc. as named in offer_description). Different hook formulas for reels. No two proposals should restate the same idea.
- Voice: every proposal must sound like the creator. Match cadence and word choice from VOICE_PROFILE.tone_descriptor and from MY_VOICE samples. Never use any DO_NOT_USE phrase.
- Context-grounded: when CONTEXT or EXPERT_BRAIN contains a specific framework, story, or claim that maps to a proposal, name it explicitly so the user recognises their own material in the suggestion.
- why_it_works: 1-2 sentences naming the psychological lever (curiosity, identity, loss aversion, etc.) plus how this specific proposal serves the avatar at their current stage of awareness.

Output format: a JSON array of N proposals. No commentary, no markdown fences.`

const IDEATION_SCHEMA = `{
  "topic": "string, the core topic",
  "angle": "string, the unique perspective or framing for THIS proposal",
  "why_it_works": "string, 1-2 sentences",
  "hook": "string, ONLY for reels — max 12 words, the actual hook line",
  "hook_formula": "string, ONLY for reels — one of: contrarian | curiosity_gap | pain_point | secret_value | time_bound_result | mistake_callout | numbered_list",
  "title": "string, ONLY for long_form — working title for the video"
}`

export function buildIdeationUserPrompt(input: IdeationInput): string {
  const sections = [
    ...renderContextBlocks(input),
    `## REQUEST\n${input.request.trim()}`,
    `## FORMAT\n${input.format}`,
    input.length ? `## LENGTH\n${input.length}` : "",
    `Generate ${input.count} ideation proposals for the format above. Each proposal is JUST an idea (not a full script). Cover different angles. Output a JSON array. Each object must match this schema:\n${IDEATION_SCHEMA}`,
    `Return ONLY the JSON array. No commentary. No markdown fences.`,
  ].filter(Boolean)
  return sections.join("\n\n")
}

export const SUMMARISE_SYSTEM_PROMPT = `You produce structured summaries of context items for a content engine. Output strict JSON only. No prose, no markdown fences.`

// Summary shape varies by bucket. The same five-bullet container is reused
// but the bullet labels match what the bucket is actually for. A my_voice
// transcript should not be summarised as "hook / core argument / structure"
// — those are competitor-reel concepts.
function summaryBulletsForBucket(bucket: string): string {
  switch (bucket) {
    case "inspiration":
      return "Hook, core argument, structure, audience, takeaway"
    case "expert_brain":
      return "Core thesis, key claims or frameworks introduced, target audience, practical applications, signature terminology"
    case "my_voice":
      return "Topics covered, main points the speaker made, audience addressed, recurring themes, key takeaways the speaker delivered (focus on WHAT was said — voice cadence is captured separately)"
    case "context":
      return "What this document covers, the business / offer / avatar described, key facts and proof points, why this material is relevant, distinguishing details"
    case "video_ideas":
      return "Core topic, the angle or framing, the audience this serves, what would make this idea unique, any constraints"
    case "instructions":
      return "The rule(s) stated, when they apply, what they override, any exceptions, the literal phrasing to preserve"
    case "feedback":
      return "Verdict (winner / flop / average), structural reason it landed that way, the replicable rule, what to do more of, what to avoid"
    default:
      return "Hook, core argument, structure, audience, takeaway"
  }
}

export function buildSummariseUserPrompt(input: {
  raw: string
  source_type: string
  source_url?: string | null
  title_hint?: string | null
  bucket?: string
}): string {
  const bullets = summaryBulletsForBucket(input.bucket ?? "")
  return `Summarise the following item for retrieval. Output JSON:
{
  "summary": "5 short bullets joined by newlines, prefixed with '- '. ${bullets}.",
  "tags": ["array of 8-12 lowercase keyword tags useful for full-text search"],
  "hook_extracted": "if the item itself contains a verbatim hook line (reel caption opener, video first line), return it. Else null."
}

Bucket: ${input.bucket ?? "(unspecified)"}
Source type: ${input.source_type}
${input.source_url ? `Source URL: ${input.source_url}\n` : ""}${input.title_hint ? `Title hint: ${input.title_hint}\n` : ""}
Content:
${input.raw.slice(0, 16000)}`
}

export const PROPOSE_NICHE_SYSTEM_PROMPT = `You are a niche-discovery interviewer for a content engine. Take the user's interview answers and produce a focused niche, avatar, offer hypothesis, and voice tone descriptor. Output strict JSON only.`

export function buildProposeNicheUserPrompt(answers: Record<string, string>): string {
  const lines = Object.entries(answers)
    .filter(([, v]) => v && v.trim().length > 0)
    .map(([k, v]) => `Q: ${k}\nA: ${v.trim()}`)
    .join("\n\n")

  return `Interview answers:\n\n${lines}\n\nReturn JSON:
{
  "niche": "specific niche, max 12 words. Geographic + industry where applicable.",
  "avatar": "1-2 sentence persona description",
  "offer": "specific offer hypothesis with price",
  "voice_tone": "descriptor: tone, profanity level, register, signature stylistic moves"
}`
}

export const PROPOSE_RADAR_SEED_SYSTEM_PROMPT = `You produce starter Instagram and TikTok hashtags and creator handles for a Content Radar. Output strict JSON only.`

export function buildProposeRadarSeedUserPrompt(input: {
  niche: string
  avatar?: string | null
  offer?: string | null
}): string {
  return `Niche: ${input.niche}
Avatar: ${input.avatar ?? "(unspecified)"}
Offer: ${input.offer ?? "(unspecified)"}

Propose 10 Instagram hashtags and 10 Instagram creator handles to monitor for trend signals in this niche.

Return JSON:
{
  "hashtags": [{"platform": "instagram", "value": "#example"}, ...],
  "creator_handles": [{"platform": "instagram", "value": "@example"}, ...]
}

Rules:
- Hashtags must start with #
- Handles must start with @
- Mix of broad-niche, narrow-niche, adjacent-niche, and content-strategy creators
- Real, well-known accounts where possible. If you must invent, only invent hashtags, never handles.`
}

export const PROPOSE_EXPERT_BRAIN_SYSTEM_PROMPT = `You propose 5 high-quality, public-facing learning sources for a creator's Expert Brain. Output strict JSON only.`

export function buildProposeExpertBrainUserPrompt(input: {
  niche: string
  avatar?: string | null
}): string {
  return `Niche: ${input.niche}
Avatar: ${input.avatar ?? "(unspecified)"}

Propose 5 foundational learning sources for this creator's Expert Brain. Mix of YouTube channels, podcasts, books, and newsletters. They should teach offer construction, content strategy, and selling frameworks for this niche.

Return JSON:
{
  "sources": [
    {
      "title": "string, source name and creator",
      "url": "string, public-facing URL",
      "reason": "string, 1 sentence on why this matters for this niche"
    },
    ... 5 total ...
  ]
}`
}

export const RADAR_SUGGESTION_SYSTEM_PROMPT = `You analyse a spiking Instagram or TikTok reel for a content engine. You explain why it is heating up and propose a hook the user could write in their own voice. Output strict JSON only.`

export function buildRadarSuggestionUserPrompt(input: {
  caption: string
  transcript?: string
  metrics: Record<string, unknown>
  niche: string
  voice_tone: string
}): string {
  return `Niche: ${input.niche}
Creator's voice tone: ${input.voice_tone}

Spiking reel data:
Caption: ${input.caption}
${input.transcript ? `Transcript: ${input.transcript.slice(0, 4000)}` : ""}
Metrics: ${JSON.stringify(input.metrics)}

Return JSON:
{
  "why": "1-2 sentences on why this content is heating up. Focus on hook structure, claim specificity, audience tension.",
  "hook_idea": "A new hook the creator could write IN THEIR OWN VOICE for the same idea. Max 12 words.",
  "hook_formula": "contrarian | curiosity_gap | pain_point | secret_value | time_bound_result | mistake_callout | numbered_list"
}`
}

export const INSPIRATION_ANALYSIS_SYSTEM_PROMPT = `You analyse short-form video content (Instagram Reels, TikTok) for a content engine that helps creators in a specific niche reverse-engineer what works. You break down the structure, identify why it resonated, and extract reusable insights. Output strict JSON only. No prose, no markdown fences.`

export function buildInspirationAnalysisUserPrompt(input: {
  caption: string
  transcript: string
  author: string | null
  metrics: Record<string, unknown>
  niche?: string | null
}): string {
  return `Niche context: ${input.niche ?? "general creator content"}
Author: ${input.author ?? "unknown"}
Metrics (raw): ${JSON.stringify(input.metrics)}

Caption:
${input.caption || "(none)"}

Full transcript of spoken audio:
${input.transcript.slice(0, 12000) || "(no transcript available)"}

Analyse this content and return JSON:
{
  "hook": "the exact opening line(s) that grab attention -- pull from transcript or caption",
  "hook_formula": "contrarian | curiosity_gap | pain_point | secret_value | time_bound_result | mistake_callout | numbered_list",
  "body_summary": "2-3 sentences summarising the main argument/teaching/story",
  "cta": "the call to action at the end -- what does the creator ask viewers to do? If none, write 'none'",
  "why_it_works": "2-3 sentences on why this resonated -- look at engagement rate, hook structure, audience pain it solves, contrarian angle, etc.",
  "key_findings": [
    "3-5 specific reusable insights -- what could be applied to similar content",
    "be concrete: structures, phrasings, pacing tricks, specific claims",
    "..."
  ],
  "reusable_hook_template": "A fill-in-the-blank version of the hook the user could adapt -- e.g. 'Most [X] don't realise [Y]'"
}`
}

export const EXPERT_FRAMEWORK_EXTRACTION_SYSTEM_PROMPT = `You extract structured teaching material from expert-brain content (books, podcasts, courses, long-form videos). The output is used by a content engine as the structural spine for new short-form scripts. Be specific. Skip preamble. Output strict JSON only — no prose, no markdown fences.

Rules:
- Frameworks must be NAMED (the actual name from the source if given; otherwise a clear descriptive name) and have ORDERED steps.
- Principles are 1-line claims that can stand on their own.
- Mental models are 1-line reframings or heuristics.
- Key terminology is the source's named concepts the creator should reuse.
- Case studies should be SPECIFIC (named subject + measurable outcome + the cause). Do NOT invent case studies; only include those explicitly stated in the source.
- If a category has nothing concrete, return an empty array — do not pad.`

export function buildExpertFrameworkExtractionUserPrompt(input: {
  title: string | null
  source_type: string
  raw: string
}): string {
  return `Source title: ${input.title ?? "(untitled)"}
Source type: ${input.source_type}

Full content (transcript or extracted text):
${input.raw.slice(0, 30000)}

Extract structured teaching material. Output JSON:
{
  "frameworks": [
    {
      "name": "the named framework or method, e.g. 'The 3-Pillar Audit'",
      "steps": ["step 1 phrasing", "step 2 phrasing", "..."],
      "when_to_use": "1 sentence on when this framework applies"
    }
  ],
  "principles": [
    "1-line claims the source makes that can stand alone, e.g. 'Sell the outcome, not the deliverable'",
    "..."
  ],
  "mental_models": [
    "1-line reframings or heuristics, e.g. 'Premium pricing is positioning, not a number'",
    "..."
  ],
  "key_terminology": [
    "named concepts the creator should adopt, e.g. 'MRR', 'value-based pricing'",
    "..."
  ],
  "case_studies": [
    {
      "subject": "named person, company, or campaign",
      "outcome": "measurable result with specific number or qualifier",
      "what_caused_it": "1 sentence on the actual lever"
    }
  ]
}`
}

export const VOICE_SIGNATURE_EXTRACTION_SYSTEM_PROMPT = `You analyse a creator's raw speech transcript and extract their voice signature — structured cadence and word-choice rules a content engine can apply to write new scripts in their exact voice. Output strict JSON only — no prose, no markdown fences.

Rules:
- Be specific. "Casual" is useless. "an experienced business operator talking to other founders, drops 'mate', avoids buzzwords, asks rhetorical questions then answers them" is useful.
- Only include items that actually appear in the transcript. Empty arrays are valid.
- profanity_level must reflect actual usage. One f-word in 30 minutes is "light", not "moderate".
- Do not invent. If a category cannot be inferred from this transcript, return an empty array or empty string.
- Signature phrases are recurring phrasings that feel like the creator's own. Generic phrases ("at the end of the day") do not qualify.`

export function buildVoiceSignatureExtractionUserPrompt(input: {
  title: string | null
  source_type: string
  raw: string
}): string {
  return `Source title: ${input.title ?? "(untitled)"}
Source type: ${input.source_type}

Full transcript of the creator's speech:
${input.raw.slice(0, 30000)}

Extract the speaker's voice signature. Output JSON:
{
  "avg_sentence_length": "rough average spoken-word count per sentence (number)",
  "sentence_rhythm": "1-2 sentences describing pacing, e.g. 'short choppy sentences punctuated by long rants when emphasising a point'",
  "opening_patterns": ["how they start sentences or sections, e.g. 'So look', 'Here's the thing', 'Listen,'"],
  "closing_patterns": ["how they wrap up statements, e.g. 'period.', 'and that's it', '...full stop'"],
  "signature_phrases": ["recurring phrasings that feel like the creator's own, not generic"],
  "filler_words": ["um, like, you know — only ones actually present"],
  "profanity_level": "none | light | moderate | heavy",
  "profanity_examples": ["actual profanity used in the transcript"],
  "register": "1-sentence description of formality, audience vibe, identity markers",
  "distinctive_moves": ["specific verbal patterns: rhetorical questions, contrast structures, lists of three, callbacks, sarcasm, etc — only ones present in this transcript"]
}`
}

export const POST_MORTEM_SYSTEM_PROMPT = `You write a one-paragraph post-mortem for a published reel based on its hook and performance. Output strict JSON only.`

export function buildPostMortemUserPrompt(input: {
  hook: string
  hook_formula: string
  body_preview: string
  views: number
  median_views: number
}): string {
  const ratio = input.median_views > 0 ? (input.views / input.median_views).toFixed(2) : "n/a"
  const verdict = input.views >= input.median_views * 2 ? "WINNER" : input.views <= input.median_views * 0.5 ? "FLOP" : "AVERAGE"
  return `Verdict: ${verdict} (views ${input.views} vs median ${input.median_views}, ratio ${ratio}x)
Hook: "${input.hook}"
Hook formula: ${input.hook_formula}
Body preview: ${input.body_preview.slice(0, 500)}

Return JSON:
{
  "text": "One paragraph (3-4 sentences) post-mortem. State the verdict, name the structural reason it ${verdict === "WINNER" ? "worked" : verdict === "FLOP" ? "failed" : "landed average"}, and prescribe the replicable rule for next time."
}`
}

/**
 * Strip optional markdown fences from Claude output and parse the JSON
 * payload. Used for every Claude call that returns structured data.
 */
export function parseClaudeJson<T = unknown>(raw: string): T {
  let s = raw.trim()
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (fence) s = fence[1].trim()
  return JSON.parse(s) as T
}
