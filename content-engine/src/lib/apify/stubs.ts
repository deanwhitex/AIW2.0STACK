import type { RadarItem, ScrapedReel, ScrapedTikTok } from "./types"

function pickFromUrl(url: string, list: string[]): string {
  let h = 0
  for (let i = 0; i < url.length; i++) h = (h * 31 + url.charCodeAt(i)) >>> 0
  return list[h % list.length]
}

const STUB_AUTHORS = [
  "@hormozi",
  "@charliemorgan",
  "@codykerns",
  "@iman_gadzhi",
  "@officialalexberman",
  "@example_agency_owner",
]

const STUB_CAPTIONS = [
  "Most agency owners get this wrong. Comment AGENCY for the breakdown.",
  "I added $40k MRR in 30 days using this exact offer. Comment OFFER.",
  "Stop posting reels like this. Comment FIX for the playbook.",
  "Three tweaks that doubled my reach in 14 days. Comment REACH.",
  "If you're under $20k MRR, this is the one bottleneck you're missing.",
]

export function stubScrapeReel(url: string): ScrapedReel {
  const caption = pickFromUrl(url, STUB_CAPTIONS)
  const author = pickFromUrl(url, STUB_AUTHORS)
  const idMatch = url.match(/\/reel\/([^\/?]+)/) || url.match(/\/p\/([^\/?]+)/)
  return {
    url,
    external_id: idMatch?.[1] ?? null,
    caption,
    hashtags: ["#agencyowner", "#contentstrategy", "#leadgen"],
    author_username: author.replace("@", ""),
    author_full_name: null,
    posted_at: new Date(Date.now() - Math.random() * 7 * 86400_000).toISOString(),
    video_url: null,
    thumbnail_url: null,
    metrics: {
      views: 80000 + Math.floor(Math.random() * 200000),
      likes: 4000 + Math.floor(Math.random() * 10000),
      comments: 100 + Math.floor(Math.random() * 800),
      shares: 50 + Math.floor(Math.random() * 400),
      plays: null,
    },
    duration_s: 25 + Math.floor(Math.random() * 25),
    raw: { stub: true, url },
  }
}

export function stubScrapeTikTok(url: string): ScrapedTikTok {
  const caption = pickFromUrl(url, STUB_CAPTIONS)
  const author = pickFromUrl(url, STUB_AUTHORS)
  return {
    url,
    external_id: null,
    caption,
    hashtags: ["#fyp", "#agency", "#smallbusiness"],
    author_username: author.replace("@", ""),
    posted_at: new Date(Date.now() - Math.random() * 7 * 86400_000).toISOString(),
    video_url: null,
    thumbnail_url: null,
    metrics: {
      views: 50000 + Math.floor(Math.random() * 300000),
      likes: 2500 + Math.floor(Math.random() * 15000),
      comments: 80 + Math.floor(Math.random() * 600),
      shares: 200 + Math.floor(Math.random() * 1000),
    },
    duration_s: 25 + Math.floor(Math.random() * 25),
    raw: { stub: true, url },
  }
}

export function stubScrapeHashtag(
  hashtag: string,
  platform: "instagram" | "tiktok",
  limit = 10
): RadarItem[] {
  const out: RadarItem[] = []
  for (let i = 0; i < limit; i++) {
    const url =
      platform === "instagram"
        ? `https://www.instagram.com/reel/STUB${hashtag.replace("#", "")}${i}`
        : `https://www.tiktok.com/@stub/video/STUB${hashtag.replace("#", "")}${i}`
    out.push({
      source: platform,
      source_handle: null,
      url,
      posted_at: new Date(Date.now() - i * 3600_000).toISOString(),
      caption: pickFromUrl(url, STUB_CAPTIONS),
      metrics: {
        views: 20000 + i * 5000,
        likes: 1500 + i * 250,
        comments: 50 + i * 10,
      },
      raw: { stub: true, hashtag, platform, index: i },
    })
  }
  return out
}

export function stubScrapeCreator(
  handle: string,
  platform: "instagram" | "tiktok",
  limit = 10
): RadarItem[] {
  return stubScrapeHashtag(`#creator-${handle}`, platform, limit).map((r) => ({
    ...r,
    source_handle: handle,
  }))
}
