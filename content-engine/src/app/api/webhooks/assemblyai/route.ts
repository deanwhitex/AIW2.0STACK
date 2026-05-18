import { NextRequest, NextResponse } from "next/server"
import { createAdminSupabase } from "@/lib/supabase/admin"
import { getTranscriptionById } from "@/lib/transcribe/assemblyai"
import {
  analyseInspirationVideo,
  extractExpertFrameworks,
  extractVoiceSignature,
} from "@/lib/ai/claude"
import { isWebhookAuthorized } from "@/lib/webhooks/secret"

export const maxDuration = 60

export async function POST(req: NextRequest) {
  if (!isWebhookAuthorized(req)) {
    console.warn("[webhooks/assemblyai] rejected: bad or missing secret")
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const itemId = req.nextUrl.searchParams.get("item_id")
  if (!itemId) return NextResponse.json({ error: "Missing item_id" }, { status: 400 })

  let body: Record<string, unknown>
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
  }

  const transcriptId = body.transcript_id as string | undefined
  const status = body.status as string | undefined

  if (!transcriptId) {
    return NextResponse.json({ error: "Missing transcript_id" }, { status: 400 })
  }

  const admin = createAdminSupabase()

  if (status === "error") {
    await admin
      .from("context_items")
      .update({
        status: "failed",
        error_message: `Transcription failed: ${body.error ?? "unknown error"}`,
      })
      .eq("id", itemId)
    return NextResponse.json({ ok: true })
  }

  try {
    const result = await getTranscriptionById(transcriptId)

    if (result.status === "error") {
      await admin
        .from("context_items")
        .update({ status: "failed", error_message: "Transcription returned error status" })
        .eq("id", itemId)
      return NextResponse.json({ ok: true })
    }

    // Get existing item to append transcript and run analysis
    const { data: item } = await admin
      .from("context_items")
      .select("processed_content, metadata, summary, title, bucket, source_type")
      .eq("id", itemId)
      .single()

    const existingContent = (item?.processed_content as string | null) ?? ""
    const existingMeta = (item?.metadata as Record<string, unknown> | null) ?? {}
    const bucket = (item?.bucket as string | null) ?? null
    const sourceType = (item?.source_type as string | null) ?? "audio_file"
    const titleHint = (item?.title as string | null) ?? null

    const transcript = result.text.trim()
    const fullContent = transcript
      ? `${existingContent}\n\nTranscript:\n${transcript}`
      : existingContent

    // Bucket-specific analysis. Each bucket gets exactly one extractor
    // that matches its job. Audio uploads can land in any bucket, so this
    // mirrors the dispatch in the main ingest pipeline.
    let deepAnalysis: Record<string, unknown> | null = null
    let expertFrameworks: Record<string, unknown> | null = null
    let voiceSignature: Record<string, unknown> | null = null

    if (transcript.length >= 200) {
      try {
        if (bucket === "inspiration") {
          const { data: biz } = await admin
            .from("business_profile")
            .select("niche")
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle()
          const analysed = await analyseInspirationVideo({
            caption: (existingMeta.reel_caption as string | null) ?? "",
            transcript,
            author: (existingMeta.reel_author as string | null) ?? null,
            metrics: {
              views: existingMeta.reel_views ?? null,
              likes: existingMeta.reel_likes ?? null,
              comments: existingMeta.reel_comments ?? null,
              shares: existingMeta.reel_shares ?? null,
            },
            niche: biz?.niche ?? null,
          })
          if (analysed) deepAnalysis = analysed.data as unknown as Record<string, unknown>
        } else if (bucket === "expert_brain") {
          const extracted = await extractExpertFrameworks({
            title: titleHint,
            source_type: sourceType,
            raw: transcript,
          })
          if (extracted) expertFrameworks = extracted.data as unknown as Record<string, unknown>
        } else if (bucket === "my_voice") {
          const sig = await extractVoiceSignature({
            title: titleHint,
            source_type: sourceType,
            raw: transcript,
          })
          if (sig) voiceSignature = sig.data as unknown as Record<string, unknown>
        }
      } catch (e) {
        console.error("[webhooks/assemblyai] analysis failed (non-fatal):", e)
      }
    }

    // Strip stale extractor results from prior runs so the UI never keeps
    // rendering the wrong shape after a reprocess + transcribe cycle.
    const cleanedExisting = { ...existingMeta }
    delete cleanedExisting.deep_analysis
    delete cleanedExisting.expert_frameworks
    delete cleanedExisting.voice_signature

    const updatedMeta = {
      ...cleanedExisting,
      audio_transcript_source: "assemblyai",
      audio_transcript_pending: false,
      assemblyai_transcript_id: transcriptId,
      ...(deepAnalysis ? { deep_analysis: deepAnalysis } : {}),
      ...(expertFrameworks ? { expert_frameworks: expertFrameworks } : {}),
      ...(voiceSignature ? { voice_signature: voiceSignature } : {}),
    }

    await admin
      .from("context_items")
      .update({
        processed_content: fullContent,
        metadata: updatedMeta,
        status: "ready",
        error_message: null,
      })
      .eq("id", itemId)

    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error("[webhooks/assemblyai] failed:", e)
    await admin
      .from("context_items")
      .update({
        status: "failed",
        error_message: e instanceof Error ? e.message : String(e),
      })
      .eq("id", itemId)
    return NextResponse.json({ error: "Failed" }, { status: 500 })
  }
}
