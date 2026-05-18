import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerSupabase } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/supabase/admin"

const schema = z.object({
  niche: z.string().nullable().optional(),
  avatar_description: z.string().nullable().optional(),
  offer_description: z.string().nullable().optional(),
  lead_magnet: z.string().nullable().optional(),
  default_comment_keyword: z.string().nullable().optional(),
  geographic_focus: z.string().nullable().optional(),
  onboarding_step: z.number().int().min(0).max(99).optional(),
  onboarding_completed_at: z.string().nullable().optional(),
})

export async function PATCH(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const body = await req.json()
    const parsed = schema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request", issues: parsed.error.issues }, { status: 400 })
    }

    const admin = createAdminSupabase()
    const { data: existing, error: selectError } = await admin
      .from("business_profile")
      .select("id")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()

    if (selectError) {
      console.error("[setup/business] select error:", selectError)
      return NextResponse.json({ error: selectError.message }, { status: 500 })
    }

    if (existing) {
      const { data, error } = await admin
        .from("business_profile")
        .update(parsed.data)
        .eq("id", existing.id)
        .select("*")
        .single()
      if (error) {
        console.error("[setup/business] update error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json(data)
    } else {
      const { data, error } = await admin
        .from("business_profile")
        .insert(parsed.data)
        .select("*")
        .single()
      if (error) {
        console.error("[setup/business] insert error:", error)
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      return NextResponse.json(data)
    }
  } catch (e) {
    console.error("[setup/business] unhandled error:", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Server error" }, { status: 500 })
  }
}
