import { NextResponse } from "next/server"
import {
  isSupabaseConfigured,
  isSupabaseAdminConfigured,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY,
} from "@/lib/supabase/env"
import { createAdminSupabase } from "@/lib/supabase/admin"

/**
 * Debug-only. Reports whether the admin client can reach Supabase and
 * how many users exist. Used during initial setup to diagnose login issues.
 */
export async function GET() {
  let urlInspection: Record<string, unknown> = { parsed: false }
  try {
    const u = new URL(SUPABASE_URL)
    const refMatch = u.hostname.match(/^([^.]+)\./)
    const ref = refMatch?.[1] ?? ""
    urlInspection = {
      parsed: true,
      protocol: u.protocol,
      hostname_suffix: u.hostname.replace(ref, "REDACTED"),
      ref_length: ref.length,
      ref_charset_ok: /^[a-z0-9]+$/.test(ref),
      pathname: u.pathname,
      has_trailing_slash: SUPABASE_URL.endsWith("/"),
      has_search: u.search.length > 0,
      has_whitespace: /\s/.test(SUPABASE_URL),
      anon_starts_with_eyJ: SUPABASE_ANON_KEY.startsWith("eyJ"),
      service_starts_with_eyJ: SUPABASE_SERVICE_ROLE_KEY.startsWith("eyJ"),
    }
  } catch (e) {
    urlInspection = {
      parsed: false,
      parse_error: e instanceof Error ? e.message : String(e),
    }
  }

  const out: Record<string, unknown> = {
    env: {
      url_set: Boolean(SUPABASE_URL),
      url_length: SUPABASE_URL.length,
      anon_set: Boolean(SUPABASE_ANON_KEY),
      anon_length: SUPABASE_ANON_KEY.length,
      service_set: Boolean(SUPABASE_SERVICE_ROLE_KEY),
      service_length: SUPABASE_SERVICE_ROLE_KEY.length,
    },
    url_inspection: urlInspection,
    flags: {
      isSupabaseConfigured: isSupabaseConfigured(),
      isSupabaseAdminConfigured: isSupabaseAdminConfigured(),
    },
  }

  if (!isSupabaseAdminConfigured()) {
    out.error = "Service role key is not configured"
    return NextResponse.json(out, { status: 200 })
  }

  try {
    const admin = createAdminSupabase()
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 50 })
    if (error) {
      out.error = error.message
      out.error_code = error.code ?? null
      return NextResponse.json(out, { status: 200 })
    }
    out.user_count = data.users.length
    out.user_emails = data.users.map((u) => u.email).filter(Boolean)
    return NextResponse.json(out, { status: 200 })
  } catch (e) {
    out.error = e instanceof Error ? e.message : String(e)
    return NextResponse.json(out, { status: 200 })
  }
}
