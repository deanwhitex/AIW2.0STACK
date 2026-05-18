import { NextRequest, NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"
import { getSecret } from "@/lib/supabase/secrets"
import { AssemblyAI } from "assemblyai"

export const maxDuration = 120

export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

    const form = await req.formData()
    const file = form.get("audio") as File | null
    if (!file) return NextResponse.json({ error: "No audio file" }, { status: 400 })

    const key = await getSecret("assemblyai_api_key")
    if (!key) {
      return NextResponse.json({ error: "AssemblyAI not configured — add key in Settings" }, { status: 503 })
    }

    const client = new AssemblyAI({ apiKey: key })
    const buffer = Buffer.from(await file.arrayBuffer())
    const uploadUrl = await client.files.upload(buffer)

    const transcript = await client.transcripts.transcribe({
      audio: uploadUrl,
      speech_model: "universal",
    })

    if (transcript.status === "error") {
      return NextResponse.json({ error: transcript.error ?? "Transcription failed" }, { status: 500 })
    }

    return NextResponse.json({ text: transcript.text ?? "" })
  } catch (e) {
    console.error("[transcribe]", e)
    return NextResponse.json({ error: e instanceof Error ? e.message : "Failed" }, { status: 500 })
  }
}
