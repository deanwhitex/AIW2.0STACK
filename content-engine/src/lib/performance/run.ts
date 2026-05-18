/**
 * Performance loop. Pull metrics for posts that are due, write into
 * performance, classify winners/flops after the +24h mark, write feedback.
 */

import { createAdminSupabase } from "@/lib/supabase/admin"
import { scrapeInstagramReel, scrapeTikTokVideo } from "@/lib/apify/client"
import { postMortem } from "@/lib/ai/claude"
import { startIngest } from "@/lib/content-engine/ingest"

const HOUR = 3600_000

export async function pullDuePosts(limit = 50): Promise<{ pulled: number; classified: number }> {
  const admin = createAdminSupabase()
  const now = Date.now()

  // Find posts younger than 30 days that haven't been pulled in the last 50 min
  const monthAgo = new Date(now - 30 * 24 * HOUR).toISOString()
  const fiftyMinAgo = new Date(now - 50 * 60_000).toISOString()

  const { data: posts, error } = await admin
    .from("posts")
    .select("*")
    .gte("posted_at", monthAgo)
    .or(`last_pulled_at.is.null,last_pulled_at.lte.${fiftyMinAgo}`)
    .lte("pull_failures", 3)
    .order("last_pulled_at", { ascending: true, nullsFirst: true })
    .limit(limit)
  if (error) throw error

  let pulled = 0
  let classified = 0
  for (const post of posts ?? []) {
    const ok = await pullOne(post)
    if (ok) pulled++

    // Classify after +24h if not already classified (we mark on post.notes)
    const ageMs = now - new Date(post.posted_at as string).getTime()
    if (ageMs >= 24 * HOUR && !((post.notes as string | null) ?? "").includes("[classified]")) {
      const did = await classifyAndWriteFeedback(post.id as string)
      if (did) classified++
    }
  }
  return { pulled, classified }
}

type PostRow = Record<string, unknown> & {
  id: string
  external_url: string
  platform: string
  posted_at: string
  pull_failures: number
}

async function pullOne(post: PostRow): Promise<boolean> {
  const admin = createAdminSupabase()
  try {
    const isInstagram = post.platform.startsWith("instagram")
    const isTiktok = post.platform === "tiktok"
    if (!isInstagram && !isTiktok) {
      // Other platforms (YouTube Shorts) not yet wrapped; skip
      return false
    }

    const result = isInstagram
      ? await scrapeInstagramReel(post.external_url)
      : await scrapeTikTokVideo(post.external_url)
    const m = result.data.metrics
    await admin.from("performance").insert({
      post_id: post.id,
      views: m.views ?? null,
      likes: m.likes ?? null,
      comments: m.comments ?? null,
      shares: (m as { shares?: number | null }).shares ?? null,
      saves: null,
      total_interactions:
        (m.likes ?? 0) + (m.comments ?? 0) + ((m as { shares?: number }).shares ?? 0),
      raw_payload: result.data.raw,
    })
    await admin
      .from("posts")
      .update({
        last_pulled_at: new Date().toISOString(),
        pull_failures: 0,
      })
      .eq("id", post.id)
    return true
  } catch (e) {
    console.error("[performance.pullOne] failed:", e)
    await admin
      .from("posts")
      .update({
        pull_failures: (post.pull_failures ?? 0) + 1,
        last_pulled_at: new Date().toISOString(),
      })
      .eq("id", post.id)
    return false
  }
}

async function classifyAndWriteFeedback(postId: string): Promise<boolean> {
  const admin = createAdminSupabase()
  const { data: post } = await admin
    .from("posts")
    .select("*, scripts:script_id (id, hook, hook_formula, body)")
    .eq("id", postId)
    .single()
  if (!post) return false

  const { data: latest } = await admin
    .from("performance")
    .select("views")
    .eq("post_id", postId)
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  const views = (latest?.views as number | null) ?? 0
  if (views <= 0) return false

  // Compute median views from latest snapshots across all posts in the
  // last 30 days. Single query: pull every snapshot for those post IDs
  // ordered desc by captured_at, then take the first value seen per
  // post_id in JS. Avoids the previous N+1 query pattern.
  const monthAgo = new Date(Date.now() - 30 * 24 * HOUR).toISOString()
  const { data: allPosts } = await admin
    .from("posts")
    .select("id")
    .gte("posted_at", monthAgo)
  const postIds = (allPosts ?? []).map((p) => p.id as string)
  if (postIds.length === 0) return false

  const { data: perfRows } = await admin
    .from("performance")
    .select("post_id, views, captured_at")
    .in("post_id", postIds)
    .order("captured_at", { ascending: false })

  const latestByPost = new Map<string, number>()
  for (const r of (perfRows ?? []) as {
    post_id: string
    views: number | null
  }[]) {
    if (r.views != null && r.views > 0 && !latestByPost.has(r.post_id)) {
      latestByPost.set(r.post_id, r.views)
    }
  }
  const medians = [...latestByPost.values()].sort((a, b) => a - b)
  const median = medians.length > 0 ? medians[Math.floor(medians.length / 2)] : 0
  if (median <= 0) return false

  const ratio = views / median
  let verdict: "winner" | "flop" | "average" = "average"
  if (ratio >= 2) verdict = "winner"
  else if (ratio <= 0.5) verdict = "flop"

  const script = post.scripts as
    | { hook: string; hook_formula: string; body: string }
    | null

  const mortem = await postMortem({
    hook: script?.hook ?? "",
    hook_formula: script?.hook_formula ?? "curiosity_gap",
    body_preview: script?.body ?? "",
    views,
    median_views: median,
  })

  // Write to Feedback bucket as a context_item
  const tag = verdict === "winner" ? "winner" : verdict === "flop" ? "flop" : "average"
  await startIngest({
    bucket: "feedback",
    source_type: "text",
    title: `${verdict.toUpperCase()} · ${script?.hook?.slice(0, 50) ?? "(no hook)"}`,
    content: mortem.data.text + `\n\n[verdict:${tag}] [ratio:${ratio.toFixed(2)}x]`,
  })

  await admin
    .from("posts")
    .update({
      notes:
        ((post.notes as string | null) ?? "") +
        ` [classified] verdict=${verdict} ratio=${ratio.toFixed(2)}`,
    })
    .eq("id", postId)

  return true
}
