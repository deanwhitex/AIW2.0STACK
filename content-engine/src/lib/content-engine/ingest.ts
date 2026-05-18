import { createAdminSupabase } from "@/lib/supabase/admin"
import {
  analyseInspirationVideo,
  extractExpertFrameworks,
  extractVoiceSignature,
  summariseContent,
} from "@/lib/ai/claude"
import {
  fetchApifyDataset,
  getApifyRunStatus,
  parseInstagramItem,
  parseTikTokItem,
  scrapeInstagramReel,
  scrapeTikTokVideo,
  startInstagramScrapeAsync,
  startTikTokScrapeAsync,
} from "@/lib/apify/client"
import {
  getTranscriptionById,
  submitTranscriptionAsync,
  transcribeFromUrl,
} from "@/lib/transcribe/assemblyai"
import { fetchYouTubeTranscript } from "@/lib/youtube/transcript"
import { withWebhookSecret } from "@/lib/webhooks/secret"
import type { Bucket, SourceType } from "./buckets"
import type { ContextItemMetadata, ContextItemRow, ContextStatus, IngestRequest } from "./types"
import type { ScrapedReel, ScrapedTikTok } from "@/lib/apify/types"

type IngestResult = { id: string; status: ContextStatus }

export async function startIngest(req: IngestRequest, webhookBase?: string): Promise<IngestResult> {
  const admin = createAdminSupabase()
  const seedRow = buildSeedRow(req)

  if ("url" in req && req.url) {
    const { data: existing } = await admin
      .from("context_items")
      .select("id, status")
      .eq("source_url", req.url)
      .is("deleted_at", null)
      .maybeSingle()
    if (existing) return { id: existing.id, status: existing.status }
  }

  const { data, error } = await admin
    .from("context_items")
    .insert(seedRow)
    .select("id")
    .single()
  if (error) throw error

  const id = data.id as string

  try {
    const finalStatus = await runPipeline(id, req, webhookBase)
    return { id, status: finalStatus }
  } catch (e) {
    await admin
      .from("context_items")
      .update({
        status: "failed",
        error_message: e instanceof Error ? e.message : String(e),
      })
      .eq("id", id)
    return { id, status: "failed" }
  }
}

type SeedRow = {
  bucket: Bucket
  source_type: SourceType
  title: string | null
  status: ContextStatus
  metadata: ContextItemMetadata
  raw_input: string | null
  source_url: string | null
  storage_path: string | null
}

function buildSeedRow(req: IngestRequest): SeedRow {
  const titleHint = ("title" in req && req.title) || null
  const base: SeedRow = {
    bucket: req.bucket as Bucket,
    source_type: req.source_type as SourceType,
    title: titleHint,
    status: "queued",
    metadata: {},
    raw_input: null,
    source_url: null,
    storage_path: null,
  }
  switch (req.source_type) {
    case "text":
      return {
        ...base,
        raw_input: req.content,
        title: titleHint ?? `Note · ${new Date().toLocaleDateString()}`,
      }
    case "youtube_url":
    case "instagram_reel":
    case "tiktok_url":
    case "link":
      return {
        ...base,
        source_url: req.url,
        raw_input: req.url,
        title: titleHint ?? truncateUrl(req.url),
      }
    case "pdf":
      return {
        ...base,
        storage_path: req.storage_path,
        title: titleHint ?? req.filename,
        metadata: { pdf_filename: req.filename },
      }
    case "audio_file":
    case "video_file":
      return {
        ...base,
        storage_path: req.storage_path,
        title: titleHint ?? req.filename,
        metadata: { audio_filename: req.filename },
      }
  }
}

function truncateUrl(url: string): string {
  try {
    const u = new URL(url)
    return `${u.hostname}${u.pathname}`.slice(0, 80)
  } catch {
    return url.slice(0, 80)
  }
}

