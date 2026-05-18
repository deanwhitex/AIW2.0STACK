import { Suspense } from "react"
import Image from "next/image"
import { redirect } from "next/navigation"
import { isSupabaseConfigured, isSupabaseAdminConfigured } from "@/lib/supabase/env"
import { createAdminSupabase } from "@/lib/supabase/admin"
import { LoginForm } from "./login-form"

export const dynamic = "force-dynamic"

type SearchParams = Promise<{ next?: string }>

async function detectMode(): Promise<"sign-in" | "sign-up" | "locked"> {
  // If admin client isn't usable, assume sign-in (the user already claimed it
  // somehow, or env isn't fully wired). Sign-up will reject if a user exists.
  if (!isSupabaseAdminConfigured()) return "sign-in"

  try {
    const admin = createAdminSupabase()
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1 })
    if (error) return "sign-in"
    return (data?.users ?? []).length > 0 ? "sign-in" : "sign-up"
  } catch {
    return "sign-in"
  }
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams
}) {
  if (!isSupabaseConfigured()) {
    redirect("/")
  }
  const params = await searchParams
  const next = params.next ?? "/"
  const mode = await detectMode()

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="flex flex-col items-center text-center">
        <Image
          src="/aiw-logo.png"
          alt="AIW"
          width={72}
          height={72}
          priority
        />
        <p className="mt-4 text-caption uppercase tracking-[0.24em] text-[color:var(--color-muted)]">
          AIW Content Engine
        </p>
        <h1 className="aiw-wordmark mt-2 text-display text-[color:var(--color-foreground)]">
          {mode === "sign-up" ? "Claim this instance" : "Sign in"}
        </h1>
        <p className="mt-2 text-body text-[color:var(--color-secondary)]">
          {mode === "sign-up"
            ? "Create the owner account for this deployment. Only one account is allowed."
            : "Welcome back."}
        </p>
      </div>

      <div className="mt-8 rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
        <Suspense>
          <LoginForm mode={mode} next={next} />
        </Suspense>
      </div>
    </main>
  )
}
