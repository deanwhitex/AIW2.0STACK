import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerSupabase } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/supabase/admin"
import { generateIdeas } from "@/lib/ai/claude"
import { retrieveForGeneration } from "@/lib/content-engine/retrieval"
import type { BusinessProfile, VoiceProfile } from "@/lib/ai/types"

export const maxDuration = 60

const schema = z.object({
  prompt: z.string().min(1).max(4000),
  format: z.enum(["reel", "carousel", "story_sequence", "long_form"]).default("reel"),
  length: z.enum(["short", "medium", "long"]).default("medium"),
  count: z.number().int().min(1).max(20).default(10),
})

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 }
    )
  }

  try {
    const admin = createAdminSupabase()

    const [bizRow, voiceRow, retrieved] = await Promise.all([
      admin.from("business_profile").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      admin.from("voice_profile").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle(),
      retrieveForGeneration(parsed.data.prompt),
    ])

    const business: BusinessProfile = {
      niche: bizRow.data?.niche ?? null,
      avatar_description: bizRow.data?.avatar_description ?? null,
      offer_description: bizRow.data?.offer_description ?? null,
      lead_magnet: bizRow.data?.lead_magnet ?? null,
      default_comment_keyword: bizRow.data?.default_comment_keyword ?? null,
    }
    const voice: VoiceProfile = {
      tone_descriptor: voiceRow.data?.tone_descriptor ?? null,
      catchphrases: Array.isArray(voiceRow.data?.catchphrases) ? voiceRow.data.catchphrases : [],
      do_not_use_phrases: Array.isArray(voiceRow.data?.do_not_use_phrases) ? voiceRow.data.do_not_use_phrases : [],
      sample_transcripts: Array.isArray(voiceRow.data?.sample_transcripts) ? voiceRow.data.sample_transcripts : [],
    }

    const out = await generateIdeas({
      request: parsed.data.prompt,
      format: parsed.data.format,
      length: parsed.data.length,
      count: parsed.data.count,
      business,
      voice,
      retrieved,
    })

    return NextResponse.json({
      ideas: out.data,
      mode: out.mode,
      cost_usd: out.cost_usd,
      duration_ms: out.duration_ms,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Ideation failed" },
      { status: 500 }
    )
  }
}
