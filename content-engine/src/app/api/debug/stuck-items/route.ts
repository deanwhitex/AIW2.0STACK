import { NextRequest, NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/supabase/admin"

/**
 * Debug-only endpoint. Returns every non-terminal context_item plus
 * the most recent items in failed state, with their full status,
 * error_message, source_url, and the assemblyai_transcript_id /
 * apify_run_id from metadata. Use to diagnose stuck transcripts and
 * Apify webhook failures without needing direct DB access.
 */
export async function GET(_req: NextRequest) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = createAdminSupabase()

  const { data: stuck, error: stuckErr } = await admin
    .from("context_items")
    .select(
      "id, bucket, source_type, source_url, title, status, error_message, metadata, created_at, updated_at"
    )
    .in("status", ["queued", "fetching", "transcribing", "summarising"])
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(50)

  const { data: recentFailed, error: failedErr } = await admin
    .from("context_items")
    .select(
      "id, bucket, source_type, source_url, title, status, error_message, metadata, created_at, updated_at"
    )
    .eq("status", "failed")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(20)

  function shape(rows: typeof stuck) {
    return (rows ?? []).map((r) => {
      const meta = (r.metadata ?? {}) as Record<string, unknown>
      return {
        id: r.id,
        bucket: r.bucket,
        source_type: r.source_type,
        source_url: r.source_url,
        title: r.title,
        status: r.status,
        error_message: r.error_message,
        apify_run_id: meta.apify_run_id ?? null,
        assemblyai_transcript_id: meta.assemblyai_transcript_id ?? null,
        scrape_mode: meta.scrape_mode ?? null,
        audio_transcript_pending: meta.audio_transcript_pending ?? null,
        updated_at: r.updated_at,
        created_at: r.created_at,
      }
    })
  }

  return NextResponse.json({
    stuck: shape(stuck),
    recent_failed: shape(recentFailed),
    counts: {
      stuck: (stuck ?? []).length,
      recent_failed: (recentFailed ?? []).length,
    },
    errors: {
      stuck: stuckErr?.message ?? null,
      failed: failedErr?.message ?? null,
    },
  })
}
