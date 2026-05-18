import { NextResponse } from "next/server"
import { createServerSupabase } from "@/lib/supabase/server"
import { createAdminSupabase } from "@/lib/supabase/admin"

const STAGES = ["idea", "approved", "shot", "edited", "posted"] as const

export async function GET() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const admin = createAdminSupabase()

  // Pipeline counts (this week + last week for delta)
  const startOfThisWeek = startOfWeek(new Date())
  const startOfLastWeek = new Date(startOfThisWeek.getTime() - 7 * 86_400_000)

  const { data: scriptRows } = await admin
    .from("scripts")
    .select("status, updated_at, posted_at, hook_formula, format")
    .order("updated_at", { ascending: false })
    .limit(2000)
  const scripts = scriptRows ?? []

  const stageCounts: Record<string, { current: number; lastWeek: number }> = {}
  for (const stage of STAGES) {
    stageCounts[stage] = { current: 0, lastWeek: 0 }
  }
  for (const s of scripts) {
    const updated = new Date(s.updated_at).getTime()
    if (s.status && stageCounts[s.status as keyof typeof stageCounts] !== undefined) {
      if (updated >= startOfThisWeek.getTime()) {
        stageCounts[s.status].current++
      } else if (
        updated >= startOfLastWeek.getTime() &&
        updated < startOfThisWeek.getTime()
      ) {
        stageCounts[s.status].lastWeek++
      }
    }
  }

  // Stalled cards (>3d in pre-Posted stages)
  const now = Date.now()
  const stalled = scripts
    .filter((s) => ["idea", "approved", "shot", "edited"].includes(s.status as string))
    .map((s) => ({
      ...s,
      age_days: Math.floor((now - new Date(s.updated_at).getTime()) / 86_400_000),
    }))
    .filter((s) => s.age_days >= 3)
    .sort((a, b) => b.age_days - a.age_days)
    .slice(0, 5)

  // Performance last 30 days
  const since = new Date(now - 30 * 86_400_000).toISOString()
  const { data: perfRows } = await admin
    .from("performance")
    .select("post_id, captured_at, views, likes, comments, shares, saves")
    .gte("captured_at", since)
    .order("captured_at", { ascending: false })
  const { data: postRows } = await admin
    .from("posts")
    .select("id, script_id, posted_at, external_url, platform, keyword_dms")
    .gte("posted_at", since)
  const perf = perfRows ?? []
  const posts = postRows ?? []

  // Latest snapshot per post
  const perPost = new Map<string, (typeof perf)[number]>()
  for (const p of perf) {
    if (!perPost.has(p.post_id as string)) perPost.set(p.post_id as string, p)
  }
  const totalReach = Array.from(perPost.values()).reduce(
    (sum, p) => sum + (p.views ?? 0),
    0
  )
  const avgViews =
    perPost.size > 0
      ? Math.round(totalReach / perPost.size)
      : 0
  const top5 = Array.from(perPost.values())
    .sort((a, b) => (b.views ?? 0) - (a.views ?? 0))
    .slice(0, 5)
    .map((p) => {
      const post = posts.find((x) => x.id === p.post_id)
      const script = scripts.find((s) => s.posted_at && post?.script_id) // not strictly accurate
      return {
        post_id: p.post_id,
        external_url: post?.external_url ?? null,
        platform: post?.platform ?? null,
        views: p.views ?? 0,
        likes: p.likes ?? 0,
        comments: p.comments ?? 0,
        hook_formula: script?.hook_formula ?? null,
      }
    })

  // Hook formula breakdown
  const formulaTotals: Record<string, { count: number; views: number }> = {}
  const postedScripts = scripts.filter((s) => s.status === "posted" && s.hook_formula)
  for (const s of postedScripts) {
    if (!s.hook_formula) continue
    const id = s.hook_formula
    formulaTotals[id] = formulaTotals[id] ?? { count: 0, views: 0 }
    formulaTotals[id].count++
  }

  // Radar signals — top 3 NEW
  const { data: signalRows } = await admin
    .from("niche_signals")
    .select("*")
    .eq("status", "new")
    .order("velocity_score", { ascending: false, nullsFirst: false })
    .order("captured_at", { ascending: false })
    .limit(3)

  return NextResponse.json({
    pipeline: stageCounts,
    stalled,
    performance: {
      total_reach: totalReach,
      avg_views: avgViews,
      tracked_posts: perPost.size,
      top5,
      formula_breakdown: Object.entries(formulaTotals).map(([k, v]) => ({
        formula: k,
        count: v.count,
      })),
    },
    radar_signals: signalRows ?? [],
  })
}

function startOfWeek(d: Date): Date {
  const day = d.getDay() // 0 = Sunday
  const diff = day === 0 ? 6 : day - 1 // make Monday the start
  const out = new Date(d)
  out.setHours(0, 0, 0, 0)
  out.setDate(out.getDate() - diff)
  return out
}
