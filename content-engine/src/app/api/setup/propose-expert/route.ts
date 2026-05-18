import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerSupabase } from "@/lib/supabase/server"
import { proposeExpertBrain } from "@/lib/ai/claude"
import { startIngest } from "@/lib/content-engine/ingest"

export const maxDuration = 300

const proposeSchema = z.object({ niche: z.string().min(1), avatar: z.string().optional() })
const applySchema = z.object({
  sources: z.array(z.object({ title: z.string(), url: z.string().url(), reason: z.string() })),
})

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()

  if (body.action === "propose") {
    const parsed = proposeSchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    const result = await proposeExpertBrain(parsed.data)
    return NextResponse.json({ proposal: result.data, mode: result.mode })
  }

  if (body.action === "apply") {
    const parsed = applySchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })

    const ids: string[] = []
    for (const src of parsed.data.sources) {
      const isYouTube = /youtube\.com|youtu\.be/.test(src.url)
      const result = await startIngest({
        bucket: "expert_brain",
        source_type: isYouTube ? "youtube_url" : "link",
        url: src.url,
        title: src.title,
      })
      ids.push(result.id)
    }
    return NextResponse.json({ ok: true, ids })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
