/**
 * Hybrid retrieval: top-K by full-text rank against the prompt, padded
 * with N most-recent so each bucket always contributes regardless of
 * lexical overlap. Calls the Postgres functions defined in 0001:
 * `search_context_items_fts` and `fetch_context_items_full`.
 */

import { createAdminSupabase } from "@/lib/supabase/admin"
import type { ContextSnippet, RetrievedContext } from "@/lib/ai/types"
import type { Bucket } from "./buckets"

type SearchRow = {
  id: string
  bucket: Bucket
  title: string | null
  summary: string | null
  processed_content: string | null
  tags: string[] | null
  metadata: Record<string, unknown> | null
}

// Per-bucket retrieval budget. Big buckets (expert_brain, inspiration,
// my_voice, context, video_ideas) get a hybrid mix; small instructional
// buckets always pull full coverage so nothing slips through.
const FTS_TOP_K = 8
const RECENCY_PAD = 4
const SMALL_BUCKET_FULL_LIMIT = 30

function mapSnippet(row: SearchRow): ContextSnippet {
  return {
    id: row.id,
    title: row.title,
    summary: row.summary,
    processed_content: row.processed_content,
    tags: row.tags ?? [],
    metadata: row.metadata ?? {},
  }
}

async function searchBucket(
  bucket: Bucket,
  query: string,
  limit: number
): Promise<ContextSnippet[]> {
  const admin = createAdminSupabase()
  const { data, error } = await admin.rpc("search_context_items_fts", {
    p_bucket: bucket,
    p_query: query,
    p_limit: limit,
  })
  if (error) {
    console.error(`[retrieval] FTS query failed for ${bucket}:`, error)
    return []
  }
  return ((data ?? []) as SearchRow[]).map(mapSnippet)
}

async function fetchBucketFull(bucket: Bucket, limit = 30): Promise<ContextSnippet[]> {
  const admin = createAdminSupabase()
  const { data, error } = await admin.rpc("fetch_context_items_full", {
    p_bucket: bucket,
    p_limit: limit,
  })
  if (error) {
    console.error(`[retrieval] full fetch failed for ${bucket}:`, error)
    return []
  }
  return ((data ?? []) as SearchRow[]).map(mapSnippet)
}

async function searchAndPad(
  bucket: Bucket,
  query: string,
  topK = FTS_TOP_K,
  pad = RECENCY_PAD
): Promise<ContextSnippet[]> {
  const trimmed = query.trim()
  const fts = trimmed.length > 0 ? await searchBucket(bucket, trimmed, topK) : []
  const seen = new Set(fts.map((s) => s.id))
  const recent = await fetchBucketFull(bucket, topK + pad)
  const padded = recent.filter((s) => !seen.has(s.id)).slice(0, pad)
  return [...fts, ...padded]
}

/**
 * Items scraped without a real Apify run are flagged with metadata
 * markers. They contain stub captions and stub transcripts, which means
 * any deep_analysis / framework_extraction was run on fake content. Pull
 * them out so the generator never grounds a script in invented data.
 */
function isStubItem(s: ContextSnippet): boolean {
  const m = s.metadata as Record<string, unknown>
  if (m.scrape_mode === "stub") return true
  if (m.audio_transcript_source === "stub") return true
  return false
}

/**
 * Pull every video_ideas item used in a script in the last N days.
 * Used to filter out already-shipped seed topics so they don't keep
 * getting re-proposed.
 */
async function getRecentlyUsedContextIds(days: number): Promise<Set<string>> {
  const admin = createAdminSupabase()
  const since = new Date(Date.now() - days * 86_400_000).toISOString()
  const { data, error } = await admin
    .from("scripts")
    .select("inspired_by")
    .gte("created_at", since)
  if (error) {
    console.error("[retrieval] used-ids lookup failed:", error)
    return new Set()
  }
  const out = new Set<string>()
  for (const row of (data ?? []) as { inspired_by: string[] | null }[]) {
    for (const id of row.inspired_by ?? []) out.add(id)
  }
  return out
}