export async function reprocessItem(id: string, webhookBase?: string): Promise<{ status: ContextStatus }> {
  const admin = createAdminSupabase()

  const { data: item, error } = await admin
    .from("context_items")
    .select("*")
    .eq("id", id)
    .single()

  if (error || !item) throw new Error("Item not found")

  const meta = (item.metadata ?? {}) as Record<string, unknown>
  const apifyRunId = meta.apify_run_id as string | undefined
  const sourceType = item.source_type as SourceType
  const sourceUrl = (item.source_url as string | null) ?? ""

  // Recovery path: if item is stuck in "fetching" with a stored Apify run ID,
  // check Apify directly and finish the pipeline locally if the run is done.
  if (
    item.status === "fetching" &&
    apifyRunId &&
    (sourceType === "instagram_reel" || sourceType === "tiktok_url")
  ) {
    const { status, datasetId } = await getApifyRunStatus(apifyRunId)
    if (status === "SUCCEEDED" && datasetId) {
      const items = await fetchApifyDataset(datasetId)
      const raw = items[0]
      if (raw) {
        if (sourceType === "instagram_reel") {
          const reelData = parseInstagramItem(raw, sourceUrl)
          await finaliseStuckReel(id, reelData, raw, admin, webhookBase)
        } else {
          const tikData = parseTikTokItem(raw, sourceUrl)
          await finaliseStuckTikTok(id, tikData, raw, admin, webhookBase)
        }
        const { data: updated } = await admin
          .from("context_items")
          .select("status")
          .eq("id", id)
          .single()
        return { status: (updated?.status as ContextStatus) ?? "ready" }
      }
    }
    if (status && status !== "SUCCEEDED" && status !== "FAILED") {
      // Run still in progress -- leave the item as fetching, no fresh start
      return { status: "fetching" }
    }
    // Run failed or unrecoverable -- fall through to start a fresh pipeline
  }

  // Recovery path: if item is stuck in "transcribing" with a stored
  // AssemblyAI transcript ID, pull the transcript directly. Used when
  // AssemblyAI's webhook to our app fails to land. Mirrors the webhook
  // handler's finalisation logic so the result is identical to a
  // successful webhook delivery.
  const assemblyaiTranscriptId = meta.assemblyai_transcript_id as string | undefined
  if (item.status === "transcribing" && assemblyaiTranscriptId) {
    try {
      const result = await getTranscriptionById(assemblyaiTranscriptId)
      if (result.status === "completed") {
        const transcript = result.text.trim()
        const existingContent = (item.processed_content as string | null) ?? ""
        const fullContent = transcript
          ? `${existingContent}\n\nTranscript:\n${transcript}`
          : existingContent

        const bucket = item.bucket as string
        const titleHint = (item.title as string | null) ?? null

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
                caption: (meta.reel_caption as string | null) ?? "",
                transcript,
                author: (meta.reel_author as string | null) ?? null,
                metrics: {
                  views: meta.reel_views ?? null,
                  likes: meta.reel_likes ?? null,
                  comments: meta.reel_comments ?? null,
                  shares: meta.reel_shares ?? null,
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
            console.error("[reprocessItem] transcribing recovery analysis failed:", e)
          }
        }

        const cleanedExisting = { ...meta }
        delete cleanedExisting.deep_analysis
        delete cleanedExisting.expert_frameworks
        delete cleanedExisting.voice_signature

        const updatedMeta = {
          ...cleanedExisting,
          audio_transcript_source: "assemblyai",
          audio_transcript_pending: false,
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
          .eq("id", id)

        return { status: "ready" }
      }
      if (result.status === "queued" || result.status === "processing") {
        // AssemblyAI hasn't finished yet -- leave it
        return { status: "transcribing" }
      }
      // Status "error" or unknown -- fall through to fresh start
    } catch (e) {
      console.error("[reprocessItem] transcribing recovery failed:", e)
      // Fall through to fresh start
    }
  }

  // Default path: reset and run the full pipeline
  await admin
    .from("context_items")
    .update({ status: "queued", error_message: null })
    .eq("id", id)

  const req = reconstructIngestRequest(item)

  try {
    const finalStatus = await runPipeline(id, req, webhookBase)
    return { status: finalStatus }
  } catch (e) {
    await admin.from("context_items").update({
      status: "failed",
      error_message: e instanceof Error ? e.message : String(e),
    }).eq("id", id)
    return { status: "failed" }
  }
}

