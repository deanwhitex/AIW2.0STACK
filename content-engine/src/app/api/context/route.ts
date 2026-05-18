import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerSupabase } from "@/lib/supabase/server"
import { isBucket, isSourceType } from "@/lib/content-engine/buckets"
import { bucketCounts, listBucket } from "@/lib/content-engine/retrieval"
import { startIngest } from "@/lib/content-engine/ingest"
import type { IngestRequest } from "@/lib/content-engine/types"

export const maxDuration = 300

async function requireUser() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  return user
}

export async function GET(req: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const bucket = req.nextUrl.searchParams.get("bucket")
  const search = req.nextUrl.searchParams.get("search") ?? undefined
  const limit = Number(req.nextUrl.searchParams.get("limit") ?? 50)
  const offset = Number(req.nextUrl.searchParams.get("offset") ?? 0)

  if (!bucket) {
    const counts = await bucketCounts()
    return NextResponse.json({ counts })
  }
  if (!isBucket(bucket)) {
    return NextResponse.json({ error: "Invalid bucket" }, { status: 400 })
  }

  const { rows, total } = await listBucket(bucket, { search, limit, offset })
  return NextResponse.json({ rows, total })
}

const ingestSchema = z.discriminatedUnion("source_type", [
  z.object({
    bucket: z.string(),
    source_type: z.literal("text"),
    title: z.string().optional(),
    content: z.string().min(1),
  }),
  z.object({
    bucket: z.string(),
    source_type: z.literal("youtube_url"),
    url: z.string().url(),
    title: z.string().optional(),
  }),
  z.object({
    bucket: z.string(),
    source_type: z.literal("instagram_reel"),
    url: z.string().url(),
    title: z.string().optional(),
  }),
  z.object({
    bucket: z.string(),
    source_type: z.literal("tiktok_url"),
    url: z.string().url(),
    title: z.string().optional(),
  }),
  z.object({
    bucket: z.string(),
    source_type: z.literal("link"),
    url: z.string().url(),
    title: z.string().optional(),
  }),
  z.object({
    bucket: z.string(),
    source_type: z.literal("pdf"),
    storage_path: z.string(),
    filename: z.string(),
    title: z.string().optional(),
  }),
  z.object({
    bucket: z.string(),
    source_type: z.literal("audio_file"),
    storage_path: z.string(),
    filename: z.string(),
    title: z.string().optional(),
  }),
  z.object({
    bucket: z.string(),
    source_type: z.literal("video_file"),
    storage_path: z.string(),
    filename: z.string(),
    title: z.string().optional(),
  }),
])

export async function POST(req: NextRequest) {
  const user = await requireUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = ingestSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: parsed.error.issues },
      { status: 400 }
    )
  }

  if (!isBucket(parsed.data.bucket)) {
    return NextResponse.json({ error: "Invalid bucket" }, { status: 400 })
  }
  if (!isSourceType(parsed.data.source_type)) {
    return NextResponse.json({ error: "Invalid source_type" }, { status: 400 })
  }

  const webhookBase = process.env.NEXT_PUBLIC_APP_URL
    ?? (() => {
        const proto = req.headers.get("x-forwarded-proto") ?? "https"
        const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? ""
        return host ? `${proto}://${host}` : undefined
      })()

  const result = await startIngest(parsed.data as IngestRequest, webhookBase)
  return NextResponse.json({ id: result.id, status: result.status }, { status: 202 })
}
