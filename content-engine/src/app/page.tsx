import Link from "next/link"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { envFlag } from "@/lib/utils"
import { createServerSupabase } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/supabase/admin"
import { Workspace } from "@/components/content-engine/Workspace"

export const dynamic = "force-dynamic"

export default async function Home() {
  const supabaseConfigured = isSupabaseConfigured()
  const adminConfigured = envFlag("SUPABASE_SERVICE_ROLE_KEY")

  if (!supabaseConfigured) return <NotConfiguredScreen />

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return <NotConfiguredScreen />

  const anthropicSet = envFlag("ANTHROPIC_API_KEY")
  const apifySet = envFlag("APIFY_API_TOKEN")
  const assemblySet = envFlag("ASSEMBLYAI_API_KEY")

  // Pull initial context count for the workspace badge
  let initialCount = 0
  if (adminConfigured) {
    try {
      const admin = createAdminSupabase()
      const { count } = await admin
        .from("context_items")
        .select("id", { count: "exact", head: true })
        .is("deleted_at", null)
      initialCount = count ?? 0
    } catch {}
  }

  // demoMode = any of the AI keys is missing AND not yet stored in app_settings
  // (the workspace banner reflects pure env-var state; setup wizard saves into DB)
  const demoMode = !(anthropicSet && apifySet && assemblySet)

  return (
    <Workspace
      demoMode={demoMode}
      contextItemCount={initialCount}
      userEmail={user.email}
    />
  )
}

function NotConfiguredScreen() {
  const REQUIRED = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "SUPABASE_SERVICE_ROLE_KEY",
  ]
  const missing = REQUIRED.filter((k) => !envFlag(k))

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-muted)]">AIW</p>
        <h1 className="text-3xl font-semibold tracking-tight">Content Engine</h1>
        <p className="text-sm text-[color:var(--color-secondary)]">
          Instagram reels, carousels, and story sequences produced in your voice.
        </p>
      </header>

      <section className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6">
        <h2 className="text-sm font-medium">Setup status</h2>
        <p className="mt-1 text-xs text-[color:var(--color-secondary)]">
          {missing.length > 0
            ? "Add these env vars to .env.local then restart the dev server."
            : "Sign in to start working."}
        </p>
        <ul className="mt-4 space-y-2 text-sm">
          {missing.map((k) => (
            <li key={k} className="flex items-center justify-between">
              <span>{k}</span>
              <span className="text-[10px] text-[color:var(--color-warning)]">missing</span>
            </li>
          ))}
        </ul>
        {missing.length === 0 ? (
          <Link
            href="/login"
            className="mt-4 inline-block rounded-lg bg-[color:var(--color-accent)] px-4 py-2 text-sm text-black hover:opacity-90"
          >
            Continue to sign in
          </Link>
        ) : null}
      </section>

      <p className="text-[11px] text-[color:var(--color-muted)]">
        Build plan: <code>tasks/todo.md</code>. Lessons: <code>tasks/lessons.md</code>.
      </p>
    </main>
  )
}
