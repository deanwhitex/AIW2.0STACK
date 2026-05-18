import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerSupabase } from "@/lib/supabase/server"
import { runGeneration } from "@/lib/content-engine/generator"

export const maxDuration = 120

const anchorSchema = z.object({
  id: z.string(),
  format: z.enum(["reel", "carousel", "story_sequence", "long_form"]),
  topic: z.string(),
  angle: z.string(),
  why_it_works: z.string().optional().default(""),
  hook: z.string().optional(),
  hook_formula: z
    .enum([
      "contrarian",
      "curiosity_gap",
      "pain_point",
      "secret_value",
      "time_bound_result",
      "mistake_callout",
      "numbered_list",
    ])
    .optional(),
  title: z.string().optional(),
})

const schema = z.object({
  prompt: z.string().min(1).max(4000),
  format: z.enum(["reel", "carousel", "story_sequence", "long_form"]).default("reel"),
  length: z.enum(["short", "medium", "long"]).default("medium"),
  count: z.number().int().min(1).max(10).default(3),
  source: z.enum(["chat", "radar", "manual", "regenerate"]).default("chat"),
  // When the client has already picked specific ideation proposals, pass
  // them through. Each anchor maps 1:1 to a resulting script. Count is
  // ignored when anchors are provided.
  anchors: z.array(anchorSchema).optional(),
  // Inspiration items that must be hoisted to position 0 of retrieval.
  // Used by the radar "generate my version" flow so the spiking reel
  // anchors the structure regardless of FTS rank.
  priority_inspiration_ids: z.array(z.string().uuid()).optional(),
  // When false, generated scripts are returned without writing rows.
  // Workspace passes false so generated cards live in chat until the
  // user clicks "Push to Pipeline". Defaults true to preserve other
  // callers (radar "generate my version", etc.).
  persist: z.boolean().optional().default(true),
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
    const result = await runGeneration(parsed.data)
    return NextResponse.json({
      generation_id: result.generation_id,
      scripts: result.scripts,
      mode: result.mode,
      cost_usd: result.cost_usd,
      duration_ms: result.duration_ms,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Generation failed" },
      { status: 500 }
    )
  }
}
