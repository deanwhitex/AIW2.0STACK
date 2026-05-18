/**
 * Radar orchestrator. For each active niche_watch entry, scrape via Apify,
 * score by reach + engagement, write into niche_signals, and trigger deep
 * analysis for high-performers by auto-creating an Inspiration context item.
 */

import { createAdminSupabase } from "@/lib/supabase/admin"
import {
  scrapeInstagramCreator,
  scrapeInstagramHashtag,
} from "@/lib/apify/client"
import { radarSuggestion } from "@/lib/ai/claude"
import { startIngest } from "@/lib/content-engine/ingest"
import type { RadarItem } from "@/lib/apify/types"

type Watch = {
  id: string
  type: "creator_handle" | "hashtag"
  platform: "instagram" | "tiktok" | "youtube"
  value: string
}

// Two-stage gate. STAGE 1 finds viral content (real reach + breakout
// velocity). STAGE 2 filters that set by engagement rate. The stored
// score IS the engagement rate of survivors, so signals naturally rank
// "best engagement among the viral content" when ordered desc.

// STAGE 1 — virality filter
const VIRAL_VELOCITY_THRESHOLD = 2.0   // post must be at least 2x the watch's median reach velocity

// Adaptive reach floor. Absolute floors broke for small niches: a
// creator whose median post hits 200 views could never trigger a
// signal under MIN_VIEWS_CREATOR=500. We now scale the floor to the
// watch's own median raw views, with a tiny absolute backstop.
const MIN_VIEWS_FLOOR_ABSOLUTE = 50    // sanity floor: below this it's just noise
const MIN_VIEWS_MEDIAN_FRACTION = 0.5  // require at least 0.5x the watch's median raw views

// STAGE 2 — engagement filter (the real ranker)
const MIN_ENGAGEMENT_RATE = 0.03        // 3% engagement floor; below this it's not interesting even if viral

// Cap on how many signals from a single scan get auto-ingested into the
// Inspiration bucket. The radar runs every 6 hours; without this, the
// bucket fills with auto-saved noise and dilutes its quality as a
// structural template source. Niche_signals are still recorded for all
// items that crossed the gate so the user can save them manually.
const AUTO_INGEST_PER_SCAN_CAP = 3

export async function runRadarScan(opts?: { onlyWatchId?: string }): Promise<{
  watches_scanned: number
  signals_created: number
}> {
  const admin = createAdminSupabase()
  let q = admin
    .from("niche_watch")
    .select("id, type, platform, value")
    .is("paused_at", null)
  if (opts?.onlyWatchId) q = q.eq("id", opts.onlyWatchId)

  const { data, error } = await q
  if (error) throw error
  const watches = (data ?? []) as Watch[]

  let totalSignals = 0
  for (const w of watches) {
    const created = await scanOne(w)
    totalSignals += created
  }
  return { watches_scanned: watches.length, signals_created: totalSignals }
}

async function scanOne(w: Watch): Promise<number> {
  const admin = createAdminSupabase()
  const { data: runRow } = await admin
    .from("niche_watch_runs")
    .insert({ watch_id: w.id, status: "running" })
    .select("id")
    .single()
  const runId = runRow?.id as string | undefined

  try {
    const items = await fetchItems(w)
    const fresh = items.filter((i) => isFresh(i.posted_at))
    const baseline = computeBaseline(items)
    const medianViews = computeMedianViews(items)

    // Score every fresh item, drop the ones that fail the gate, then
    // sort by engagement so auto-ingest takes the strongest signals first.
    const scored = fresh
      .map((item) => ({ item, score: combinedScore(item, baseline, medianViews) }))
      .filter(({ score }) => score > 0)
      .sort((a, b) => b.score - a.score)

    const webhookBase = process.env.NEXT_PUBLIC_APP_URL

    // Pull niche + voice once for the whole scan instead of per item.
    const [{ data: biz }, { data: voice }] = await Promise.all([
      admin
        .from("business_profile")
        .select("niche")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
      admin
        .from("voice_profile")
        .select("tone_descriptor")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])
    const niche = biz?.niche ?? "creators"
    const voiceTone = voice?.tone_descriptor ?? "Direct, punchy, no fluff"

    let created = 0
    let autoIngested = 0
    const seenInRun = new Set<string>() // (handle|formula) keys for in-scan dedupe

    for (let idx = 0; idx < scored.length; idx++) {
      const { item, score } = scored[idx]

      // Skip duplicates by content_url across all signals ever recorded
      const { data: existing } = await admin
        .from("niche_signals")
        .select("id")
        .eq("content_url", item.url)
        .maybeSingle()
      if (existing) continue

      const sug = await radarSuggestion({
        caption: item.caption,
        metrics: { ...item.metrics, engagement_rate: engagementRate(item) },
        niche,
        voice_tone: voiceTone,
      })

      await admin.from("niche_signals").insert({
        watch_id: w.id,
        source: w.platform,
        source_handle: item.source_handle ?? w.value,
        content_url: item.url,
        title_or_caption: item.caption,
        posted_at: item.posted_at,
        metrics: {
          ...(item.metrics as unknown as Record<string, unknown>),
          engagement_rate: engagementRate(item),
        },
        velocity_score: Number(score.toFixed(4)),
        suggestion_text: sug.data.why + " — Hook idea: " + sug.data.hook_idea,
        hook_formula: sug.data.hook_formula,
      })
      created++

      // Auto-ingest only top N per scan, and dedupe by (creator, formula)
      // so we don't store five reels by the same creator using the same
      // hook pattern. Niche_signals stays complete; the user can save
      // anything manually that didn't auto-ingest.
      if (w.platform === "instagram" && autoIngested < AUTO_INGEST_PER_SCAN_CAP) {
        const dedupeKey = `${item.source_handle ?? w.value}|${sug.data.hook_formula}`
        if (!seenInRun.has(dedupeKey)) {
          seenInRun.add(dedupeKey)
          try {
            await startIngest(
              {
                bucket: "inspiration",
                source_type: "instagram_reel",
                url: item.url,
                title: `Radar: ${item.source_handle ?? w.value} -- ${score.toFixed(2)} eng`,
              },
              webhookBase
            )
            autoIngested++
          } catch (e) {
            console.error("[radar] auto-create inspiration failed:", e)
          }
        }
      }
    }

    if (runId) {
      await admin
        .from("niche_watch_runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          items_pulled: items.length,
          signals_created: created,
        })
        .eq("id", runId)
    }
    return created
  } catch (e) {
    if (runId) {
      await admin
        .from("niche_watch_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: e instanceof Error ? e.message : String(e),
        })
        .eq("id", runId)
    }
    return 0
  }
}