async function finaliseStuckReel(
  id: string,
  reel: ScrapedReel,
  raw: Record<string, unknown>,
  admin: ReturnType<typeof createAdminSupabase>,
  webhookBase: string | undefined
) {
  const built = await buildReelContent(id, reel, admin, { skipTranscription: true })
  const summary = [
    reel.author_username ? `@${reel.author_username}` : null,
    reel.metrics.views ? `${reel.metrics.views.toLocaleString()} views` : null,
    reel.caption ? reel.caption.slice(0, 200) : null,
  ].filter(Boolean).join(" · ")

  if (reel.video_url && webhookBase) {
    const webhookUrl = withWebhookSecret(`${webhookBase}/api/webhooks/assemblyai?item_id=${id}`)
    const { transcriptId, mode } = await submitTranscriptionAsync(reel.video_url, webhookUrl)
    if (mode === "real" && transcriptId) {
      await admin.from("context_items").update({
        processed_content: built.processed_content,
        raw_payload: raw,
        summary,
        tags: reel.hashtags.slice(0, 8),
        metadata: { ...built.metadata, assemblyai_transcript_id: transcriptId },
        status: "transcribing" as ContextStatus,
        error_message: null,
        title: built.title_hint ?? undefined,
      }).eq("id", id)
      return
    }
  }

  await admin.from("context_items").update({
    processed_content: built.processed_content,
    raw_payload: raw,
    summary,
    tags: reel.hashtags.slice(0, 8),
    metadata: built.metadata,
    status: "ready" as ContextStatus,
    error_message: null,
    title: built.title_hint ?? undefined,
  }).eq("id", id)
}

async function finaliseStuckTikTok(
  id: string,
  tik: ScrapedTikTok,
  raw: Record<string, unknown>,
  admin: ReturnType<typeof createAdminSupabase>,
  webhookBase: string | undefined
) {
  const built = await buildTikTokContent(id, tik, admin, { skipTranscription: true })
  const summary = [
    tik.author_username ? `@${tik.author_username}` : null,
    tik.metrics.views ? `${tik.metrics.views.toLocaleString()} views` : null,
    tik.caption ? tik.caption.slice(0, 200) : null,
  ].filter(Boolean).join(" · ")

  if (tik.video_url && webhookBase) {
    const webhookUrl = withWebhookSecret(`${webhookBase}/api/webhooks/assemblyai?item_id=${id}`)
    const { transcriptId, mode } = await submitTranscriptionAsync(tik.video_url, webhookUrl)
    if (mode === "real" && transcriptId) {
      await admin.from("context_items").update({
        processed_content: built.processed_content,
        raw_payload: raw,
        summary,
        tags: tik.hashtags.slice(0, 8),
        metadata: { ...built.metadata, assemblyai_transcript_id: transcriptId },
        status: "transcribing" as ContextStatus,
        error_message: null,
        title: built.title_hint ?? undefined,
      }).eq("id", id)
      return
    }
  }

  await admin.from("context_items").update({
    processed_content: built.processed_content,
    raw_payload: raw,
    summary,
    tags: tik.hashtags.slice(0, 8),
    metadata: built.metadata,
    status: "ready" as ContextStatus,
    error_message: null,
    title: built.title_hint ?? undefined,
  }).eq("id", id)
}

function reconstructIngestRequest(item: Record<string, unknown>): IngestRequest {
  const sourceType = item.source_type as SourceType
  const bucket = item.bucket as Bucket
  const meta = (item.metadata ?? {}) as Record<string, unknown>
  const title = (item.title as string | null) ?? undefined

  switch (sourceType) {
    case "text":
      return { bucket, source_type: "text", content: (item.raw_input as string) ?? "", title }
    case "youtube_url":
    case "instagram_reel":
    case "tiktok_url":
    case "link":
      return { bucket, source_type: sourceType, url: (item.source_url as string) ?? "", title }
    case "pdf":
      return {
        bucket,
        source_type: "pdf",
        storage_path: (item.storage_path as string) ?? "",
        filename: (meta.pdf_filename as string) ?? "file.pdf",
        title,
      }
    case "audio_file":
    case "video_file":
      return {
        bucket,
        source_type: sourceType,
        storage_path: (item.storage_path as string) ?? "",
        filename:
          (meta.audio_filename as string) ?? (meta.pdf_filename as string) ?? "file",
        title,
      }
  }
}

