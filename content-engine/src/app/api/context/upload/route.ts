import { NextRequest, NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/supabase/admin"
import { isBucket } from "@/lib/content-engine/buckets"
import { startIngest } from "@/lib/content-engine/ingest"

export const maxDuration = 300

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const formData = await req.formData()
  const file = formData.get("file") as File | null
  const bucket = (formData.get("bucket") as string | null) ?? ""
  const title = (formData.get("title") as string | null) ?? undefined

  if (!file) return NextResponse.json({ error: "No file" }, { status: 400 })
  if (!isBucket(bucket)) return NextResponse.json({ error: "Invalid bucket" }, { status: 400 })

  const lower = file.name.toLowerCase()
  const isPdf = file.type === "application/pdf" || lower.endsWith(".pdf")
  const isAudio =
    file.type.startsWith("audio/") ||
    /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(lower)
  const isVideo =
    file.type.startsWith("video/") ||
    /\.(mp4|mov|webm|mkv)$/i.test(lower)

  if (!isPdf && !isAudio && !isVideo) {
    return NextResponse.json(
      { error: "Only PDF, audio (MP3/WAV/M4A), and video (MP4/MOV/WEBM) uploads are supported." },
      { status: 400 }
    )
  }

  const sizeLimit = isPdf ? 50 * 1024 * 1024 : 500 * 1024 * 1024
  if (file.size > sizeLimit) {
    return NextResponse.json(
      {
        error: `File exceeds ${isPdf ? 50 : 500}MB limit`,
      },
      { status: 400 }
    )
  }

  const admin = createAdminSupabase()
  const buf = Buffer.from(await file.arrayBuffer())
  const storagePath = `${user.id}/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`

  const { error: uploadError } = await admin.storage
    .from("uploads")
    .upload(storagePath, buf, { contentType: file.type, upsert: false })
  if (uploadError) {
    return NextResponse.json(
      { error: `Upload failed: ${uploadError.message}` },
      { status: 500 }
    )
  }

  const sourceType = isPdf ? "pdf" : isAudio ? "audio_file" : "video_file"

  // AssemblyAI needs a publicly reachable callback. Prefer the configured
  // env var; fall back to forwarded headers for Vercel.
  const webhookBase = process.env.NEXT_PUBLIC_APP_URL
    ?? (() => {
        const proto = req.headers.get("x-forwarded-proto") ?? "https"
        const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? ""
        return host ? `${proto}://${host}` : undefined
      })()

  const result = await startIngest(
    {
      bucket,
      source_type: sourceType,
      storage_path: storagePath,
      filename: file.name,
      title,
    },
    webhookBase
  )

  return NextResponse.json({ id: result.id, status: result.status }, { status: 202 })
}
