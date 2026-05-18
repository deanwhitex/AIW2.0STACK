import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

// Radar is now a view inside the unified workspace at /?view=radar.
// This route redirects so existing bookmarks keep working.
export default function RadarPage() {
  redirect("/?view=radar")
}
