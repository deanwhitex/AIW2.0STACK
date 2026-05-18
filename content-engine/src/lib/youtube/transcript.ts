import { Innertube } from "youtubei.js"
import { YoutubeTranscript } from "youtube-transcript"
import { scrapeYouTubeTranscriptViaApify } from "@/lib/apify/client"

export type YouTubeMeta = {
  video_id: string | null
  url: string
  title: string | null
  channel: string | null
  description: string | null
  transcript_text: string
  segments: { offset: number; duration: number; text: string }[]
  source: "captions" | "auto_generated" | "description" | "stub"
  error?: string
}

const URL_PATTERNS = [
  /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]+)/,
  /(?:youtube\.com\/embed\/)([\w-]+)/,
]

export function extractVideoId(url: string): string | null {
  for (const re of URL_PATTERNS) {
    const m = url.match(re)
    if (m) return m[1]
  }
  return null
}

let _innertube: Innertube | null = null
async function getClient(): Promise<Innertube> {
  if (_innertube) return _innertube
  _innertube = await Innertube.create({ generate_session_locally: true })
  return _innertube
}

function parseTimedTextXml(xml: string): { offset: number; duration: number; text: string }[] {
  const re = /<text\s+start="([^"]+)"\s+dur="([^"]+)"[^>]*>([\s\S]*?)<\/text>/g
  const out: { offset: number; duration: number; text: string }[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const text = m[3]
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\n/g, " ")
      .replace(/\s+/g, " ")
      .trim()
    if (text) {
      out.push({
        offset: parseFloat(m[1]),
        duration: parseFloat(m[2]),
        text,
      })
    }
  }
  return out
}

type WatchPageData = {
  caption_tracks: Array<{ base_url: string; language_code: string; kind?: string; name?: string }>
  description: string | null
  title: string | null
  author: string | null
}

/**
 * Fetch the YouTube watch page HTML and extract caption track URLs +
 * description directly from ytInitialPlayerResponse. This is the same data
 * a logged-out browser would see, and works when YouTube's internal API
 * blocks server-IP requests for caption metadata.
 */
async function scrapeWatchPage(videoId: string): Promise<WatchPageData> {
  const res = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126 Safari/537.36",
      "accept-language": "en-US,en;q=0.9",
    },
  })
  if (!res.ok) {
    throw new Error(`Watch page returned HTTP ${res.status}`)
  }
  const html = await res.text()

  // ytInitialPlayerResponse is a JSON blob in the page. The shape evolves
  // but these two patterns cover both injection styles.
  const m =
    html.match(/var ytInitialPlayerResponse\s*=\s*(\{[\s\S]+?\});\s*var/) ??
    html.match(/ytInitialPlayerResponse"\s*:\s*(\{[\s\S]+?\}\}\}\}\}\}+)/)
  if (!m) {
    throw new Error("Could not parse watch page (player response missing)")
  }

  let data: Record<string, unknown>
  try {
    data = JSON.parse(m[1])
  } catch (e) {
    throw new Error(`Player response JSON invalid: ${e instanceof Error ? e.message : String(e)}`)
  }

  const captionsRoot =
    (data.captions as Record<string, unknown> | undefined)?.playerCaptionsTracklistRenderer as
      | Record<string, unknown>
      | undefined
  const tracks = (captionsRoot?.captionTracks ?? []) as Array<{
    baseUrl: string
    languageCode: string
    kind?: string
    name?: { simpleText?: string }
  }>

  const videoDetails = data.videoDetails as Record<string, unknown> | undefined

  return {
    caption_tracks: tracks.map((t) => ({
      base_url: t.baseUrl,
      language_code: t.languageCode,
      kind: t.kind,
      name: t.name?.simpleText,
    })),
    description: (videoDetails?.shortDescription as string | undefined) ?? null,
    title: (videoDetails?.title as string | undefined) ?? null,
    author: (videoDetails?.author as string | undefined) ?? null,
  }
}

