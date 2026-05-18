import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase/admin"
import { reprocessItem } from "@/lib/content-engine/ingest"

export const maxDuration = 300

/**
 * Auto-recovery cron. Finds context_items stuck in "fetching" or
 * "transcribing" for more than STUCK_THRESHOLD_MIN minutes and runs
 * reprocessItem on each. reprocessItem already has recovery paths:
 *   - status=fetching + apify_run_id -> pulls the dataset directly
 *   - status=transcribing + assemblyai_transcript_id -> pulls transcript
 * So most "stuck" items unstick themselves on the next cron tick once
 * the upstream job has actually completed.
 *
 * Triggered by Vercel Cron every 5 minutes (see vercel.json).
 */
const STUCK_THRESHOLD_MIN = 4
const PER_RUN_CAP = 25 // safety cap so a flood doesn't blow the budget

function authorised(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return true
  const auth = req.headers.get("authorization")
  if (auth === `Bearer ${expected}`) return true
  const q = req.nextUrl.searchParams.get("secret")
  return q === expected
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const admin = createAdminSupabase()
  const cutoff = new Date(Date.now() - STUCK_THRESHOLD_MIN * 60_000).toISOString()

  const { data: stuck, error } = await admin
    .from("context_items")
    .select("id, status, updated_at")
    .in("status", ["fetching", "transcribing"])
    .is("deleted_at", null)
    .lte("updated_at", cutoff)
    .order("updated_at", { ascending: true })
    .limit(PER_RUN_CAP)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const webhookBase = process.env.NEXT_PUBLIC_APP_URL
  const recovered: string[] = []
  const stillStuck: string[] = []
  const failed: { id: string; error: string }[] = []

  for (const row of stuck ?? []) {
    const id = row.id as string
    try {
      const out = await reprocessItem(id, webhookBase)
      if (out.status === "ready") recovered.push(id)
      else stillStuck.push(id)
    } catch (e) {
      failed.push({ id, error: e instanceof Error ? e.message : String(e) })
    }
  }

  return NextResponse.json({
    ok: true,
    inspected: stuck?.length ?? 0,
    recovered,
    still_stuck: stillStuck,
    failed,
  })
}

export async function POST(req: NextRequest) {
  return GET(req)
}
