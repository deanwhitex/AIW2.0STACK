import Image from "next/image"
import { redirect } from "next/navigation"
import { createServerSupabase } from "@/lib/supabase/server"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { SetupWizard } from "@/components/onboarding/SetupWizard"

export const dynamic = "force-dynamic"

export default async function SetupPage() {
  if (!isSupabaseConfigured()) redirect("/")

  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login?next=/setup")

  return (
    <div className="min-h-screen">
      <header className="border-b border-[color:var(--color-border)] bg-[color:var(--color-background)] px-6 py-4">
        <div className="mx-auto flex max-w-3xl items-center gap-3">
          <Image
            src="/aiw-logo.png"
            alt="AIW"
            width={36}
            height={36}
            priority
          />
          <div>
            <p className="text-caption uppercase tracking-[0.24em] text-[color:var(--color-muted)]">
              First-run setup
            </p>
            <h1 className="text-h1 font-bold italic uppercase tracking-wider text-[color:var(--color-foreground)]">
              Content Engine
            </h1>
          </div>
        </div>
      </header>
      <SetupWizard />
    </div>
  )
}
