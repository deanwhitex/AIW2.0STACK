import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerSupabase } from "@/lib/supabase/server"
import { proposeRadarSeed } from "@/lib/ai/claude"
import { createAdminSupabase } from "@/lib/supabase/admin"

export const maxDuration = 60

const proposeSchema = z.object({
  niche: z.string().min(1),
  avatar: z.string().optional(),
  offer: z.string().optional(),
})

const applySchema = z.object({
  hashtags: z.array(z.object({ platform: z.string(), value: z.string() })),
  creator_handles: z.array(z.object({ platform: z.string(), value: z.string() })),
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
    const result = await proposeRadarSeed(parsed.data)
    return NextResponse.json({ proposal: result.data, mode: result.mode })
  }

  if (body.action === "apply") {
    const parsed = applySchema.safeParse(body)
    if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 })
    const admin = createAdminSupabase()
    const rows = [
      ...parsed.data.hashtags.map((h) => ({
        type: "hashtag" as const,
        platform: h.platform,
        value: h.value,
      })),
      ...parsed.data.creator_handles.map((c) => ({
        type: "creator_handle" as const,
        platform: c.platform,
        value: c.value,
      })),
    ]
    if (rows.length > 0) {
      await admin.from("niche_watch").upsert(rows, {
        onConflict: "type,platform,value",
        ignoreDuplicates: true,
      })
    }
    return NextResponse.json({ ok: true, applied: rows.length })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
