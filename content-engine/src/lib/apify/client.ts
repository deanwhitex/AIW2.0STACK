import { ApifyClient } from "apify-client"
import { getSecret } from "@/lib/supabase/secrets"
import {
  stubScrapeCreator,
  stubScrapeHashtag,
  stubScrapeReel,
  stubScrapeTikTok,
} from "./stubs"
import type { RadarItem, ScrapedReel, ScrapedTikTok } from "./types"

async function getApifyClient(): Promise<ApifyClient | null> {
  const token = await getSecret("apify_api_token")
  if (!token) return null
  return new ApifyClient({ token })
}

export type ApifyMode = "real" | "stub"

function s(n: unknown): string | null {
  if (typeof n === "string" && n.length > 0) return n
  return null
}

function num(n: unknown): number | null {
  if (typeof n === "number" && Number.isFinite(n)) return n
  return null
}

export function parseInstagramItem(r: Record<string, unknown>, url: string): ScrapedReel {
  const authorMeta = r.authorMeta as Record<string, unknown> | undefined
  return {
    url,
    external_id: s(r.id) ?? s(r.shortCode) ?? null,
    caption: s(r.caption) ?? s(r.text) ?? "",
    hashtags: Array.isArray(r.hashtags) ? (r.hashtags as string[]) : [],
    author_username: s(r.ownerUsername) ?? s(authorMeta?.username) ?? null,
    author_full_name: s(authorMeta?.fullName) ?? null,
    posted_at: s(r.timestamp) ?? null,
    video_url: s(r.videoUrl) ?? s(r.video_url) ?? null,
    thumbnail_url: s(r.displayUrl) ?? null,
    metrics: {
      views: num(r.videoViewCount) ?? num(r.viewsCount) ?? num(r.playsCount),
      likes: num(r.likesCount) ?? num(r.likes),
      comments: num(r.commentsCount) ?? num(r.comments),
      shares: num(r.sharesCount),
      plays: num(r.playsCount),
    },
    duration_s: num(r.videoDuration),
    raw: r,
  }
}

export function parseTikTokItem(r: Record<string, unknown>, url: string): ScrapedTikTok {
  const author = r.authorMeta as Record<string, unknown> | undefined
  const stats = r.stats as Record<string, unknown> | undefined
  const video = r.video as Record<string, unknown> | undefined
  return {
    url,
    external_id: s(r.id) ?? null,
    caption: s(r.text) ?? s(r.desc) ?? "",
    hashtags: Array.isArray(r.hashtags)
      ? (r.hashtags as Array<{ name?: string } | string>).map((h) =>
          typeof h === "string" ? h : h.name ?? ""
        ).filter(Boolean)
      : [],
    author_username: s(author?.name) ?? s(author?.uniqueId) ?? null,
    posted_at: s(r.createTimeISO) ?? null,
    video_url: s(video?.downloadAddr) ?? s(r.videoUrl) ?? null,
    thumbnail_url: s(video?.cover) ?? null,
    metrics: {
      views: num(stats?.playCount) ?? num(r.playCount),
      likes: num(stats?.diggCount) ?? num(r.diggCount),
      comments: num(stats?.commentCount) ?? num(r.commentCount),
      shares: num(stats?.shareCount) ?? num(r.shareCount),
    },
    duration_s: num(video?.duration),
    raw: r,
  }
}

export async function scrapeInstagramReel(
  url: string
): Promise<{ data: ScrapedReel; mode: ApifyMode }> {
  const client = await getApifyClient()
  if (!client) return { data: stubScrapeReel(url), mode: "stub" }

  try {
    const run = await client.actor("apify/instagram-scraper").call({
      directUrls: [url],
      resultsType: "posts",
      resultsLimit: 1,
    })
    const { items } = await client.dataset(run.defaultDatasetId).listItems()
    const r = items[0] as Record<string, unknown> | undefined
    if (!r) return { data: stubScrapeReel(url), mode: "stub" }
    return { data: parseInstagramItem(r, url), mode: "real" }
  } catch (e) {
    console.error("[apify.scrapeInstagramReel] failed, falling back:", e)
    return { data: stubScrapeReel(url), mode: "stub" }
  }
}

