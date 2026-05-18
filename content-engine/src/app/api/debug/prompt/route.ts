import { NextRequest, NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"
import {
  loadBusinessProfile,
  loadVoiceProfile,
} from "@/lib/content-engine/generator"
import { retrieveForGeneration } from "@/lib/content-engine/retrieval"
import {
  MASTER_SYSTEM_PROMPT,
  buildGeneratorUserPrompt,
} from "@/lib/ai/prompts"

/**
 * Returns the exact prompt that would be sent to Claude for a given
 * generation request. Use this to confirm the user prompt actually
 * includes business profile, voice samples, retrieved buckets, etc.
 * If the prompt is right but the output is generic, the issue is in
 * how Claude weighs the content -- not retrieval.
 *
 * Query params:
 *   prompt   - the user request
 *   format   - reel | carousel | story_sequence | long_form
 *   length   - short | medium | long (default medium)
 *   count    - default 3
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const prompt = req.nextUrl.searchParams.get("prompt") ?? "generate 3 original ideas"
  const formatParam = req.nextUrl.searchParams.get("format") ?? "reel"
  const lengthParam = (req.nextUrl.searchParams.get("length") ?? "medium") as
    | "short"
    | "medium"
    | "long"
  const count = Math.max(1, Math.min(5, Number(req.nextUrl.searchParams.get("count") ?? 3)))
  const format = ["reel", "carousel", "story_sequence", "long_form"].includes(formatParam)
    ? (formatParam as "reel" | "carousel" | "story_sequence" | "long_form")
    : "reel"

  const [business, voice, retrieved] = await Promise.all([
    loadBusinessProfile(),
    loadVoiceProfile(),
    retrieveForGeneration(prompt),
  ])

  const userPrompt = buildGeneratorUserPrompt({
    request: prompt,
    format,
    length: lengthParam,
    count,
    business,
    voice,
    retrieved,
  })

  return NextResponse.json({
    inputs: {
      prompt,
      format,
      length: lengthParam,
      count,
    },
    business_loaded: business,
    voice_loaded: {
      tone_descriptor: voice.tone_descriptor,
      catchphrases: voice.catchphrases,
      do_not_use_phrases: voice.do_not_use_phrases,
      sample_transcripts_count: voice.sample_transcripts.length,
      sample_transcripts_preview: voice.sample_transcripts
        .slice(0, 2)
        .map((s) => s.slice(0, 200)),
    },
    retrieved_counts: {
      video_ideas: retrieved.video_ideas.length,
      inspiration: retrieved.inspiration.length,
      expert_brain: retrieved.expert_brain.length,
      my_voice: retrieved.my_voice.length,
      context: retrieved.context.length,
      instructions: retrieved.instructions.length,
      feedback: retrieved.feedback.length,
    },
    system_prompt_length: MASTER_SYSTEM_PROMPT.length,
    user_prompt_length: userPrompt.length,
    system_prompt: MASTER_SYSTEM_PROMPT,
    user_prompt: userPrompt,
  })
}
