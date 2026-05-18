export type ScrapedReel = {
  url: string
  external_id: string | null
  caption: string
  hashtags: string[]
  author_username: string | null
  author_full_name: string | null
  posted_at: string | null
  video_url: string | null
  thumbnail_url: string | null
  metrics: {
    views: number | null
    likes: number | null
    comments: number | null
    shares: number | null
    plays: number | null
  }
  duration_s: number | null
  raw: Record<string, unknown>
}

export type ScrapedTikTok = {
  url: string
  external_id: string | null
  caption: string
  hashtags: string[]
  author_username: string | null
  posted_at: string | null
  video_url: string | null
  thumbnail_url: string | null
  metrics: {
    views: number | null
    likes: number | null
    comments: number | null
    shares: number | null
  }
  duration_s: number | null
  raw: Record<string, unknown>
}

export type RadarItem = {
  source: "instagram" | "tiktok"
  source_handle: string | null
  url: string
  posted_at: string | null
  caption: string
  metrics: Record<string, number | null>
  raw: Record<string, unknown>
}