export async function startInstagramScrapeAsync(
  url: string,
  webhookUrl: string
): Promise<{ runId: string | null; mode: ApifyMode }> {
  const client = await getApifyClient()
  if (!client) return { runId: null, mode: "stub" }

  try {
    const run = await client.actor("apify/instagram-scraper").start(
      { directUrls: [url], resultsType: "posts", resultsLimit: 1 },
      { webhooks: [{ eventTypes: ["ACTOR.RUN.SUCCEEDED" as never, "ACTOR.RUN.FAILED" as never], requestUrl: webhookUrl }] }
    )
    return { runId: run.id, mode: "real" }
  } catch (e) {
    console.error("[apify.startInstagramScrapeAsync] failed:", e)
    return { runId: null, mode: "stub" }
  }
}

export async function scrapeTikTokVideo(
  url: string
): Promise<{ data: ScrapedTikTok; mode: ApifyMode }> {
  const client = await getApifyClient()
  if (!client) return { data: stubScrapeTikTok(url), mode: "stub" }

  try {
    const run = await client.actor("clockworks/tiktok-scraper").call({
      postURLs: [url],
      resultsPerPage: 1,
      shouldDownloadVideos: false,
    })
    const { items } = await client.dataset(run.defaultDatasetId).listItems()
    const r = items[0] as Record<string, unknown> | undefined
    if (!r) return { data: stubScrapeTikTok(url), mode: "stub" }
    return { data: parseTikTokItem(r, url), mode: "real" }
  } catch (e) {
    console.error("[apify.scrapeTikTokVideo] failed, falling back:", e)
    return { data: stubScrapeTikTok(url), mode: "stub" }
  }
}

export async function startTikTokScrapeAsync(
  url: string,
  webhookUrl: string
): Promise<{ runId: string | null; mode: ApifyMode }> {
  const client = await getApifyClient()
  if (!client) return { runId: null, mode: "stub" }

  try {
    const run = await client.actor("clockworks/tiktok-scraper").start(
      { postURLs: [url], resultsPerPage: 1, shouldDownloadVideos: false },
      { webhooks: [{ eventTypes: ["ACTOR.RUN.SUCCEEDED" as never, "ACTOR.RUN.FAILED" as never], requestUrl: webhookUrl }] }
    )
    return { runId: run.id, mode: "real" }
  } catch (e) {
    console.error("[apify.startTikTokScrapeAsync] failed:", e)
    return { runId: null, mode: "stub" }
  }
}

export type YouTubeTranscriptResult = {
  data: {
    transcript_text: string
    segments: { offset: number; duration: number; text: string }[]
    title: string | null
    channel: string | null
  }
  mode: ApifyMode
}

/**
 * Last-resort YouTube transcript fetcher. Rotates IPs server-side, so it
 * works on Vercel where the free youtube-transcript package and youtubei.js
 * frequently get 403'd. Pay-per-event, typically a few cents per call.
 *
 * Output shape from this actor varies between runs; the parse below tries
 * three known layouts.
 */
export async function scrapeYouTubeTranscriptViaApify(
  videoUrl: string
): Promise<YouTubeTranscriptResult> {
  const empty: YouTubeTranscriptResult = {
    data: { transcript_text: "", segments: [], title: null, channel: null },
    mode: "stub",
  }

  const client = await getApifyClient()
  if (!client) return empty

  try {
    const run = await client.actor("pintostudio/youtube-transcript-scraper").call({
      videoUrl,
      targetLanguage: "en",
    })
    const { items } = await client.dataset(run.defaultDatasetId).listItems()

    const segs: { offset: number; duration: number; text: string }[] = []
    let title: string | null = null
    let channel: string | null = null

    const numFrom = (...vals: unknown[]): number => {
      for (const v of vals) if (typeof v === "number" && Number.isFinite(v)) return v
      return 0
    }

    for (const raw of items as Array<Record<string, unknown>>) {
      if (typeof raw.title === "string" && !title) title = raw.title
      if (typeof raw.author === "string" && !channel) channel = raw.author
      if (typeof raw.channel === "string" && !channel) channel = raw.channel

      // Layout A/B: nested arrays under `data` / `segments` / `transcript`
      const arrays = [raw.data, raw.segments, raw.transcript, raw.transcript_segments]
        .filter(Array.isArray) as Array<Array<Record<string, unknown>>>
      for (const arr of arrays) {
        for (const s of arr) {
          if (typeof s.text === "string" && s.text.length > 0) {
            segs.push({
              offset: numFrom(s.start, s.offset, s.startMs ? Number(s.startMs) / 1000 : NaN),
              duration: numFrom(s.dur, s.duration, s.durationMs ? Number(s.durationMs) / 1000 : NaN),
              text: s.text,
            })
          }
        }
      }

      // Layout C: each dataset item IS a segment
      if (typeof raw.text === "string" && (typeof raw.start === "number" || typeof raw.offset === "number")) {
        segs.push({
          offset: numFrom(raw.start, raw.offset),
          duration: numFrom(raw.dur, raw.duration),
          text: raw.text,
        })
      }
    }

    const transcript_text = segs
      .map((s) => s.text)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim()

    if (transcript_text.length === 0 && items.length > 0) {
      console.warn(
        "[apify.scrapeYouTubeTranscriptViaApify] dataset returned items but parser found no segments. First item keys:",
        Object.keys(items[0] as object)
      )
    }

    return {
      data: { transcript_text, segments: segs, title, channel },
      mode: "real",
    }
  } catch (e) {
    console.error("[apify.scrapeYouTubeTranscriptViaApify] failed:", e)
    return empty
  }
}

