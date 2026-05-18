import type { Bucket, SourceType } from "./buckets"

export type ContextStatus =
  | "queued"
  | "fetching"
  | "transcribing"
  | "summarising"
  | "ready"
  | "failed"

export type ContextItemMetadata = {
  reel_url?: string
  reel_author?: string | null
  reel_caption?: string
  reel_views?: number | null
  reel_likes?: number | null
  reel_comments?: number | null
  reel_shares?: number | null
  reel_duration_s?: number | null
  reel_thumbnail?: string | null
  audio_transcript_pending?: boolean
  audio_transcript_source?: "assemblyai" | "captions" | "stub"
  youtube_video_id?: string
  pdf_filename?: string
  pdf_pages?: number
  audio_filename?: string
  link_url?: string
  link_domain?: string
  word_count?: number
  // Free-form additional metadata
  [k: string]: unknown
}

export type ContextItemRow = {
  id: string
  bucket: Bucket
  source_type: SourceType
  source_url: string | null
  storage_path: string | null
  title: string | null
  raw_input: string | null
  raw_payload: Record<string, unknown> | null
  processed_content: string | null
  summary: string | null
  tags: string[]
  hook_extracted: string | null
  metadata: ContextItemMetadata
  status: ContextStatus
  error_message: string | null
  created_at: string
  updated_at: string
  deleted_at: string | null
}

export type IngestRequest =
  | {
      bucket: Bucket
      source_type: "text"
      title?: string
      content: string
    }
  | {
      bucket: Bucket
      source_type: "youtube_url"
      url: string
      title?: string
    }
  | {
      bucket: Bucket
      source_type: "instagram_reel"
      url: string
      title?: string
    }
  | {
      bucket: Bucket
      source_type: "tiktok_url"
      url: string
      title?: string
    }
  | {
      bucket: Bucket
      source_type: "link"
      url: string
      title?: string
    }
  | {
      bucket: Bucket
      source_type: "pdf"
      storage_path: string
      filename: string
      title?: string
    }
  | {
      bucket: Bucket
      source_type: "audio_file"
      storage_path: string
      filename: string
      title?: string
    }
  | {
      bucket: Bucket
      source_type: "video_file"
      storage_path: string
      filename: string
      title?: string
    }
