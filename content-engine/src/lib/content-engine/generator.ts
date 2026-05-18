/**
 * Generator orchestrator. Pulls business + voice profiles, retrieves
 * RAG context per bucket, calls Claude (or stubs), persists scripts to
 * the database with pipeline status='idea'.
 */

import { createAdminSupabase } from "@/lib/supabase/admin"
import { generateScripts as claudeGenerateScripts } from "@/lib/ai/claude"
import { retrieveForGeneration } from "./retrieval"
import type {
  BusinessProfile,
  ContextSnippet,
  ExpertFrameworks,
  GeneratedScript,
  IdeaProposal,
  RetrievedContext,
  ScriptFormat,
  VoiceProfile,
} from "@/lib/ai/types"

export type GenerateRequest = {
  prompt: string
  format: ScriptFormat
  length?: "short" | "medium" | "long"
  count: number
  source: "chat" | "radar" | "manual" | "regenerate"
  anchors?: IdeaProposal[]
  /**
   * Inspiration item IDs that must be hoisted to position 0 of the
   * inspiration block. Used by the radar "generate my version" flow
   * so the spiking reel anchors the structure.
   */
  priority_inspiration_ids?: string[]
  /**
   * When false, generated scripts are returned without writing rows to
   * the scripts table. Used by the Workspace one-shot preview flow:
   * generate -> show cards -> user picks "Push to Pipeline" to persist.
   * generation_runs is still created for cost accounting.
   * Defaults to true to preserve existing callers (radar, etc.).
   */
  persist?: boolean
}

export type GenerateOutcome = {
  generation_id: string
  // When persist=true the id is the inserted scripts row id.
  // When persist=false there is no row yet, so id is null and the caller
  // must persist via /api/scripts/save-idea later.
  scripts: { id: string | null; data: GeneratedScript }[]
  mode: "real" | "stub"
  cost_usd?: number
  duration_ms?: number
}

export async function loadBusinessProfile(): Promise<BusinessProfile> {
  const admin = createAdminSupabase()
  const { data } = await admin
    .from("business_profile")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()
  return {
    niche: data?.niche ?? null,
    avatar_description: data?.avatar_description ?? null,
    offer_description: data?.offer_description ?? null,
    lead_magnet: data?.lead_magnet ?? null,
    default_comment_keyword: data?.default_comment_keyword ?? null,
  }
}

/**
 * Voice profile is sourced from two places: the curated row in
 * `voice_profile` (set during onboarding) and the my_voice context bucket
 * (added to over time). Onboarding samples are static, the bucket is
 * fresh. This function prefers bucket samples when available so the
 * voice anchor reflects the creator's current writing style, then falls
 * back to the curated samples.
 */
export async function loadVoiceProfile(): Promise<VoiceProfile> {
  const admin = createAdminSupabase()
  const [profileResp, bucketResp] = await Promise.all([
    admin
      .from("voice_profile")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    admin
      .from("context_items")
      .select("processed_content")
      .eq("bucket", "my_voice")
      .eq("status", "ready")
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(5),
  ])
  const profile = profileResp.data
  const bucketRows = (bucketResp.data ?? []) as { processed_content: string | null }[]

  const bucketSamples = bucketRows
    .map((r) => r.processed_content ?? "")
    .filter((s) => s.trim().length >= 80)

  const curatedSamples = Array.isArray(profile?.sample_transcripts)
    ? profile.sample_transcripts.filter(
        (s: unknown): s is string => typeof s === "string" && s.trim().length > 0
      )
    : []

  const seen = new Set<string>()
  const merged: string[] = []
  for (const s of [...bucketSamples, ...curatedSamples]) {
    const key = s.slice(0, 120)
    if (!seen.has(key)) {
      seen.add(key)
      merged.push(s)
    }
    if (merged.length >= 6) break
  }

  return {
    tone_descriptor: profile?.tone_descriptor ?? null,
    catchphrases: Array.isArray(profile?.catchphrases) ? profile.catchphrases : [],
    do_not_use_phrases: Array.isArray(profile?.do_not_use_phrases)
      ? profile.do_not_use_phrases
      : [],
    sample_transcripts: merged,
  }
}

/**
 * If the retrieved expert_brain has named frameworks but the script's
 * why_it_works does not reference any of them, append a one-line note
 * to flag the mismatch. Hard-fails the verification rule cleanly: the
 * creator can see the script claimed a framework that isn't actually
 * in their expert brain.
 */
