import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerSupabase } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/supabase/admin"

const VALID_STATUS = ["idea", "approved", "shot", "edited", "posted", "archived"] as const
const STAGE_TIMESTAMP_FIELD: Record<string, string | null> = {
  idea: null,
  approved: "approved_at",
  shot: "shot_at",
  edited: "edited_at",
  posted: "posted_at",
  archived: "archived_at",
}

const patchSchema = z.object({
  status: z.enum(VALID_STATUS).optional(),
  hook: z.string().optional(),
  body: z.string().optional(),
  cta: z.string().optional(),
  full_script: z.string().optional(),
  caption: z.string().optional(),
  keyword: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  topic: z.string().optional(),
  angle: z.string().optional(),
  notes: z.string().optional(),
  feedback_rating: z.enum(["up", "down"]).nullable().optional(),
  feedback_notes: z.string().optional(),
})

/**
 * When the user upvotes / downvotes a script, mirror the rating into the
 * Feedback bucket so future generations see the manual taste signal.
 * The system prompt says FEEDBACK outranks all other inputs except hard
 * instructions, so this is how the student's "do more of this / avoid this"
 * preference flows back into the engine.
 *
 * We use a stable synthetic source_url so re-rating the same script
 * updates the existing feedback row instead of creating duplicates.
 */
async function syncScriptFeedbackToBucket(
  scriptId: string,
  rating: "up" | "down" | null,
  notes: string | null
) {
  const admin = createAdminSupabase()
  const sourceUrl = `internal://script/${scriptId}/feedback`

  if (rating === null) {
    // Rating cleared: soft-delete any existing feedback row for this script.
    await admin
      .from("context_items")
      .update({ deleted_at: new Date().toISOString() })
      .eq("source_url", sourceUrl)
      .is("deleted_at", null)
    return
  }

  const { data: script } = await admin
    .from("scripts")
    .select("hook, hook_formula, body, content_format, topic")
    .eq("id", scriptId)
    .maybeSingle()
  if (!script) return

  const verb = rating === "up" ? "UP_VOTED" : "DOWN_VOTED"
  const directive =
    rating === "up"
      ? "Pattern to repeat. The creator marked this script as a keeper before posting."
      : "Pattern to avoid. The creator marked this script as off before posting — likely voice mismatch, weak hook, or off-angle for the avatar."

  const lines = [
    `${verb} script — ${(script.hook as string | null) ?? "(no hook)"}`,
    "",
    directive,
    "",
    `Hook formula: ${(script.hook_formula as string | null) ?? "n/a"}`,
    `Content format: ${(script.content_format as string | null) ?? "n/a"}`,
    `Topic: ${(script.topic as string | null) ?? "n/a"}`,
    notes ? `\nUser note: ${notes}` : "",
    "",
    `[verdict:${rating}] [source:manual_rating] [script_id:${scriptId}]`,
  ].filter((l) => l !== null)

  // Upsert: update existing row by source_url if present, else insert new.
  const { data: existing } = await admin
    .from("context_items")
    .select("id")
    .eq("source_url", sourceUrl)
    .is("deleted_at", null)
    .maybeSingle()

  const payload = {
    bucket: "feedback" as const,
    source_type: "text" as const,
    source_url: sourceUrl,
    title: `${verb} · ${((script.hook as string | null) ?? "").slice(0, 50)}`,
    raw_input: lines.join("\n"),
    processed_content: lines.join("\n"),
    summary: directive,
    tags: [
      "feedback",
      "manual_rating",
      rating,
      (script.hook_formula as string | null) ?? "no_formula",
    ],
    status: "ready" as const,
    metadata: { script_id: scriptId, rating, source: "manual_rating" },
  }

  if (existing) {
    await admin.from("context_items").update(payload).eq("id", existing.id as string)
  } else {
    await admin.from("context_items").insert(payload)
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from("scripts")
    .select("*")
    .eq("id", id)
    .maybeSingle()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data) return NextResponse.json({ error: "Not found" }, { status: 404 })
  return NextResponse.json(data)
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const body = await req.json()
  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const updates: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.status) {
    const tsField = STAGE_TIMESTAMP_FIELD[parsed.data.status]
    if (tsField) updates[tsField] = new Date().toISOString()
  }
  if (parsed.data.feedback_rating !== undefined) {
    updates.feedback_at = parsed.data.feedback_rating ? new Date().toISOString() : null
  }

  const { data, error } = await supabase
    .from("scripts")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Mirror manual feedback into the Feedback bucket so it influences
  // future generations. Best-effort: failure here doesn't fail the patch.
  if (parsed.data.feedback_rating !== undefined) {
    try {
      await syncScriptFeedbackToBucket(
        id,
        parsed.data.feedback_rating,
        parsed.data.feedback_notes ?? null
      )
    } catch (e) {
      console.error("[scripts.PATCH] feedback sync failed:", e)
    }
  }

  return NextResponse.json(data)
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const { id } = await params
  const { error } = await supabase
    .from("scripts")
    .update({ status: "archived", archived_at: new Date().toISOString() })
    .eq("id", id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
