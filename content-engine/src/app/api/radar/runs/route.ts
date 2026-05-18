import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"

export async function GET() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { data: runs, error } = await supabase
    .from("niche_watch_runs")
    .select(`
      id,
      watch_id,
      status,
      started_at,
      completed_at,
      items_pulled,
      signals_created,
      error_message,
      niche_watch (
        type,
        platform,
        value
      )
    `)
    .order("started_at", { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ rows: runs ?? [] })
}
