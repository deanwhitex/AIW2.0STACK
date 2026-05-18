/**
 * Shared AI types. Match the shape we expect from Claude AND from stubs.
 */

export type HookFormula =
  | "contrarian"
  | "curiosity_gap"
  | "pain_point"
  | "secret_value"
  | "time_bound_result"
  | "mistake_callout"
  | "numbered_list"

export type ScriptFormat = "reel" | "carousel" | "story_sequence" | "long_form"

export type ScriptLength = "short" | "medium" | "long"

export type ContentFormat =
  | "talking_head"
  | "process_demo"
  | "storytelling"
  | "list_breakdown"
  | "walk_and_talk"
  | "duo_dialog"
  | "broll_voiceover"
  | "before_after"

export type Slide = {
  order: number
  text: string
  on_screen: string
  image_prompt: string
}

export type LongFormSection = {
  order: number
  heading: string
  content: string
  duration_s: number
  shot_ideas?: string[]
}

export type GeneratedScript = {
  hook: string
  hook_formula: HookFormula
  body: string
  cta: string
  full_script: string
  caption: string
  keyword: string
  hashtags: string[]
  topic: string
  angle: string
  target_length_s: number
  content_format?: ContentFormat
  why_it_works?: string
  shot_ideas?: string[]
  slides?: Slide[]
  sections?: LongFormSection[]
  title?: string
  total_duration_min?: number
}

export type BusinessProfile = {
  niche: string | null
  avatar_description: string | null
  offer_description: string | null
  lead_magnet: string | null
  default_comment_keyword: string | null
}

export type VoiceProfile = {
  tone_descriptor: string | null
  catchphrases: string[]
  do_not_use_phrases: string[]
  sample_transcripts: string[]
}

export type ContextSnippet = {
  id: string
  title: string | null
  summary: string | null
  processed_content: string | null
  tags: string[]
  metadata: Record<string, unknown>
}

export type RetrievedContext = {
  video_ideas: ContextSnippet[]
  inspiration: ContextSnippet[]
  expert_brain: ContextSnippet[]
  my_voice: ContextSnippet[]
  context: ContextSnippet[]
  instructions: ContextSnippet[]
  feedback: ContextSnippet[]
}

export type IdeaProposal = {
  id: string
  format: ScriptFormat
  topic: string
  angle: string
  why_it_works: string
  hook?: string
  hook_formula?: HookFormula
  title?: string
}

export type GenerationInput = {
  request: string
  format: ScriptFormat
  length?: ScriptLength
  count: number
  business: BusinessProfile
  voice: VoiceProfile
  retrieved: RetrievedContext
  // When present, Claude must produce exactly one script per anchor,
  // preserving each anchor's hook / topic / angle. Used by the Poppy-style
  // two-stage flow: ideation produces proposals, expansion takes selected
  // proposals and turns them into full scripts.
  anchors?: IdeaProposal[]
}

export type IdeationInput = {
  request: string
  format: ScriptFormat
  length?: ScriptLength
  count: number
  business: BusinessProfile
  voice: VoiceProfile
  retrieved: RetrievedContext
}

export type ContextSummary = {
  summary: string
  tags: string[]
  hook_extracted?: string
}

export type NicheProposal = {
  niche: string
  avatar: string
  offer: string
  voice_tone: string
}

export type RadarSeed = {
  hashtags: { platform: "instagram" | "tiktok"; value: string }[]
  creator_handles: { platform: "instagram" | "tiktok"; value: string }[]
}

export type ExpertBrainSeed = {
  sources: { title: string; url: string; reason: string }[]
}

export type RadarSuggestion = {
  why: string
  hook_idea: string
  hook_formula: HookFormula
}

export type PostMortem = {
  text: string
}

export type InspirationAnalysis = {
  hook: string
  hook_formula: HookFormula
  body_summary: string
  cta: string
  why_it_works: string
  key_findings: string[]
  reusable_hook_template: string
}

/**
 * Structured extraction of teachable frameworks, models, and principles
 * from an expert-brain item (book, podcast, course, long-form video). The
 * generator uses these as named structural spines for new scripts.
 */
export type ExpertFrameworks = {
  frameworks: Array<{
    name: string
    steps: string[]
    when_to_use: string
  }>
  principles: string[]
  mental_models: string[]
  key_terminology: string[]
  case_studies: Array<{
    subject: string
    outcome: string
    what_caused_it: string
  }>
}

/**
 * Structured extraction of a creator's voice signature from a raw
 * transcript in the my_voice bucket. The generator renders these as
 * explicit voice constraints alongside the raw transcript so Claude has
 * both the pattern rules and the reference material to mirror.
 */
export type VoiceSignature = {
  avg_sentence_length: number
  sentence_rhythm: string
  opening_patterns: string[]
  closing_patterns: string[]
  signature_phrases: string[]
  filler_words: string[]
  profanity_level: "none" | "light" | "moderate" | "heavy"
  profanity_examples: string[]
  register: string
  distinctive_moves: string[]
}

/**
 * One reusable shape for every Claude operation. Exposes which "mode" the
 * call ran in, so the UI can show a "demo mode" banner where appropriate.
 */
export type AIResult<T> = {
  data: T
  mode: "real" | "stub"
  cost_usd?: number
  duration_ms?: number
}