async function fetchItemsByIds(ids: string[]): Promise<ContextSnippet[]> {
  if (ids.length === 0) return []
  const admin = createAdminSupabase()
  const { data, error } = await admin
    .from("context_items")
    .select("id, bucket, title, summary, processed_content, tags, metadata")
    .in("id", ids)
    .is("deleted_at", null)
    .eq("status", "ready")
  if (error) {
    console.error("[retrieval] fetchItemsByIds failed:", error)
    return []
  }
  return ((data ?? []) as SearchRow[]).map(mapSnippet)
}

export type RetrievalOptions = {
  /**
   * Inspiration item IDs that must be hoisted to the top of the
   * inspiration block regardless of FTS rank. Used by the radar
   * "generate my version" flow so the spiking reel is always the
   * primary structural anchor.
   */
  priorityInspirationIds?: string[]
}

/**
 * Main retrieval call. Hybrid query-aware: each bucket gets its top-K
 * FTS-ranked items plus a recency pad. Small buckets get full coverage.
 * Stub-mode inspiration items are filtered out. Recently-used video_ideas
 * are filtered out. Priority inspiration items are hoisted to the top.
 */
export async function retrieveForGeneration(
  query: string,
  opts: RetrievalOptions = {}
): Promise<RetrievedContext> {
  const [usedIds, priorityItems, ...buckets] = await Promise.all([
    getRecentlyUsedContextIds(30),
    fetchItemsByIds(opts.priorityInspirationIds ?? []),
    searchAndPad("video_ideas", query),
    searchAndPad("inspiration", query),
    searchAndPad("expert_brain", query),
    searchAndPad("my_voice", query),
    searchAndPad("context", query),
    fetchBucketFull("instructions", SMALL_BUCKET_FULL_LIMIT),
    fetchBucketFull("feedback", SMALL_BUCKET_FULL_LIMIT),
  ])

  const [
    video_ideas_raw,
    inspiration_raw,
    expert_brain,
    my_voice,
    context,
    instructions,
    feedback,
  ] = buckets

  const video_ideas = video_ideas_raw.filter((s) => !usedIds.has(s.id))

  const inspirationFiltered = inspiration_raw.filter((s) => !isStubItem(s))
  const priorityIds = new Set(priorityItems.map((p) => p.id))
  const inspiration = [
    ...priorityItems,
    ...inspirationFiltered.filter((s) => !priorityIds.has(s.id)),
  ]

  return {
    video_ideas,
    inspiration,
    expert_brain,
    my_voice,
    context,
    instructions,
    feedback,
  }
}

export async function listBucket(
  bucket: Bucket,
  opts: { search?: string; limit?: number; offset?: number } = {}
): Promise<{ rows: SearchRow[]; total: number }> {
  const admin = createAdminSupabase()
  const limit = Math.min(opts.limit ?? 50, 200)
  const offset = opts.offset ?? 0

  let q = admin
    .from("context_items")
    .select("*", { count: "exact" })
    .eq("bucket", bucket)
    .is("deleted_at", null)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  if (opts.search && opts.search.trim().length > 0) {
    q = q.textSearch("search_doc", opts.search, { type: "websearch", config: "english" })
  }

  const { data, error, count } = await q
  if (error) throw error
  return { rows: (data ?? []) as SearchRow[], total: count ?? 0 }
}

export async function bucketCounts(): Promise<Record<Bucket, number>> {
  const admin = createAdminSupabase()
  const out: Record<string, number> = {
    video_ideas: 0,
    inspiration: 0,
    expert_brain: 0,
    my_voice: 0,
    context: 0,
    instructions: 0,
    feedback: 0,
  }
  const { data, error } = await admin
    .from("context_items")
    .select("bucket")
    .is("deleted_at", null)
  if (error) throw error
  for (const row of (data ?? []) as { bucket: string }[]) {
    out[row.bucket] = (out[row.bucket] ?? 0) + 1
  }
  return out as Record<Bucket, number>
}