async function runPipeline(id: string, req: IngestRequest, webhookBase?: string): Promise<ContextStatus> {
  const admin = createAdminSupabase()

  let processed_content = ""
  let metadata: ContextItemMetadata = {}
  let title_hint: string | null = null
  let raw_payload: Record<string, unknown> | null = null

  switch (req.source_type) {
    case "text": {
      processed_content = req.content
      metadata = { word_count: req.content.split(/\s+/).filter(Boolean).length }
      break
    }
    case "youtube_url": {
      await admin.from("context_items").update({ status: "fetching" as ContextStatus }).eq("id", id)
      const yt = await fetchYouTubeTranscript(req.url)

      if (yt.source === "stub" || yt.transcript_text.length < 50) {
        throw new Error(
          yt.error
            ? `Could not extract transcript: ${yt.error}. Pick a different video or upload the audio.`
            : "Could not extract a transcript or description for this video. Pick a different video or upload the audio."
        )
      }

      // Build processed content. If we used the description as a fallback,
      // mark it clearly so the user knows the quality is lower than captions.
      const sourceLabel =
        yt.source === "captions"
          ? "captions"
          : yt.source === "auto_generated"
            ? "auto-generated captions"
            : "video description"

      processed_content = `Source: ${sourceLabel}\n\n${yt.transcript_text}`
      title_hint = yt.title ?? null
      metadata = {
        youtube_video_id: yt.video_id ?? undefined,
        word_count: processed_content.split(/\s+/).filter(Boolean).length,
        audio_transcript_source: yt.source === "description" ? "stub" : "captions",
        reel_caption: yt.description ?? "",
        reel_author: yt.channel,
        reel_url: req.url,
      }
      raw_payload = { segments: yt.segments }
      // Note: bucket-specific analysis (inspiration, expert_brain, my_voice)
      // is dispatched after the switch so a YouTube video dropped into
      // expert_brain doesn't get hook/body/CTA-shaped analysis.
      break
    }
    case "instagram_reel": {
      await admin.from("context_items").update({ status: "fetching" as ContextStatus }).eq("id", id)

      if (webhookBase) {
        const webhookUrl = withWebhookSecret(`${webhookBase}/api/webhooks/apify?item_id=${id}&source_type=instagram_reel`)
        const { runId, mode } = await startInstagramScrapeAsync(req.url, webhookUrl)
        if (mode === "real" && runId) {
          await admin.from("context_items").update({
            metadata: { reel_url: req.url, apify_run_id: runId, scrape_mode: "real" },
          }).eq("id", id)
          return "fetching"
        }
      }

      // Stub fallback: process synchronously
      const reel = await scrapeInstagramReel(req.url)
      const built = await buildReelContent(id, reel.data, admin)
      processed_content = built.processed_content
      metadata = { ...built.metadata, scrape_mode: reel.mode }
      title_hint = built.title_hint
      raw_payload = reel.data.raw
      break
    }
    case "tiktok_url": {
      await admin.from("context_items").update({ status: "fetching" as ContextStatus }).eq("id", id)

      if (webhookBase) {
        const webhookUrl = withWebhookSecret(`${webhookBase}/api/webhooks/apify?item_id=${id}&source_type=tiktok_url`)
        const { runId, mode } = await startTikTokScrapeAsync(req.url, webhookUrl)
        if (mode === "real" && runId) {
          await admin.from("context_items").update({
            metadata: { reel_url: req.url, apify_run_id: runId, scrape_mode: "real" },
          }).eq("id", id)
          return "fetching"
        }
      }

      // Stub fallback: process synchronously
      const tik = await scrapeTikTokVideo(req.url)
      const built = await buildTikTokContent(id, tik.data, admin)
      processed_content = built.processed_content
      metadata = { ...built.metadata, scrape_mode: tik.mode }
      title_hint = built.title_hint
      raw_payload = tik.data.raw
      break
    }
    case "link": {
      await admin.from("context_items").update({ status: "fetching" as ContextStatus }).eq("id", id)
      const fetched = await fetchAndExtract(req.url)
      if (!fetched.text || fetched.text.startsWith("[Failed to fetch")) {
        throw new Error(`Could not fetch link content from ${fetched.domain || req.url}. The site may block scrapers or be offline.`)
      }
      processed_content = fetched.text
      metadata = {
        link_url: req.url,
        link_domain: fetched.domain,
        word_count: fetched.text.split(/\s+/).filter(Boolean).length,
      }
      title_hint = fetched.title
      break
    }
    case "pdf": {
      await admin.from("context_items").update({ status: "fetching" as ContextStatus }).eq("id", id)
      const pdfText = await downloadAndParsePdf(req.storage_path)
      // downloadAndParsePdf throws on failure now -- if we got here the parse
      // succeeded. Still validate we got non-trivial text out.
      if (pdfText.pages === 0 || pdfText.text.trim().length < 30) {
        throw new Error(
          "PDF could not be read. The file may be image-only (scanned), encrypted, or corrupted. Try a text-based PDF."
        )
      }
      processed_content = pdfText.text
      metadata = {
        pdf_filename: req.filename,
        pdf_pages: pdfText.pages,
        word_count: pdfText.text.split(/\s+/).filter(Boolean).length,
      }
      break
    }
    case "audio_file":
    case "video_file": {
      const signedUrl = await getSignedUrl(req.storage_path)

      // Async path: submit to AssemblyAI with a webhook callback. The webhook
      // handler will fetch the transcript, run analysis, and mark ready.
      // Avoids blocking the API route past Vercel's timeout limit.
      if (webhookBase) {
        await admin.from("context_items").update({ status: "transcribing" as ContextStatus }).eq("id", id)
        const webhookUrl = withWebhookSecret(`${webhookBase}/api/webhooks/assemblyai?item_id=${id}`)
        const { transcriptId, mode } = await submitTranscriptionAsync(signedUrl, webhookUrl)
        if (mode === "real" && transcriptId) {
          await admin.from("context_items").update({
            metadata: {
              audio_filename: req.filename,
              assemblyai_transcript_id: transcriptId,
              audio_transcript_pending: true,
            },
            title: req.filename,
          }).eq("id", id)
          return "transcribing"
        }
      }

      // Sync fallback: only safe for short clips. Vercel will time out
      // long audio on the free tier; submit-with-webhook is the real path.
      await admin.from("context_items").update({ status: "transcribing" as ContextStatus }).eq("id", id)
      const t = await transcribeFromUrl(signedUrl)
      processed_content = t.data.text
      metadata = {
        audio_transcript_source: t.mode === "real" ? "assemblyai" : "stub",
        audio_transcript_pending: t.mode !== "real",
        word_count: processed_content.split(/\s+/).filter(Boolean).length,
        audio_filename: req.filename,
      }
      raw_payload = { chapters: t.data.chapters, confidence: t.data.confidence }
      break
    }
  }

  await admin.from("context_items").update({ status: "summarising" as ContextStatus }).eq("id", id)

  // Bucket-specific analysis. Each bucket has exactly one extractor that
  // matches its job:
  //   inspiration  -> analyseInspirationVideo (hook / body / CTA / why-it-worked)
  //   expert_brain -> extractExpertFrameworks (named frameworks / principles)
  //   my_voice     -> extractVoiceSignature (cadence / register / phrases)
  // Other buckets (video_ideas, my_business, instructions, feedback) only
  // need the generic summary -- their content is short or rule-shaped.
  const hasContent = processed_content.trim().length >= 200

  const inspirationAnalysisPromise =
    req.bucket === "inspiration" && hasContent
      ? (async () => {
          const niche = await getNicheNonBlocking(admin)
          const reelAuthor =
            typeof metadata.reel_author === "string" ? metadata.reel_author : null
          const reelCaption =
            typeof metadata.reel_caption === "string" ? metadata.reel_caption : null
          return analyseInspirationVideo({
            caption: reelCaption ?? title_hint ?? "",
            transcript: processed_content,
            author: reelAuthor,
            metrics: {},
            niche,
          }).then((r) =>
            r ? { data: r.data as unknown as Record<string, unknown> } : null
          )
        })()
      : Promise.resolve(null)

  const frameworksPromise =
    req.bucket === "expert_brain" && hasContent
      ? extractExpertFrameworks({
          title: title_hint,
          source_type: req.source_type,
          raw: processed_content,
        })
      : Promise.resolve(null)

  const voiceSignaturePromise =
    req.bucket === "my_voice" && hasContent
      ? extractVoiceSignature({
          title: title_hint,
          source_type: req.source_type,
          raw: processed_content,
        })
      : Promise.resolve(null)

  // Run summary + analyses in parallel to stay under Vercel's timeout limits.
  const [summarised, analysed, frameworks, voiceSignature] = await Promise.all([
    summariseContent({
      raw: processed_content,
      source_type: req.source_type,
      source_url: "url" in req ? req.url : null,
      title_hint: title_hint ?? null,
      bucket: req.bucket,
    }),
    inspirationAnalysisPromise,
    frameworksPromise,
    voiceSignaturePromise,
  ])

  // Strip stale extractor results from previous runs before writing the
  // new ones. Each bucket has exactly one extractor; carrying the wrong
  // ones forward would let the UI keep rendering the old (wrong-shaped)
  // breakdown after a reprocess.
  const cleanedMeta: ContextItemMetadata = { ...metadata }
  delete cleanedMeta.deep_analysis
  delete cleanedMeta.expert_frameworks
  delete cleanedMeta.voice_signature

  const enrichedMeta: ContextItemMetadata = {
    ...cleanedMeta,
    ...(analysed ? { deep_analysis: analysed.data } : {}),
    ...(frameworks ? { expert_frameworks: frameworks.data } : {}),
    ...(voiceSignature ? { voice_signature: voiceSignature.data } : {}),
  }

  const finalRow: Partial<ContextItemRow> = {
    processed_content,
    raw_payload,
    summary: summarised.data.summary,
    tags: summarised.data.tags,
    hook_extracted: summarised.data.hook_extracted ?? null,
    metadata: enrichedMeta,
    status: "ready" as ContextStatus,
    error_message: null,
    title: title_hint ?? undefined,
  }

  await admin.from("context_items").update(finalRow).eq("id", id)
  return "ready"
}

