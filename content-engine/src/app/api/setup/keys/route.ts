import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createServerSupabase } from "@/lib/supabase/server"
import { setSecret, type SecretName } from "@/lib/supabase/secrets"

const schema = z.object({
  anthropic_api_key: z.string().optional(),
  apify_api_token: z.string().optional(),
  assemblyai_api_key: z.string().optional(),
})

export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const body = await req.json()
  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 })
  }

  const updates: { name: SecretName; value: string | null }[] = []
  for (const [k, v] of Object.entries(parsed.data)) {
    if (typeof v === "string") {
      updates.push({ name: k as SecretName, value: v.trim().length === 0 ? null : v.trim() })
    }
  }

  for (const { name, value } of updates) {
    await setSecret(name, value)
  }

  return NextResponse.json({ ok: true, updated: updates.map((u) => u.name) })
}
