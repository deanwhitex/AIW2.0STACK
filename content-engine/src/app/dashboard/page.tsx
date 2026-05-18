import { redirect } from "next/navigation"
import { isSupabaseConfigured } from "@/lib/supabase/env"
import { createServerSupabase } from "@/lib/supabase/server"
import { TopBar } from "@/components/layout/top-bar"
import { DashboardClient } from "@/components/dashboard/DashboardClient"

export const dynamic = "force-dynamic"

export default async function DashboardPage() {
  if (!isSupabaseConfigured()) redirect("/")
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect("/login?next=/dashboard")

  return (
    <>
      <TopBar userEmail={user.email} />
      <DashboardClient />
    </>
  )
}
