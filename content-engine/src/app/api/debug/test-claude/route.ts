import { NextRequest, NextResponse } from "next/server"
import Anthropic from "@anthropic-ai/sdk"
import { createServerSupabase } from "@/lib/supabase/server"
import { getSecret } from "@/lib/supabase/secrets"

export const maxDuration = 30

/**
 * Minimal Claude smoke test. Hits the Anthropic API with the model
 * identifiers we use in production and returns whether each one
 * works. If a model is no longer available the SDK throws and we
 * surface the exact error message -- that is the failure we silently
 * swallow in claudeGenerateScripts (catch -> stub fallback).
 */
const MODELS_TO_TEST = [
  "claude-sonnet-4-6",
  "claude-sonnet-4-5",
  "claude-haiku-4-5-20251001",
  "claude-haiku-4-5",
] as const

export async function GET(_req: NextRequest) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const key = await getSecret("anthropic_api_key")
  if (!key) {
    return NextResponse.json({
      ok: false,
      reason: "anthropic_api_key not found in env or app_settings.secrets",
    })
  }

  const client = new Anthropic({ apiKey: key })
  const results: Record<string, { ok: boolean; error?: string; reply?: string }> = {}

  for (const model of MODELS_TO_TEST) {
    try {
      const msg = await client.messages.create({
        model,
        max_tokens: 16,
        messages: [{ role: "user", content: "say hi" }],
      })
      const block = msg.content[0]
      const text = block?.type === "text" ? block.text : ""
      results[model] = { ok: true, reply: text.slice(0, 100) }
    } catch (e) {
      results[model] = {
        ok: false,
        error: e instanceof Error ? e.message : String(e),
      }
    }
  }

  return NextResponse.json({
    key_length: key.length,
    key_prefix: key.slice(0, 10) + "...",
    results,
  })
}