async function fetchItems(w: Watch): Promise<RadarItem[]> {
  if (w.platform === "instagram" && w.type === "hashtag") {
    return (await scrapeInstagramHashtag(w.value, 30)).data
  }
  if (w.platform === "instagram" && w.type === "creator_handle") {
    return (await scrapeInstagramCreator(w.value, 10)).data
  }
  // TikTok: stub for now since we don't have the Apify TikTok hashtag scraper wrapped
  return []
}

function isFresh(postedAt: string | null): boolean {
  if (!postedAt) return false
  const hoursAgo = (Date.now() - new Date(postedAt).getTime()) / 3600_000
  return hoursAgo <= 7 * 24 // 7 days
}

function computeBaseline(items: RadarItem[]): number {
  const valid = items
    .map((i) => normalisedRate(i))
    .filter((n) => Number.isFinite(n) && n > 0)
  if (valid.length === 0) return 1
  valid.sort((a, b) => a - b)
  // Median
  return valid[Math.floor(valid.length / 2)]
}

function computeMedianViews(items: RadarItem[]): number {
  const valid = items
    .map((i) => (i.metrics.views as number | null) ?? 0)
    .filter((n) => Number.isFinite(n) && n > 0)
  if (valid.length === 0) return 0
  valid.sort((a, b) => a - b)
  return valid[Math.floor(valid.length / 2)]
}

function normalisedRate(i: RadarItem): number {
  const views = (i.metrics.views as number | null) ?? 0
  if (!i.posted_at) return 0
  const hours = (Date.now() - new Date(i.posted_at).getTime()) / 3600_000
  if (hours <= 0) return 0
  return views / hours
}

function velocity(i: RadarItem, baseline: number): number {
  const r = normalisedRate(i)
  if (baseline <= 0) return 0
  return r / baseline
}

function engagementRate(i: RadarItem): number {
  const views = (i.metrics.views as number | null) ?? 0
  if (views <= 0) return 0
  const likes = (i.metrics.likes as number | null) ?? 0
  const comments = (i.metrics.comments as number | null) ?? 0
  const shares = ((i.metrics as Record<string, unknown>).shares as number | null) ?? 0
  const interactions = likes + comments + shares
  return interactions / views
}

/**
 * Two-stage gate. Find viral content first, then filter for engagement
 * within that viral set. The returned score is the engagement rate of
 * survivors, so signals stored desc by score naturally read as "best
 * engagement among the viral content".
 *
 * Stage 1 (virality): item must have real reach (above an adaptive
 * floor scaled to the watch's own median raw views) AND be running
 * at least 2x the watch's median reach velocity. Both gates must pass.
 *
 * Stage 2 (engagement): of the items that survived Stage 1, only
 * those with engagement rate >= 3% qualify. The score becomes the
 * engagement rate itself so downstream sorting prefers higher
 * engagement.
 */
function combinedScore(
  i: RadarItem,
  baseline: number,
  medianViews: number
): number {
  // Stage 1a: adaptive reach floor — "real reach" depends on the niche.
  // A small-niche creator whose median post hits 200 views still produces
  // legitimate signals at 300 views; the old absolute MIN_VIEWS=500 made
  // the radar appear broken in those niches.
  const views = (i.metrics.views as number | null) ?? 0
  const adaptiveFloor = Math.max(
    MIN_VIEWS_FLOOR_ABSOLUTE,
    Math.floor(medianViews * MIN_VIEWS_MEDIAN_FRACTION)
  )
  if (views < adaptiveFloor) return 0

  // Stage 1b: viral velocity (breakout vs the watch's typical post)
  const v = velocity(i, baseline)
  if (v < VIRAL_VELOCITY_THRESHOLD) return 0

  // Stage 2: engagement filter
  const eng = engagementRate(i)
  if (eng < MIN_ENGAGEMENT_RATE) return 0

  return eng
}
