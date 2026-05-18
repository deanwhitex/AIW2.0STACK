import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/supabase/admin"
import { getAllSecretsStatus } from "@/lib/supabase/secrets"

export async function GET() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = createAdminSupabase()
  const { data: business } = await admin
    .from("business_profile")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  const { data: voice } = await admin
    .from("voice_profile")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  const { data: watch } = await admin.from("niche_watch").select("id").limit(1)
  const { count: contextCount } = await admin
    .from("context_items")
    .select("id", { count: "exact", head: true })
    .is("deleted_at", null)
  const { count: scriptCount } = await admin
    .from("scripts")
    .select("id", { count: "exact", head: true })

  const secrets = await getAllSecretsStatus()

  return NextResponse.json({
    business,
    voice,
    has_watch: (watch ?? []).length > 0,
    context_count: contextCount ?? 0,
    script_count: scriptCount ?? 0,
    secrets,
    onboarding_step: business?.onboarding_step ?? 0,
    onboarding_completed_at: business?.onboarding_completed_at ?? null,
  })
}
