import { NextRequest, NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/supabase/admin"
import { retrieveForGeneration, bucketCounts } from "@/lib/content-engine/retrieval"

/**
 * Debug-only endpoint that shows exactly what context the generator
 * would send to Claude for a given prompt. Returns:
 *   - Bucket counts (how many items in each bucket total)
 *   - Business profile (loaded same way generator does)
 *   - Voice profile + sample transcripts
 *   - Retrieved context per bucket -- titles + 200-char preview
 *
 * Hit ?prompt=... to mimic a generation; defaults to a generic query.
 */
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const prompt = req.nextUrl.searchParams.get("prompt") ?? "generate 3 original ideas"

  const admin = createAdminSupabase()

  const [counts, bizRow, voiceRow, retrieved] = await Promise.all([
    bucketCounts(),
    admin
      .from("business_profile")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("voice_profile")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    retrieveForGeneration(prompt),
  ])

  function shape(rows: typeof retrieved.video_ideas) {
    return rows.map((r) => ({
      id: r.id,
      title: r.title,
      summary: r.summary?.slice(0, 200) ?? null,
      processed_content_preview: r.processed_content?.slice(0, 200) ?? null,
      tags: r.tags,
      has_deep_analysis: Boolean(
        (r.metadata as Record<string, unknown>)?.deep_analysis
      ),
      has_expert_frameworks: Boolean(
        (r.metadata as Record<string, unknown>)?.expert_frameworks
      ),
      has_voice_signature: Boolean(
        (r.metadata as Record<string, unknown>)?.voice_signature
      ),
    }))
  }

  return NextResponse.json({
    prompt,
    bucket_counts: counts,
    business_profile: {
      niche: bizRow.data?.niche ?? null,
      avatar: bizRow.data?.avatar_description ?? null,
      offer: bizRow.data?.offer_description ?? null,
      lead_magnet: bizRow.data?.lead_magnet ?? null,
      default_comment_keyword: bizRow.data?.default_comment_keyword ?? null,
    },
    voice_profile: {
      tone_descriptor: voiceRow.data?.tone_descriptor ?? null,
      catchphrases: voiceRow.data?.catchphrases ?? [],
      do_not_use_phrases: voiceRow.data?.do_not_use_phrases ?? [],
      sample_transcripts_count: (voiceRow.data?.sample_transcripts ?? []).length,
      sample_transcripts_preview: (voiceRow.data?.sample_transcripts ?? [])
        .slice(0, 2)
        .map((s: string) => s.slice(0, 200)),
    },
    retrieved: {
      video_ideas: { count: retrieved.video_ideas.length, items: shape(retrieved.video_ideas) },
      inspiration: { count: retrieved.inspiration.length, items: shape(retrieved.inspiration) },
      expert_brain: { count: retrieved.expert_brain.length, items: shape(retrieved.expert_brain) },
      my_voice: { count: retrieved.my_voice.length, items: shape(retrieved.my_voice) },
      context: { count: retrieved.context.length, items: shape(retrieved.context) },
      instructions: { count: retrieved.instructions.length, items: shape(retrieved.instructions) },
      feedback: { count: retrieved.feedback.length, items: shape(retrieved.feedback) },
    },
    totals: {
      retrieved_items:
        retrieved.video_ideas.length +
        retrieved.inspiration.length +
        retrieved.expert_brain.length +
        retrieved.my_voice.length +
        retrieved.context.length +
        retrieved.instructions.length +
        retrieved.feedback.length,
    },
  })
}
