import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerSupabase } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/supabase/admin"

const schema = z.object({
  tone_descriptor: z.string().nullable().optional(),
  catchphrases: z.array(z.string()).optional(),
  do_not_use_phrases: z.array(z.string()).optional(),
  sample_transcripts: z.array(z.string()).optional(),
})

export async function PATCH(req: NextRequest) {
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

  const admin = createAdminSupabase()
  const { data: existing } = await admin
    .from("voice_profile")
    .select("id")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (existing) {
    const { data, error } = await admin
      .from("voice_profile")
      .update(parsed.data)
      .eq("id", existing.id)
      .select("*")
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  } else {
    const { data, error } = await admin
      .from("voice_profile")
      .insert(parsed.data)
      .select("*")
      .single()
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json(data)
  }
}
