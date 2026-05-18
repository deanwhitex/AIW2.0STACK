import { NextRequest, NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"
import { expandIdeaScript } from "@/lib/content-engine/generator"

export const maxDuration = 120

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  try {
    const result = await expandIdeaScript(id)
    return NextResponse.json({
      script_id: result.script_id,
      data: result.data,
      mode: result.mode,
      cost_usd: result.cost_usd,
      duration_ms: result.duration_ms,
    })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Expansion failed" },
      { status: 500 }
    )
  }
}
