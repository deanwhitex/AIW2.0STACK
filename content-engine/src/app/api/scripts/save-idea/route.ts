import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerSupabase } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/supabase/admin"

const HOOK_FORMULAS = [
  "contrarian",
  "curiosity_gap",
  "pain_point",
  "secret_value",
  "time_bound_result",
  "mistake_callout",
  "numbered_list",
] as const

const CONTENT_FORMATS = [
  "talking_head",
  "process_demo",
  "storytelling",
  "list_breakdown",
  "walk_and_talk",
  "duo_dialog",
  "broll_voiceover",
  "before_after",
] as const

// Accepts either:
//  - A hook-only ideation proposal (hook + topic + angle + why_it_works)
//  - A full generated script (the GeneratedScript shape from Claude)
// Both create a row at status='idea'. Hook-only rows render with the
// "Hook only" badge until the user clicks Expand to fill in body / cta.
const schema = z.object({
  format: z.enum(["reel", "carousel", "story_sequence", "long_form"]),
  prompt: z.string().min(1).max(4000),
  length: z.enum(["short", "medium", "long"]).optional(),
  topic: z.string(),
  angle: z.string(),
  why_it_works: z.string().optional().default(""),
  hook: z.string().optional(),
  hook_formula: z.enum(HOOK_FORMULAS).optional(),
  title: z.string().optional(),
  // Full-script fields (all optional). When present, the row is fully
  // formed and the kanban card renders without the "Hook only" badge.
  body: z.string().optional(),
  cta: z.string().optional(),
  full_script: z.string().optional(),
  caption: z.string().optional(),
  keyword: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  target_length_s: z.number().int().optional(),
  total_duration_min: z.number().int().optional(),
  content_format: z.enum(CONTENT_FORMATS).optional(),
  shot_ideas: z.array(z.string()).optional(),
  slides: z.array(z.record(z.string(), z.unknown())).optional(),
  sections: z.array(z.record(z.string(), z.unknown())).optional(),
})

const TARGET_LENGTH_S: Record<string, number> = {
  reel_short: 20,
  reel_medium: 35,
  reel_long: 75,
  carousel: 0,
  story_sequence: 60,
  long_form: 600,
}

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

  const p = parsed.data
  const lengthKey = p.format === "reel" ? `reel_${p.length ?? "medium"}` : p.format
  const fallbackLength = TARGET_LENGTH_S[lengthKey] ?? 30
  const target_length_s = p.target_length_s ?? fallbackLength

  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from("scripts")
    .insert({
      format: p.format,
      status: "idea" as const,
      hook: p.hook ?? null,
      hook_formula: p.hook_formula ?? null,
      body: p.body ?? null,
      cta: p.cta ?? null,
      full_script: p.full_script ?? null,
      caption: p.caption ?? null,
      keyword: p.keyword ? p.keyword.toUpperCase().trim() : null,
      hashtags: p.hashtags ?? [],
      topic: p.topic,
      angle: p.angle,
      title: p.title ?? null,
      total_duration_min: p.total_duration_min ?? null,
      content_format: p.content_format ?? null,
      why_it_works: p.why_it_works,
      shot_ideas: p.shot_ideas ?? [],
      slides: p.slides ?? null,
      sections: p.sections ?? null,
      target_length_s,
      generation_source: "chat" as const,
      generation_prompt: p.prompt,
    })
    .select("*")
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ script: data })
}
