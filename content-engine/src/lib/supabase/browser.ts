"use client"

import { createBrowserClient } from "@supabase/ssr"

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ""

/**
 * Browser-side Supabase client. Used inside Client Components.
 * Reads anon key from NEXT_PUBLIC_ env vars.
 */
export function createBrowserSupabase() {
  if (!url || !anonKey) {
    throw new Error(
      "Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env.local."
    )
  }
  return createBrowserClient(url, anonKey)
}
