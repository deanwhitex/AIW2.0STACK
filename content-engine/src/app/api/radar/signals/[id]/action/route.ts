import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerSupabase } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/supabase/admin"
import { startIngest } from "@/lib/content-engine/ingest"
import { runGeneration } from "@/lib/content-engine/generator"

export const maxDuration = 300

const schema = z.object({
  action: z.enum(["save", "dismiss", "generate"]),
  prompt: z.string().optional(),
})

export async function POST(
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
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const admin = createAdminSupabase()
  const { data: signal, error } = await admin
    .from("niche_signals")
    .select("*")
    .eq("id", id)
    .single()
  if (error || !signal) return NextResponse.json({ error: "Not found" }, { status: 404 })

  if (parsed.data.action === "dismiss") {
    await admin
      .from("niche_signals")
      .update({
        status: "dismissed",
        user_actioned_at: new Date().toISOString(),
      })
      .eq("id", id)
    return NextResponse.json({ ok: true })
  }

  if (parsed.data.action === "save") {
    // Save the spiking content into the Inspiration bucket. We MUST pass
    // webhookBase so the Apify scrape and AssemblyAI transcription run
    // through the async webhook path. Without it, startIngest falls back
    // to the sync stub (which is why items previously got stuck in
    // "fetching" / "transcribing" with stub data).
    const webhookBase =
      process.env.NEXT_PUBLIC_APP_URL ??
      (() => {
        const proto = req.headers.get("x-forwarded-proto") ?? "https"
        const host =
          req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? ""
        return host ? `${proto}://${host}` : undefined
      })()

    const sourceType =
      signal.source === "tiktok"
        ? "tiktok_url"
        : signal.source === "youtube"
          ? "youtube_url"
          : "instagram_reel"
    const ingestResult = await startIngest(
      {
        bucket: "inspiration",
        source_type: sourceType,
        url: signal.content_url,
        title: signal.title_or_caption ?? undefined,
      },
      webhookBase
    )
    await admin
      .from("niche_signals")
      .update({
        status: "saved",
        user_actioned_at: new Date().toISOString(),
      })
      .eq("id", id)
    return NextResponse.json({ ok: true, ingest_id: ingestResult.id })
  }

  if (parsed.data.action === "generate") {
    // Look up the inspiration context_item that was auto-ingested for this
    // signal during the radar scan. If found, pass it as priority context
    // so retrieval pins it to position 0 of the inspiration block. The
    // spiking reel becomes the structural anchor for the new scripts.
    const { data: matchedInspiration } = await admin
      .from("context_items")
      .select("id")
      .eq("source_url", signal.content_url)
      .eq("bucket", "inspiration")
      .is("deleted_at", null)
      .maybeSingle()

    const prompt =
      parsed.data.prompt ??
      `Spike alert: this just hit. Write 3 reels in my voice that ride the same idea, but in my unique angle.\n\nReference: ${signal.title_or_caption ?? signal.content_url}\nSuggestion: ${signal.suggestion_text ?? ""}`
    const genResult = await runGeneration({
      prompt,
      format: "reel",
      count: 3,
      source: "radar",
      priority_inspiration_ids: matchedInspiration?.id
        ? [matchedInspiration.id as string]
        : undefined,
    })
    await admin
      .from("niche_signals")
      .update({
        status: "used",
        user_actioned_at: new Date().toISOString(),
        script_id: genResult.scripts[0]?.id ?? null,
      })
      .eq("id", id)
    return NextResponse.json({ ok: true, generation_id: genResult.generation_id })
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 })
}