async function getNicheNonBlocking(
  admin: ReturnType<typeof createAdminSupabase>
): Promise<string | null> {
  try {
    const { data } = await admin
      .from("business_profile")
      .select("niche")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
    return (data?.niche as string | null) ?? null
  } catch {
    return null
  }
}

// Shared helpers used by both the sync pipeline and the Apify webhook handler

type ReelContent = { processed_content: string; metadata: ContextItemMetadata; title_hint: string | null }

export async function buildReelContent(
  id: string,
  r: ScrapedReel,
  admin: ReturnType<typeof createAdminSupabase>,
  opts?: { skipTranscription?: boolean }
): Promise<ReelContent> {
  let transcript = ""
  let meta: ContextItemMetadata = {}

  if (r.video_url && !opts?.skipTranscription) {
    await admin.from("context_items").update({ status: "transcribing" as ContextStatus }).eq("id", id)
    const t = await transcribeFromUrl(r.video_url)
    transcript = t.data.text
    meta.audio_transcript_source = t.mode === "real" ? "assemblyai" : "stub"
    meta.audio_transcript_pending = t.mode !== "real"
  } else {
    meta.audio_transcript_pending = Boolean(r.video_url)
  }

  meta = {
    ...meta,
    reel_url: r.url,
    reel_author: r.author_username,
    reel_caption: r.caption,
    reel_views: r.metrics.views,
    reel_likes: r.metrics.likes,
    reel_comments: r.metrics.comments,
    reel_shares: r.metrics.shares,
    reel_duration_s: r.duration_s,
    reel_thumbnail: r.thumbnail_url,
  }

  const parts = [
    `REEL by @${r.author_username ?? "unknown"}`,
    r.metrics.views ? `${r.metrics.views.toLocaleString()} views` : null,
    r.metrics.likes ? `${r.metrics.likes.toLocaleString()} likes` : null,
    "",
    r.caption ? `Caption: ${r.caption}` : null,
    "",
    transcript ? `Transcript: ${transcript}` : null,
  ].filter(Boolean)

  return {
    processed_content: parts.join("\n"),
    metadata: meta,
    title_hint: r.author_username ? `Reel by @${r.author_username}` : null,
  }
}