function validateFrameworkClaim(
  script: GeneratedScript,
  expert_brain: ContextSnippet[]
): GeneratedScript {
  const why = (script.why_it_works ?? "").trim()
  if (why.length === 0) return script

  const knownNames: string[] = []
  for (const item of expert_brain) {
    const ef = item.metadata?.expert_frameworks as ExpertFrameworks | undefined
    if (!ef || !Array.isArray(ef.frameworks)) continue
    for (const f of ef.frameworks) {
      if (typeof f?.name === "string" && f.name.trim().length >= 4) {
        knownNames.push(f.name.trim())
      }
    }
  }

  if (knownNames.length === 0) return script

  const whyLower = why.toLowerCase()
  const matched = knownNames.some((n) => whyLower.includes(n.toLowerCase()))

  // Model said "no framework matched" honestly: leave it alone.
  const honestNoMatch = /no expert_brain framework matches/i.test(why)
  if (honestNoMatch || matched) return script

  return {
    ...script,
    why_it_works:
      why +
      "\n\n[Verification: this script's why_it_works does not reference a named framework from your Expert Brain. The cited framework may not exist in your library. Add it if it should, or regenerate if the model bluffed.]",
  }
}

function rankedInspiredByIds(retrieved: RetrievedContext, max = 8): string[] {
  // Order matters here: the model sees inspiration first, then expert_brain,
  // then voice / video_ideas / feedback. Reflect that priority in the
  // inspired_by trail so the script card shows the items that actually
  // shaped the output, not whichever were most recent.
  const ordered: ContextSnippet[] = [
    ...retrieved.inspiration,
    ...retrieved.expert_brain,
    ...retrieved.video_ideas,
    ...retrieved.my_voice,
    ...retrieved.context,
    ...retrieved.feedback,
  ]
  const out: string[] = []
  const seen = new Set<string>()
  for (const s of ordered) {
    if (seen.has(s.id)) continue
    seen.add(s.id)
    out.push(s.id)
    if (out.length >= max) break
  }
  return out
}

/**
 * Take a script row that was saved as a hook-only idea (body / cta /
 * full_script empty) and run the Claude expansion pass against it,
 * then UPDATE the same row with the expanded content. Preserves the
 * id so any kanban references, inspired_by trails, and feedback rows
 * pointing at this script stay intact.
 */
export async function expandIdeaScript(scriptId: string): Promise<{
  script_id: string
  data: GeneratedScript
  mode: "real" | "stub"
  cost_usd?: number
  duration_ms?: number
}> {
  const admin = createAdminSupabase()
  const t0 = Date.now()

  const { data: row, error: rowErr } = await admin
    .from("scripts")
    .select("*")
    .eq("id", scriptId)
    .single()
  if (rowErr || !row) throw new Error("Script not found")
  if (row.body && (row.body as string).trim().length > 0) {
    throw new Error("Script already expanded")
  }

  const format = row.format as ScriptFormat
  const prompt = (row.generation_prompt as string | null) ?? row.topic ?? ""

  // Reconstruct the IdeaProposal anchor from the saved fields.
  const anchor: IdeaProposal = {
    id: row.id as string,
    format,
    topic: (row.topic as string | null) ?? "",
    angle: (row.angle as string | null) ?? "",
    why_it_works: (row.why_it_works as string | null) ?? "",
    hook: (row.hook as string | null) ?? undefined,
    hook_formula: (row.hook_formula as IdeaProposal["hook_formula"]) ?? undefined,
    title: (row.title as string | null) ?? undefined,
  }

  // Audit: create a generation_runs entry so the cost shows up alongside
  // chat-driven generations.
  const { data: runRow } = await admin
    .from("generation_runs")
    .insert({
      request_text: prompt,
      format,
      count_requested: 1,
      status: "running",
      source: "manual",
    })
    .select("id")
    .single()
  const generation_id = runRow?.id as string | undefined

  try {
    const [business, voice, retrieved] = await Promise.all([
      loadBusinessProfile(),
      loadVoiceProfile(),
      retrieveForGeneration(prompt),
    ])

    const out = await claudeGenerateScripts({
      request: prompt,
      format,
      count: 1,
      business,
      voice,
      retrieved,
      anchors: [anchor],
    })

    const draft = out.data[0]
    if (!draft) throw new Error("Expansion returned no script")
    const validated = validateFrameworkClaim(draft, retrieved.expert_brain)
    const inspiredIds = rankedInspiredByIds(retrieved, 8)

    const updates = {
      generation_id: generation_id ?? row.generation_id,
      hook: validated.hook,
      hook_formula: validated.hook_formula,
      body: validated.body,
      cta: validated.cta,
      full_script: validated.full_script,
      caption: validated.caption,
      keyword: validated.keyword,
      hashtags: validated.hashtags,
      topic: validated.topic || row.topic,
      angle: validated.angle || row.angle,
      slides: validated.slides ?? null,
      sections: validated.sections ?? null,
      title: validated.title ?? row.title,
      total_duration_min: validated.total_duration_min ?? null,
      target_length_s: validated.target_length_s,
      content_format: validated.content_format ?? null,
      why_it_works: validated.why_it_works ?? row.why_it_works,
      shot_ideas: validated.shot_ideas ?? [],
      inspired_by: inspiredIds,
    }

    const { error: updErr } = await admin
      .from("scripts")
      .update(updates)
      .eq("id", scriptId)
    if (updErr) throw updErr

    const duration_ms = Date.now() - t0
    if (generation_id) {
      await admin
        .from("generation_runs")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          duration_ms,
          cost_usd: out.cost_usd ?? null,
          model: out.mode === "real" ? "claude-sonnet-4-6" : "stub",
          retrieved_items: inspiredIds,
          resulting_script_ids: [scriptId],
        })
        .eq("id", generation_id)
    }

    return {
      script_id: scriptId,
      data: validated,
      mode: out.mode,
      cost_usd: out.cost_usd,
      duration_ms,
    }
  } catch (e) {
    if (generation_id) {
      await admin
        .from("generation_runs")
        .update({
          status: "failed",
          completed_at: new Date().toISOString(),
          error_message: e instanceof Error ? e.message : String(e),
        })
        .eq("id", generation_id)
    }
    throw e
  }
}

