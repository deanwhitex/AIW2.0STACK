import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"
import { runRadarScan } from "@/lib/radar/run"

export const maxDuration = 300

export async function POST() {
  try {
    const supabase = await createServerSupabase()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const result = await runRadarScan()
    return NextResponse.json({ ok: true, ...result })
  } catch (e) {
    console.error("[radar/scan]", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Scan failed" }, { status: 500 })
  }
}