type TikTokContent = { processed_content: string; metadata: ContextItemMetadata; title_hint: string | null }

export async function buildTikTokContent(
  id: string,
  r: ScrapedTikTok,
  admin: ReturnType<typeof createAdminSupabase>,
  opts?: { skipTranscription?: boolean }
): Promise<TikTokContent> {
  let transcript = ""
  let meta: ContextItemMetadata = {}

  if (r.video_url && !opts?.skipTranscription) {
    await admin.from("context_items").update({ status: "transcribing" as ContextStatus }).eq("id", id)
    const t = await transcribeFromUrl(r.video_url)
    transcript = t.data.text
    meta.audio_transcript_source = t.mode === "real" ? "assemblyai" : "stub"
    meta.audio_transcript_pending = t.mode !== "real"
  } else {
    meta.audio_transcript_pending = Boolean(r.video_url)
  }

  meta = {
    ...meta,
    reel_url: r.url,
    reel_author: r.author_username,
    reel_caption: r.caption,
    reel_views: r.metrics.views,
    reel_likes: r.metrics.likes,
    reel_comments: r.metrics.comments,
    reel_shares: r.metrics.shares,
    reel_duration_s: r.duration_s,
    reel_thumbnail: r.thumbnail_url,
  }

  const parts = [
    `TIKTOK by @${r.author_username ?? "unknown"}`,
    r.metrics.views ? `${r.metrics.views.toLocaleString()} views` : null,
    r.metrics.likes ? `${r.metrics.likes.toLocaleString()} likes` : null,
    "",
    r.caption ? `Caption: ${r.caption}` : null,
    "",
    transcript ? `Transcript: ${transcript}` : null,
  ].filter(Boolean)

  return {
    processed_content: parts.join("\n"),
    metadata: meta,
    title_hint: r.author_username ? `TikTok by @${r.author_username}` : null,
  }
}

