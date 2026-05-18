import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerSupabase } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/supabase/admin"

const PLATFORM_PATTERNS: { platform: string; re: RegExp }[] = [
  { platform: "instagram_reels", re: /instagram\.com\/reel\// },
  { platform: "instagram_feed", re: /instagram\.com\/p\// },
  { platform: "instagram_stories", re: /instagram\.com\/stories\// },
  { platform: "tiktok", re: /tiktok\.com\/@.+\/video\// },
  { platform: "youtube_shorts", re: /youtube\.com\/shorts\// },
]

const schema = z.object({
  external_url: z.string().url(),
  script_id: z.string().uuid().optional(),
  posted_at: z.string().optional(),
  notes: z.string().optional(),
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
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const platformMatch = PLATFORM_PATTERNS.find((p) => p.re.test(parsed.data.external_url))
  if (!platformMatch) {
    return NextResponse.json(
      { error: "URL must be Instagram, TikTok, or YouTube Shorts" },
      { status: 400 }
    )
  }

  const admin = createAdminSupabase()

  // Check duplicates
  const { data: existing } = await admin
    .from("posts")
    .select("id")
    .eq("external_url", parsed.data.external_url)
    .maybeSingle()
  if (existing) {
    return NextResponse.json(
      { error: "This URL is already tracked", id: existing.id },
      { status: 409 }
    )
  }

  const { data, error } = await admin
    .from("posts")
    .insert({
      external_url: parsed.data.external_url,
      platform: platformMatch.platform,
      script_id: parsed.data.script_id ?? null,
      posted_at: parsed.data.posted_at ?? new Date().toISOString(),
      notes: parsed.data.notes ?? null,
    })
    .select("*")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If linked to a script, flip its status to 'posted'
  if (parsed.data.script_id) {
    await admin
      .from("scripts")
      .update({ status: "posted", posted_at: new Date().toISOString() })
      .eq("id", parsed.data.script_id)
  }

  return NextResponse.json(data)
}