export async function runGeneration(req: GenerateRequest): Promise<GenerateOutcome> {
  const admin = createAdminSupabase()
  const t0 = Date.now()

  const { data: runRow, error: runErr } = await admin
    .from("generation_runs")
    .insert({
      request_text: req.prompt,
      format: req.format,
      count_requested: req.count,
      status: "running",
      source: req.source,
    })
    .select("id")
    .single()
  if (runErr) throw runErr
  const generation_id = runRow.id as string

  try {
    const [business, voice, retrieved] = await Promise.all([
      loadBusinessProfile(),
      loadVoiceProfile(),
      retrieveForGeneration(req.prompt, {
        priorityInspirationIds: req.priority_inspiration_ids,
      }),
    ])

    const effectiveCount = req.anchors && req.anchors.length > 0 ? req.anchors.length : req.count
    const out = await claudeGenerateScripts({
      request: req.prompt,
      format: req.format,
      length: req.length,
      count: effectiveCount,
      business,
      voice,
      retrieved,
      anchors: req.anchors,
    })

    const validatedScripts = out.data.map((s) => validateFrameworkClaim(s, retrieved.expert_brain))
    const inspiredIds = rankedInspiredByIds(retrieved, 8)
    const persist = req.persist !== false // default true

    let insertedIds: (string | null)[] = validatedScripts.map(() => null)

    if (persist) {
      const insertRows = validatedScripts.map((s) => ({
        generation_id,
        generation_source: req.source,
        generation_prompt: req.prompt,
        format: req.format,
        status: "idea" as const,
        hook: s.hook,
        hook_formula: s.hook_formula,
        body: s.body,
        cta: s.cta,
        full_script: s.full_script,
        caption: s.caption,
        keyword: s.keyword,
        hashtags: s.hashtags,
        topic: s.topic,
        angle: s.angle,
        slides: s.slides ?? null,
        sections: s.sections ?? null,
        title: s.title ?? null,
        total_duration_min: s.total_duration_min ?? null,
        target_length_s: s.target_length_s,
        content_format: s.content_format ?? null,
        why_it_works: s.why_it_works ?? null,
        shot_ideas: s.shot_ideas ?? [],
        inspired_by: inspiredIds,
      }))

      const { data: inserted, error: insErr } = await admin
        .from("scripts")
        .insert(insertRows)
        .select("id")
      if (insErr) throw insErr
      insertedIds = (inserted ?? []).map((r) => r.id as string)
    }

    const duration_ms = Date.now() - t0
    await admin
      .from("generation_runs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        duration_ms,
        cost_usd: out.cost_usd ?? null,
        model: out.mode === "real" ? "claude-sonnet-4-6" : "stub",
        retrieved_items: inspiredIds,
        resulting_script_ids: insertedIds.filter((x): x is string => Boolean(x)),
      })
      .eq("id", generation_id)

    return {
      generation_id,
      scripts: validatedScripts.map((s, i) => ({ id: insertedIds[i] ?? null, data: s })),
      mode: out.mode,
      cost_usd: out.cost_usd,
      duration_ms,
    }
  } catch (e) {
    await admin
      .from("generation_runs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        error_message: e instanceof Error ? e.message : String(e),
      })
      .eq("id", generation_id)
    throw e
  }
}