async function fetchAndExtract(url: string): Promise<{
  text: string
  title: string | null
  domain: string
}> {
  try {
    const res = await fetch(url, {
      headers: {
        "user-agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
      },
    })
    const html = await res.text()
    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    const text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 50_000)
    const domain = new URL(url).hostname
    return { text, title: titleMatch?.[1]?.trim() ?? null, domain }
  } catch (e) {
    return {
      text: `[Failed to fetch ${url}: ${e instanceof Error ? e.message : String(e)}]`,
      title: null,
      domain: tryDomain(url),
    }
  }
}

function tryDomain(url: string): string {
  try {
    return new URL(url).hostname
  } catch {
    return ""
  }
}

async function getSignedUrl(storagePath: string): Promise<string> {
  const admin = createAdminSupabase()
  const { data, error } = await admin.storage
    .from("uploads")
    .createSignedUrl(storagePath, 60 * 60)
  if (error || !data?.signedUrl) {
    throw new Error(`Could not sign storage URL: ${error?.message ?? "unknown"}`)
  }
  return data.signedUrl
}

async function downloadAndParsePdf(storagePath: string): Promise<{ text: string; pages: number }> {
  const admin = createAdminSupabase()
  const { data, error } = await admin.storage.from("uploads").download(storagePath)
  if (error || !data) {
    throw new Error(`Could not download PDF: ${error?.message ?? "file not found in storage"}`)
  }
  const arrayBuffer = await data.arrayBuffer()
  // unpdf wraps pdfjs-dist for serverless runtimes -- avoids the
  // "DOMMatrix is not defined" error pdf-parse hits on Node.
  // v1.6 requires the buffer to be wrapped via getDocumentProxy first;
  // calling extractText on a raw Uint8Array returns empty text.
  const { extractText, getDocumentProxy } = await import("unpdf")
  const pdf = await getDocumentProxy(new Uint8Array(arrayBuffer))
  const result = await extractText(pdf, { mergePages: true })
  const text = Array.isArray(result.text) ? result.text.join("\n\n") : result.text
  return {
    text: (text ?? "").slice(0, 200_000),
    pages: result.totalPages ?? 0,
  }
}
