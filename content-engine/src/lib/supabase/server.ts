import { createServerClient, type CookieOptions } from "@supabase/ssr"
import { cookies } from "next/headers"
import { SUPABASE_ANON_KEY, SUPABASE_URL, assertSupabase } from "./env"

type CookieToSet = { name: string; value: string; options: CookieOptions }

/**
 * Server-side Supabase client bound to the current request's cookies.
 * Use this inside Server Components, Server Actions, and Route Handlers.
 * Respects RLS via the user's session.
 */
export async function createServerSupabase() {
  assertSupabase()
  const cookieStore = await cookies()

  return createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet: CookieToSet[]) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Server Component context: cookies are read-only here.
          // Cookie writes happen via middleware or Server Actions.
        }
      },
    },
  })
}
