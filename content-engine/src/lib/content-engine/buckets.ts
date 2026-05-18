/**
 * The seven Library buckets. Stable across the schema, the UI, and prompts.
 */

export const BUCKETS = [
  "video_ideas",
  "inspiration",
  "expert_brain",
  "my_voice",
  "context",
  "instructions",
  "feedback",
] as const

export type Bucket = (typeof BUCKETS)[number]

export const SOURCE_TYPES = [
  "text",
  "youtube_url",
  "instagram_reel",
  "tiktok_url",
  "pdf",
  "link",
  "audio_file",
  "video_file",
] as const

export type SourceType = (typeof SOURCE_TYPES)[number]

export type BucketDef = {
  slug: Bucket
  label: string
  description: string
  icon: string
  color: string
  accepted: SourceType[]
}

export const BUCKET_DEFS: BucketDef[] = [
  {
    slug: "video_ideas",
    label: "Video Ideas",
    description: "One-line topic dumps. Generator pulls from here when you ask 'what should I make today'.",
    icon: "Lightbulb",
    color: "amber",
    accepted: ["text", "instagram_reel", "tiktok_url", "youtube_url", "link"],
  },
  {
    slug: "inspiration",
    label: "Inspiration",
    description: "Competitor reels and viral examples. Generator extracts structure, never the topic.",
    icon: "Sparkles",
    color: "purple",
    accepted: ["instagram_reel", "tiktok_url", "youtube_url", "link", "text"],
  },
  {
    slug: "expert_brain",
    label: "Expert Brain",
    description: "Long-form sources: YouTube channels, books, podcasts, frameworks.",
    icon: "Brain",
    color: "blue",
    accepted: ["youtube_url", "pdf", "link", "text", "audio_file", "video_file"],
  },
  {
    slug: "my_voice",
    label: "My Voice & Content",
    description: "Your past posts, captions, voice memos, and writing samples. Voice anchor for every script.",
    icon: "AudioLines",
    color: "emerald",
    accepted: ["text", "audio_file", "video_file", "instagram_reel", "tiktok_url", "youtube_url", "link"],
  },
  {
    slug: "context",
    label: "Context",
    description: "Any relevant context — PDFs, URLs, voice notes, or text. Generator pulls from here.",
    icon: "FolderOpen",
    color: "orange",
    accepted: ["text", "pdf", "link", "audio_file", "video_file", "youtube_url"],
  },
  {
    slug: "instructions",
    label: "Instructions / Intent",
    description: "Hard rules: 'always end with comment WEB', 'no swearing', etc.",
    icon: "Settings",
    color: "zinc",
    accepted: ["text"],
  },
  {
    slug: "feedback",
    label: "Feedback",
    description: "Auto-written learnings from your posted content's performance.",
    icon: "MessageSquare",
    color: "rose",
    accepted: ["text"],
  },
]

export const BUCKET_BY_SLUG: Record<Bucket, BucketDef> = Object.fromEntries(
  BUCKET_DEFS.map((b) => [b.slug, b])
) as Record<Bucket, BucketDef>

export function isBucket(value: string): value is Bucket {
  return (BUCKETS as readonly string[]).includes(value)
}

export function isSourceType(value: string): value is SourceType {
  return (SOURCE_TYPES as readonly string[]).includes(value)
}
