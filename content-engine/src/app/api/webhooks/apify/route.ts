import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase/admin"
import { fetchApifyDataset, parseInstagramItem, parseTikTokItem } from "@/lib/apify/client"
import { buildReelContent, buildTikTokContent } from "@/lib/content-engine/ingest"
import { submitTranscriptionAsync } from "@/lib/transcribe/assemblyai"
import { isWebhookAuthorized, withWebhookSecret } from "@/lib/webhooks/secret"
import type { ContextItemRow } from "@/lib/content-engine/types"
import type { ScrapedReel, ScrapedTikTok } from "@/lib/apify/types"

export const maxDuration = 300

export async function POST(req: NextRequest) {
  if (!isWebhookAuthorized(req)) {
    console.warn("[webhooks/apify] rejected: bad or missing secret")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const itemId = req.nextUrl.searchParams.get("item_id")
  const sourceType = req.nextUrl.searchParams.get("source_type")

  if (!itemId || !sourceType) {
    return NextResponse.json({ error: "Missing item_id or source_type" }, { status: 400 })
  }

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const resource = body.resource as Record<string, unknown> | undefined
  const eventData = body.eventData as Record<string, unknown> | undefined
  const eventType = body.eventType as string | undefined
  const status = resource?.status as string | undefined

  const admin = createAdminSupabase()

  if (eventType === "ACTOR.RUN.FAILED" || status === "FAILED") {
    await admin
      .from("context_items")
      .update({ status: "failed", error_message: "Apify run failed" })
      .eq("id", itemId)
    return NextResponse.json({ ok: true })
  }

  const datasetId = (resource?.defaultDatasetId ?? eventData?.defaultDatasetId) as string | undefined
  if (!datasetId) {
    console.error("[webhooks/apify] no datasetId in payload:", JSON.stringify(body).slice(0, 500))
    await admin
      .from("context_items")
      .update({ status: "failed", error_message: "Apify webhook missing dataset ID" })
      .eq("id", itemId)
    return NextResponse.json({ ok: true })
  }

  const { data: item } = await admin
    .from("context_items")
    .select("source_url")
    .eq("id", itemId)
    .single()

  const sourceUrl = (item?.source_url as string | null) ?? ""

  try {
    const items = await fetchApifyDataset(datasetId)
    const raw = items[0]

    if (!raw) {
      await admin
        .from("context_items")
        .update({ status: "failed", error_message: "Apify returned empty dataset" })
        .eq("id", itemId)
      return NextResponse.json({ ok: true })
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL

    console.log(`[webhooks/apify] item=${itemId} source=${sourceType} appUrl=${appUrl ?? "MISSING"} datasetItems=${items.length}`)

    if (sourceType === "instagram_reel") {
      const reelData = parseInstagramItem(raw, sourceUrl)
      console.log(`[webhooks/apify] reel parsed: video_url=${reelData.video_url ?? "NULL"} author=${reelData.author_username ?? "NULL"}`)
      await saveReelWithTranscription(itemId, reelData, raw, admin, appUrl)
    } else if (sourceType === "tiktok_url") {
      const tikData = parseTikTokItem(raw, sourceUrl)
      console.log(`[webhooks/apify] tiktok parsed: video_url=${tikData.video_url ?? "NULL"}`)
      await saveTikTokWithTranscription(itemId, tikData, raw, admin, appUrl)
    } else {
      await admin
        .from("context_items")
        .update({ status: "failed", error_message: `Unknown source_type: ${sourceType}` })
        .eq("id", itemId)
    }

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[webhooks/apify] processing failed:", e)
    await admin
      .from("context_items")
      .update({
        status: "failed",
        error_message: e instanceof Error ? e.message : String(e),
      })
      .eq("id", itemId)
    return NextResponse.json({ error: "Processing failed" }, { status: 500 })
  }
}

async function saveReelWithTranscription(
  itemId: string,
  reel: ScrapedReel,
  raw: Record<string, unknown>,
  admin: ReturnType<typeof createAdminSupabase>,
  appUrl: string | undefined
) {
  const built = await buildReelContent(itemId, reel, admin, { skipTranscription: true })
  const quickSummary = buildReelSummary(reel)
  const quickTags = reel.hashtags.slice(0, 8)

  if (reel.video_url && appUrl) {
    const webhookUrl = withWebhookSecret(`${appUrl}/api/webhooks/assemblyai?item_id=${itemId}`)
    console.log(`[webhooks/apify] submitting to AssemblyAI: video_url=${reel.video_url.slice(0, 80)} webhook=${webhookUrl}`)
    const { transcriptId, mode } = await submitTranscriptionAsync(reel.video_url, webhookUrl)
    console.log(`[webhooks/apify] AssemblyAI response: mode=${mode} transcriptId=${transcriptId ?? "NULL"}`)

    if (mode === "real" && transcriptId) {
      const row: Partial<ContextItemRow> = {
        processed_content: built.processed_content,
        raw_payload: raw,
        summary: quickSummary,
        tags: quickTags,
        metadata: { ...built.metadata, assemblyai_transcript_id: transcriptId },
        status: "transcribing",
        error_message: null,
        title: built.title_hint ?? undefined,
      }
      const { error: updErr } = await admin.from("context_items").update(row).eq("id", itemId)
      if (updErr) console.error(`[webhooks/apify] DB update failed (transcribing path):`, updErr)
      else console.log(`[webhooks/apify] item ${itemId} marked transcribing`)
      return
    }
  } else {
    console.log(`[webhooks/apify] skipping AssemblyAI -- video_url=${reel.video_url ?? "NULL"} appUrl=${appUrl ?? "NULL"}`)
  }

  // No transcription available — save caption-only and mark ready
  const row: Partial<ContextItemRow> = {
    processed_content: built.processed_content,
    raw_payload: raw,
    summary: quickSummary,
    tags: quickTags,
    metadata: built.metadata,
    status: "ready",
    error_message: null,
    title: built.title_hint ?? undefined,
  }
  const { error: updErr2 } = await admin.from("context_items").update(row).eq("id", itemId)
  if (updErr2) console.error(`[webhooks/apify] DB update failed (ready path):`, updErr2)
  else console.log(`[webhooks/apify] item ${itemId} marked ready (no transcription)`)
}

async function saveTikTokWithTranscription(
  itemId: string,
  tik: ScrapedTikTok,
  raw: Record<string, unknown>,
  admin: ReturnType<typeof createAdminSupabase>,
  appUrl: string | undefined
) {
  const built = await buildTikTokContent(itemId, tik, admin, { skipTranscription: true })
  const quickSummary = buildTikTokSummary(tik)
  const quickTags = tik.hashtags.slice(0, 8)

  if (tik.video_url && appUrl) {
    const webhookUrl = withWebhookSecret(`${appUrl}/api/webhooks/assemblyai?item_id=${itemId}`)
    const { transcriptId, mode } = await submitTranscriptionAsync(tik.video_url, webhookUrl)

    if (mode === "real" && transcriptId) {
      const row: Partial<ContextItemRow> = {
        processed_content: built.processed_content,
        raw_payload: raw,
        summary: quickSummary,
        tags: quickTags,
        metadata: { ...built.metadata, assemblyai_transcript_id: transcriptId },
        status: "transcribing",
        error_message: null,
        title: built.title_hint ?? undefined,
      }
      await admin.from("context_items").update(row).eq("id", itemId)
      return
    }
  }

  const row: Partial<ContextItemRow> = {
    processed_content: built.processed_content,
    raw_payload: raw,
    summary: quickSummary,
    tags: quickTags,
    metadata: built.metadata,
    status: "ready",
    error_message: null,
    title: built.title_hint ?? undefined,
  }
  await admin.from("context_items").update(row).eq("id", itemId)
}

function buildReelSummary(r: ScrapedReel): string {
  return [
    r.author_username ? `@${r.author_username}` : null,
    r.metrics.views ? `${r.metrics.views.toLocaleString()} views` : null,
    r.caption ? r.caption.slice(0, 200) : null,
  ].filter(Boolean).join(" · ")
}

function buildTikTokSummary(r: ScrapedTikTok): string {
  return [
    r.author_username ? `@${r.author_username}` : null,
    r.metrics.views ? `${r.metrics.views.toLocaleString()} views` : null,
    r.caption ? r.caption.slice(0, 200) : null,
  ].filter(Boolean).join(" · ")
}