export async function fetchApifyDataset(datasetId: string): Promise<Record<string, unknown>[]> {
  const client = await getApifyClient()
  if (!client) return []
  try {
    const { items } = await client.dataset(datasetId).listItems()
    return items as Record<string, unknown>[]
  } catch (e) {
    console.error("[apify.fetchApifyDataset] failed:", e)
    return []
  }
}

export async function getApifyRunStatus(
  runId: string
): Promise<{ status: string | null; datasetId: string | null }> {
  const client = await getApifyClient()
  if (!client) return { status: null, datasetId: null }
  try {
    const run = await client.run(runId).get()
    return {
      status: run?.status ?? null,
      datasetId: run?.defaultDatasetId ?? null,
    }
  } catch (e) {
    console.error("[apify.getApifyRunStatus] failed:", e)
    return { status: null, datasetId: null }
  }
}

export async function scrapeInstagramHashtag(
  hashtag: string,
  limit = 30
): Promise<{ data: RadarItem[]; mode: ApifyMode }> {
  const client = await getApifyClient()
  if (!client) return { data: stubScrapeHashtag(hashtag, "instagram", limit), mode: "stub" }

  try {
    const tag = hashtag.replace(/^#/, "")
    const run = await client.actor("apify/instagram-scraper").call({
      directUrls: [`https://www.instagram.com/explore/tags/${tag}/`],
      resultsType: "posts",
      resultsLimit: limit,
    })
    const { items } = await client.dataset(run.defaultDatasetId).listItems()
    const data: RadarItem[] = (items as Record<string, unknown>[]).map((r) => ({
      source: "instagram" as const,
      source_handle: s(r.ownerUsername) ?? null,
      url: s(r.url) ?? "",
      posted_at: s(r.timestamp),
      caption: s(r.caption) ?? "",
      metrics: {
        views: num(r.videoViewCount) ?? num(r.playsCount),
        likes: num(r.likesCount),
        comments: num(r.commentsCount),
      },
      raw: r,
    }))
    return { data, mode: "real" }
  } catch (e) {
    console.error("[apify.scrapeInstagramHashtag] failed, falling back:", e)
    return { data: stubScrapeHashtag(hashtag, "instagram", limit), mode: "stub" }
  }
}

export async function scrapeInstagramCreator(
  handle: string,
  limit = 10
): Promise<{ data: RadarItem[]; mode: ApifyMode }> {
  const client = await getApifyClient()
  if (!client) return { data: stubScrapeCreator(handle, "instagram", limit), mode: "stub" }

  try {
    const username = handle.replace(/^@/, "")
    const run = await client.actor("apify/instagram-scraper").call({
      directUrls: [`https://www.instagram.com/${username}/`],
      resultsType: "posts",
      resultsLimit: limit,
    })
    const { items } = await client.dataset(run.defaultDatasetId).listItems()
    const data: RadarItem[] = (items as Record<string, unknown>[]).map((r) => ({
      source: "instagram" as const,
      source_handle: handle,
      url: s(r.url) ?? "",
      posted_at: s(r.timestamp),
      caption: s(r.caption) ?? "",
      metrics: {
        views: num(r.videoViewCount) ?? num(r.playsCount),
        likes: num(r.likesCount),
        comments: num(r.commentsCount),
      },
      raw: r,
    }))
    return { data, mode: "real" }
  } catch (e) {
    console.error("[apify.scrapeInstagramCreator] failed, falling back:", e)
    return { data: stubScrapeCreator(handle, "instagram", limit), mode: "stub" }
  }
}

export async function isApifyConfigured(): Promise<boolean> {
  return Boolean(await getSecret("apify_api_token"))
}
