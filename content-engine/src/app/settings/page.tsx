import { redirect } from "next/navigation"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { createServerSupabase } from "@/lib/supabase/server"
import { TopBar } from "@/components/layout/top-bar"
import { SettingsClient } from "@/components/settings/SettingsClient"

export const dynamic = "force-dynamic"

export default async function SettingsPage() {
  if (!isSupabaseConfigured()) redirect("/")
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login?next=/settings")

  return (
    <>
      <TopBar userEmail={user.email} />
      <SettingsClient />
    </>
  )
}
