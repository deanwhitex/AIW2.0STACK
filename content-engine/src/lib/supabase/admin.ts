import { createClient } from "@supabase/supabase-js"
import {
  SUPABASE_SERVICE_ROLE_KEY,
  SUPABASE_URL,
  isSupabaseAdminConfigured,
} from "./env"

/**
 * Service-role Supabase client. Bypasses RLS.
 * Use ONLY in server-side code (API routes, server actions, cron handlers).
 * Never import this from a Client Component.
 */
export function createAdminSupabase() {
  if (!isSupabaseAdminConfigured()) {
    throw new Error(
      "Supabase admin not configured. Add SUPABASE_SERVICE_ROLE_KEY to your .env.local."
    )
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
