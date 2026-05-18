"use client"

import { Expand } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { formatRelativeTime } from "@/lib/utils"
import { StatusPipeline, type Stage } from "./StatusPipeline"

export type ScriptRow = {
  id: string
  generation_id: string | null
  format: "reel" | "carousel" | "story_sequence" | "long_form"
  status: "idea" | "approved" | "shot" | "edited" | "posted" | "archived"
  hook: string | null
  hook_formula: string | null
  body: string | null
  cta: string | null
  full_script: string | null
  caption: string | null
  keyword: string | null
  hashtags: string[]
  topic: string | null
  angle: string | null
  target_length_s: number | null
  content_format: string | null
  why_it_works: string | null
  shot_ideas: string[]
  title: string | null
  sections: { order: number; heading: string; content: string; duration_s: number; shot_ideas?: string[] }[] | null
  total_duration_min: number | null
  inspired_by: string[]
  feedback_rating: "up" | "down" | null
  created_at: string
  updated_at: string
}

const FORMAT_BADGE: Record<string, string> = {
  reel: "Reel",
  carousel: "Carousel",
  story_sequence: "Stories",
  long_form: "Long-form",
}

export function ScriptCard({
  card,
  onExpand,
  onStatusChange,
}: {
  card: ScriptRow
  onExpand: (c: ScriptRow) => void
  onStatusChange: (id: string, status: Stage) => void
}) {
  const visibleStatus: Stage =
    card.status === "archived" ? "idea" : (card.status as Stage)
  // Saved-but-not-yet-expanded ideas have no body. They live in the
  // Idea column alongside fully-written scripts; the badge tells them
  // apart, and the expanded view exposes a "Expand to full script"
  // button instead of the editor fields.
  const isExpanded = Boolean((card.body ?? "").trim())
  return (
    <div className="group rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 transition-colors hover:border-[color:var(--color-border-strong)]">
      <div className="mb-1 flex items-center gap-2">
        <Badge tone="accent">{FORMAT_BADGE[card.format] ?? card.format}</Badge>
        {card.topic ? <Badge tone="neutral">{card.topic}</Badge> : null}
        {card.hook_formula ? (
          <Badge tone="info" className="text-[10px]">
            {card.hook_formula.replace(/_/g, " ")}
          </Badge>
        ) : null}
        {!isExpanded ? (
          <Badge tone="warning" className="text-[10px]">
            Hook only
          </Badge>
        ) : null}
      </div>
      <h3 className="line-clamp-2 text-sm font-medium text-[color:var(--color-foreground)]">
        {card.hook ?? card.title ?? card.topic ?? "(no hook)"}
      </h3>
      <p className="mt-1 line-clamp-2 text-[11px] text-[color:var(--color-secondary)]">
        {isExpanded
          ? (card.body ?? card.full_script ?? "")
          : (card.angle ?? card.why_it_works ?? "Click to expand into a full script")}
      </p>
      <div className="mt-3 flex items-center justify-between">
        <StatusPipeline
          status={visibleStatus}
          onChange={(s) => onStatusChange(card.id, s)}
        />
        <button
          onClick={() => onExpand(card)}
          className="rounded p-1 text-[color:var(--color-muted)] opacity-0 transition-all hover:text-[color:var(--color-foreground)] group-hover:opacity-100"
          aria-label="Expand"
        >
          <Expand className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="mt-2 text-[9px] text-[color:var(--color-muted)]">
        {formatRelativeTime(card.updated_at)}
        {card.keyword ? ` · keyword: ${card.keyword}` : null}
        {card.target_length_s && card.format === "reel"
          ? ` · ${card.target_length_s}s`
          : null}
      </p>
    </div>
  )
}
