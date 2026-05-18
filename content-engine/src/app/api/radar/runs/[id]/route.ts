import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const { data: run, error: runErr } = await supabase
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
      niche_watch ( type, platform, value )
    `)
    .eq("id", id)
    .maybeSingle()

  if (runErr || !run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 })
  }

  // Find signals captured during this run's window. We use the time range
  // because niche_signals is keyed on watch_id, not run_id.
  const startedAt = run.started_at as string
  const completedAt = (run.completed_at as string | null) ?? new Date().toISOString()

  const { data: signals } = await supabase
    .from("niche_signals")
    .select("id, content_url, source_handle, title_or_caption, posted_at, metrics, velocity_score, hook_formula, suggestion_text, status, captured_at")
    .eq("watch_id", run.watch_id)
    .gte("captured_at", startedAt)
    .lte("captured_at", completedAt)
    .order("velocity_score", { ascending: false })

  return NextResponse.json({ run, signals: signals ?? [] })
}