export async function fetchYouTubeTranscript(url: string): Promise<YouTubeMeta> {
  const videoId = extractVideoId(url)
  if (!videoId) {
    return {
      video_id: null,
      url,
      title: null,
      channel: null,
      description: null,
      transcript_text: "",
      segments: [],
      source: "stub",
      error: "invalid_url",
    }
  }

  let title: string | null = null
  let channel: string | null = null
  let description: string | null = null
  let transcriptText = ""
  let segments: { offset: number; duration: number; text: string }[] = []
  let source: YouTubeMeta["source"] = "stub"
  const errors: string[] = []

  // Path 0 (primary): Apify pintostudio/youtube-transcript-scraper.
  // Paid per call, rotates IPs server-side, so it succeeds on Vercel
  // where free paths regularly hit 403s. Runs first to maximise
  // reliability — every YouTube ingestion costs a few cents.
  try {
    const apify = await scrapeYouTubeTranscriptViaApify(url)
    if (apify.mode === "real" && apify.data.transcript_text.length >= 50) {
      transcriptText = apify.data.transcript_text
      segments = apify.data.segments
      source = "captions"
      if (!title) title = apify.data.title
      if (!channel) channel = apify.data.channel
    } else if (apify.mode === "stub") {
      errors.push("apify-yt: stub (no token or run failed)")
    } else {
      errors.push(`apify-yt: returned ${apify.data.transcript_text.length} chars`)
    }
  } catch (e) {
    errors.push(`apify-yt: ${e instanceof Error ? e.message : String(e)}`)
  }

  // Path 1 (free fallback): youtube-transcript package. Only fires if
  // Apify above returned an empty transcript (rare), giving us a free
  // second chance before the unreliable youtubei.js paths below.
  if (transcriptText.length < 50) {
    try {
      const tt = await YoutubeTranscript.fetchTranscript(videoId, { lang: "en" })
      if (tt.length > 0) {
        segments = tt.map((s) => ({
          offset: typeof s.offset === "number" ? s.offset : 0,
          duration: typeof s.duration === "number" ? s.duration : 0,
          text: s.text ?? "",
        }))
        transcriptText = segments.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim()
        if (transcriptText.length >= 50) {
          source = "captions"
        }
      }
    } catch (e) {
      errors.push(`youtube-transcript: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // Path 2: youtubei.js high-level (works when YouTube's API is happy).
  try {
    const yt = await getClient()
    const info = await yt.getInfo(videoId)
    title = info.basic_info?.title ?? null
    channel = info.basic_info?.author ?? null
    description = info.basic_info?.short_description ?? null

    if (transcriptText.length < 50) {
      try {
        const transcriptInfo = await info.getTranscript()
        const tt = transcriptInfo?.transcript?.content?.body?.initial_segments ?? []
        if (tt.length > 0) {
          segments = tt.map((s) => ({
            offset: Number(s.start_ms ?? 0) / 1000,
            duration: (Number(s.end_ms ?? 0) - Number(s.start_ms ?? 0)) / 1000,
            text: s.snippet?.text ?? "",
          }))
          transcriptText = segments.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim()
          source = "captions"
        }
      } catch (e) {
        errors.push(`getTranscript: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // Path 2b: youtubei.js direct caption-track URL fetch.
    if (transcriptText.length < 50) {
      const tracks = info.captions?.caption_tracks ?? []
      if (tracks.length > 0) {
        try {
          const track =
            tracks.find((t) => t.language_code === "en" && t.kind !== "asr") ??
            tracks.find((t) => t.language_code === "en") ??
            tracks[0]
          if (track?.base_url) {
            const res = await fetch(track.base_url)
            if (res.ok) {
              const xml = await res.text()
              const parsed = parseTimedTextXml(xml)
              if (parsed.length > 0) {
                segments = parsed
                transcriptText = parsed.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim()
                source = track.kind === "asr" ? "auto_generated" : "captions"
              }
            }
          }
        } catch (e) {
          errors.push(`youtubei caption track: ${e instanceof Error ? e.message : String(e)}`)
        }
      }
    }
  } catch (e) {
    errors.push(`getInfo: ${e instanceof Error ? e.message : String(e)}`)
  }

  // Path 3: scrape the watch page HTML directly. This bypasses the
  // YouTube internal API which often blocks server IPs.
  if (transcriptText.length < 50) {
    try {
      const page = await scrapeWatchPage(videoId)
      title = title ?? page.title
      channel = channel ?? page.author
      description = description ?? page.description

      if (page.caption_tracks.length > 0) {
        const track =
          page.caption_tracks.find((t) => t.language_code === "en" && t.kind !== "asr") ??
          page.caption_tracks.find((t) => t.language_code === "en") ??
          page.caption_tracks[0]
        const res = await fetch(track.base_url)
        if (res.ok) {
          const xml = await res.text()
          const parsed = parseTimedTextXml(xml)
          if (parsed.length > 0) {
            segments = parsed
            transcriptText = parsed.map((s) => s.text).join(" ").replace(/\s+/g, " ").trim()
            source = track.kind === "asr" ? "auto_generated" : "captions"
          } else {
            errors.push("watch-page caption track returned empty XML")
          }
        } else {
          errors.push(`watch-page caption fetch HTTP ${res.status}`)
        }
      } else {
        errors.push("watch-page lists no caption tracks")
      }
    } catch (e) {
      errors.push(`watch-page: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  // Path 4: description fallback. Many tutorial creators paste the full
  // transcript or summary in the description.
  if (transcriptText.length < 50 && description && description.length > 300) {
    transcriptText = description.replace(/\s+/g, " ").trim()
    source = "description"
  }

  if (transcriptText.length < 50) {
    return {
      video_id: videoId,
      url,
      title,
      channel,
      description,
      transcript_text: "",
      segments: [],
      source: "stub",
      error: errors.join(" | ") || "no transcript or description available",
    }
  }

  return {
    video_id: videoId,
    url,
    title,
    channel,
    description,
    transcript_text: transcriptText,
    segments,
    source,
  }
}
