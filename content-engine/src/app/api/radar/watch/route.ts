import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerSupabase } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data, error } = await supabase
    .from("niche_watch")
    .select("*")
    .order("added_at", { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rows: data ?? [] })
}

const addSchema = z.object({
  type: z.enum(["creator_handle", "hashtag"]),
  platform: z.enum(["instagram", "tiktok", "youtube"]),
  value: z.string().min(1),
})

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = addSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }
  let value = parsed.data.value.trim()
  if (parsed.data.type === "hashtag" && !value.startsWith("#")) value = `#${value}`
  if (parsed.data.type === "creator_handle" && !value.startsWith("@")) value = `@${value}`

  const { data, error } = await supabase
    .from("niche_watch")
    .insert({ ...parsed.data, value })
    .select("*")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}
