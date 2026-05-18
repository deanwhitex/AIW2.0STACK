"use server"

import { redirect } from "next/navigation"
import { z } from "zod"
import { createServerSupabase } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/supabase/admin"
import { isSupabaseAdminConfigured } from "@/lib/supabase/env"

const credentialsSchema = z.object({
  email: z.string().trim().email("Enter a valid email"),
  password: z.string().min(8, "Password must be at least 8 characters"),
})

export type AuthState = {
  error?: string
}

export async function signIn(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  const supabase = await createServerSupabase()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)
  if (error) {
    return { error: error.message }
  }

  const next = (formData.get("next") as string) || "/"
  redirect(next)
}

export async function signUp(
  _prev: AuthState,
  formData: FormData
): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  })
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" }
  }

  // Single-tenant lock: only the first user is allowed to sign up.
  if (isSupabaseAdminConfigured()) {
    try {
      const admin = createAdminSupabase()
      const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
      if (error) return { error: `Could not check existing users: ${error.message}` }
      if ((data?.users ?? []).length > 0) {
        return {
          error:
            "This instance already has an owner. If that's you, sign in instead. If not, this app is locked.",
        }
      }
    } catch (e) {
      return {
        error: e instanceof Error ? e.message : "Unable to verify owner status",
      }
    }
  }

  const supabase = await createServerSupabase()
  const { error } = await supabase.auth.signUp(parsed.data)
  if (error) return { error: error.message }

  redirect("/setup")
}

export async function signOut() {
  const supabase = await createServerSupabase()
  await supabase.auth.signOut()
  redirect("/login")
}
