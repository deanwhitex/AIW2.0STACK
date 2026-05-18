import { NextRequest, NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"

export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const status = req.nextUrl.searchParams.get("status")
  const format = req.nextUrl.searchParams.get("format")
  // Archived scripts are excluded by default so the kanban header count
  // and the cards list reflect what's actually visible. Pass
  // ?include_archived=true to opt into seeing them.
  const includeArchived = req.nextUrl.searchParams.get("include_archived") === "true"
  const limit = Math.min(Number(req.nextUrl.searchParams.get("limit") ?? 200), 500)

  let q = supabase
    .from("scripts")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(limit)

  if (status) q = q.eq("status", status)
  else if (!includeArchived) q = q.neq("status", "archived")
  if (format) q = q.eq("format", format)

  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ rows: data ?? [] })
}
