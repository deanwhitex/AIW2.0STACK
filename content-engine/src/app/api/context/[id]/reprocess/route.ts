import { NextRequest, NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"
import { reprocessItem } from "@/lib/content-engine/ingest"

export const maxDuration = 300

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params

  const webhookBase = process.env.NEXT_PUBLIC_APP_URL
    ?? (() => {
        const proto = req.headers.get("x-forwarded-proto") ?? "https"
        const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? ""
        return host ? `${proto}://${host}` : undefined
      })()

  try {
    const result = await reprocessItem(id, webhookBase)
    return NextResponse.json({ id, status: result.status })
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Reprocess failed" },
      { status: 500 }
    )
  }
}
