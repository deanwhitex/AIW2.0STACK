import { AssemblyAI } from "assemblyai"
import { getSecret } from "@/lib/supabase/secrets"
import { extractAudioAndUpload } from "./audio-extract"

type TranscribeResult = {
  data: {
    text: string
    chapters: Array<{ summary: string; start: number; end: number }>
    confidence: number | null
  }
  mode: "real" | "stub"
}

function stubTranscribe(reason = "no key configured"): TranscribeResult {
  return {
    data: {
      text: `[Transcript pending: ${reason}. The video will be re-transcribed automatically once an AssemblyAI key is added.]`,
      chapters: [],
      confidence: null,
    },
    mode: "stub",
  }
}

/**
 * Transcribe audio at a remote URL (the video URL returned by Apify, or any
 * publicly accessible audio/video URL). Uses Auto Chapters when the audio
 * is over 60 seconds, otherwise plain transcription.
 */
export async function transcribeFromUrl(
  audioUrl: string
): Promise<TranscribeResult> {
  const key = await getSecret("assemblyai_api_key")
  if (!key) return stubTranscribe("AssemblyAI key not configured")

  // Surface real errors to the caller so the pipeline can mark the item
  // failed instead of silently storing a stub transcript labelled "ready".
  // The "no key" path above is the only place we return a stub.
  const client = new AssemblyAI({ apiKey: key })
  const transcript = await client.transcripts.transcribe({
    audio: audioUrl,
    auto_chapters: true,
    speech_models: ["universal-2"],
  })

  if (transcript.status === "error") {
    throw new Error(`AssemblyAI transcription failed: ${transcript.error ?? "unknown error"}`)
  }

  const chapters = (transcript.chapters ?? []).map((c) => ({
    summary: c.summary ?? c.headline ?? "",
    start: c.start ?? 0,
    end: c.end ?? 0,
  }))

  return {
    data: {
      text: transcript.text ?? "",
      chapters,
      confidence: transcript.confidence ?? null,
    },
    mode: "real",
  }
}

export async function submitTranscriptionAsync(
  audioUrl: string,
  webhookUrl: string
): Promise<{ transcriptId: string | null; mode: "real" | "stub" }> {
  const key = await getSecret("assemblyai_api_key")
  if (!key) return { transcriptId: null, mode: "stub" }

  // Apify-scraped Instagram MP4 URLs sometimes come back without an audio
  // stream that AssemblyAI can parse ("No audio stream found in the file"
  // error). Extract a clean MP3 ourselves with ffmpeg, upload it, and
  // submit the transcription against the upload URL. Falls back to the
  // direct URL if extraction fails -- some hosts AssemblyAI handles fine
  // (uploaded user audio files, etc.).
  let submitUrl = audioUrl
  let extractedVia: "ffmpeg" | "direct" = "direct"
  try {
    submitUrl = await extractAudioAndUpload(audioUrl)
    extractedVia = "ffmpeg"
    console.log(
      `[assemblyai.submitTranscriptionAsync] extracted audio via ffmpeg, upload url length=${submitUrl.length}`
    )
  } catch (e) {
    console.warn(
      "[assemblyai.submitTranscriptionAsync] audio extraction failed, falling back to direct URL:",
      e instanceof Error ? e.message : e
    )
  }

  try {
    const client = new AssemblyAI({ apiKey: key })
    const transcript = await client.transcripts.submit({
      audio: submitUrl,
      webhook_url: webhookUrl,
      auto_chapters: true,
      speech_models: ["universal-2"],
    })
    console.log(
      `[assemblyai.submitTranscriptionAsync] submitted transcript id=${transcript.id} via=${extractedVia}`
    )
    return { transcriptId: transcript.id, mode: "real" }
  } catch (e) {
    console.error(
      "[assemblyai.submitTranscriptionAsync] submit failed:",
      e instanceof Error ? e.message : e,
      "via=",
      extractedVia
    )
    throw e
  }
}

export async function getTranscriptionById(transcriptId: string): Promise<{
  text: string
  chapters: Array<{ summary: string; start: number; end: number }>
  confidence: number | null
  status: string
}> {
  const key = await getSecret("assemblyai_api_key")
  if (!key) throw new Error("AssemblyAI not configured")

  const client = new AssemblyAI({ apiKey: key })
  const transcript = await client.transcripts.get(transcriptId)

  const chapters = (transcript.chapters ?? []).map((c) => ({
    summary: c.summary ?? c.headline ?? "",
    start: c.start ?? 0,
    end: c.end ?? 0,
  }))

  return {
    text: transcript.text ?? "",
    chapters,
    confidence: transcript.confidence ?? null,
    status: transcript.status ?? "unknown",
  }
}

export async function isAssemblyAIConfigured(): Promise<boolean> {
  return Boolean(await getSecret("assemblyai_api_key"))
}
