import { redirect } from "next/navigation"

export const dynamic = "force-dynamic"

// Pipeline is now a view inside the unified workspace at /?view=pipeline.
// This route redirects so existing bookmarks and Vercel previews keep working.
export default function PipelinePage() {
  redirect("/?view=pipeline")
}
