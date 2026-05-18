"use client"

import { Loader2, Send, Trash2, Eye, TrendingUp, Camera, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import type { GeneratedScript } from "@/lib/ai/types"

/**
 * In-chat preview of a freshly generated script. Lives in the ChatItem
 * "generated" turn before the user pushes it to the pipeline. Three
 * actions per card: Push to Pipeline (persist), Discard (drop locally),
 * View (read the full body inline).
 */
export function GeneratedScriptCard({
  script,
  pushed,
  pushing,
  expanded,
  onToggleExpanded,
  onPush,
  onDiscard,
}: {
  script: GeneratedScript
  pushed: boolean
  pushing: boolean
  expanded: boolean
  onToggleExpanded: () => void
  onPush: () => void
  onDiscard: () => void
}) {
  const headline = script.hook?.trim() || script.title?.trim() || script.topic?.trim() || "Untitled"
  const subline =
    script.angle?.trim() ||
    script.why_it_works?.trim() ||
    "Tap view to read the full body."

  return (
    <article
      className={`rounded-xl border p-3 transition-colors ${
        pushed
          ? "border-[color:var(--color-success)]/40 bg-[color:var(--color-success-soft)]"
          : "border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
      }`}
    >
      <header className="mb-2 flex flex-wrap items-center gap-1.5">
        <Badge tone="accent">{labelForFormat(script)}</Badge>
        {script.hook_formula ? (
          <Badge tone="info" className="capitalize">
            {script.hook_formula.replace(/_/g, " ")}
          </Badge>
        ) : null}
        {script.content_format ? (
          <Badge tone="neutral" className="capitalize">
            {script.content_format.replace(/_/g, " ")}
          </Badge>
        ) : null}
        {script.target_length_s ? (
          <Badge tone="neutral">{script.target_length_s}s</Badge>
        ) : null}
        {script.topic ? (
          <Badge tone="neutral" className="truncate">
            {script.topic}
          </Badge>
        ) : null}
      </header>

      <h3 className="text-label font-semibold leading-snug text-[color:var(--color-foreground)]">
        {headline}
      </h3>
      {!expanded ? (
        <p className="mt-1 line-clamp-2 text-caption text-[color:var(--color-secondary)]">
          {subline}
        </p>
      ) : null}

      {expanded ? (
        <div className="mt-3 space-y-3">
          {script.angle ? (
            <ScriptField label="Angle" value={script.angle} />
          ) : null}
          {script.body ? <ScriptField label="Body" value={script.body} multiline /> : null}
          {script.cta ? <ScriptField label="CTA" value={script.cta} /> : null}
          {script.caption ? (
            <ScriptField label="Caption" value={script.caption} multiline />
          ) : null}
          {script.why_it_works ? (
            <div className="rounded-md border border-[color:var(--color-success)]/30 bg-[color:var(--color-success-soft)] p-2">
              <div className="mb-1 flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wider text-[color:var(--color-secondary)]">
                <TrendingUp className="h-3 w-3" /> Why it works
              </div>
              <p className="text-body text-[color:var(--color-foreground)]">{script.why_it_works}</p>
            </div>
          ) : null}
          {script.shot_ideas && script.shot_ideas.length > 0 ? (
            <div className="rounded-md border border-[color:var(--color-border)] bg-[color:var(--color-background)] p-2">
              <div className="mb-1 flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wider text-[color:var(--color-secondary)]">
                <Camera className="h-3 w-3" /> Shot ideas
              </div>
              <ul className="space-y-1">
                {script.shot_ideas.map((s, i) => (
                  <li
                    key={i}
                    className="text-body text-[color:var(--color-foreground)] before:mr-2 before:text-[color:var(--color-muted)] before:content-['•']"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      <footer className="mt-3 flex items-center justify-between gap-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggleExpanded}
          aria-label={expanded ? "Hide body" : "View body"}
        >
          <Eye className="h-3 w-3" />
          {expanded ? "Hide" : "View"}
        </Button>
        <div className="flex items-center gap-1.5">
          {!pushed ? (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDiscard}
              disabled={pushing}
              aria-label="Discard"
            >
              <Trash2 className="h-3 w-3" />
              Discard
            </Button>
          ) : null}
          <Button
            onClick={onPush}
            disabled={pushed || pushing}
            size="sm"
            aria-label={pushed ? "Already in pipeline" : "Push to pipeline"}
          >
            {pushing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : pushed ? (
              <Check className="h-3 w-3" />
            ) : (
              <Send className="h-3 w-3" />
            )}
            {pushed ? "In pipeline" : pushing ? "Pushing..." : "Push to Pipeline"}
          </Button>
        </div>
      </footer>
    </article>
  )
}

function ScriptField({
  label,
  value,
  multiline = false,
}: {
  label: string
  value: string
  multiline?: boolean
}) {
  return (
    <div>
      <p className="text-caption uppercase tracking-wider text-[color:var(--color-muted)]">
        {label}
      </p>
      <p
        className={`mt-0.5 text-body text-[color:var(--color-foreground)] ${multiline ? "whitespace-pre-wrap" : ""}`}
      >
        {value}
      </p>
    </div>
  )
}

function labelForFormat(s: GeneratedScript): string {
  if (s.slides && s.slides.length > 0 && s.target_length_s === 0) return "carousel"
  if (s.sections && s.sections.length > 0) return "long-form"
  if (s.target_length_s && s.target_length_s >= 60 && s.target_length_s <= 90) return "reel · long"
  if (s.target_length_s && s.target_length_s >= 30 && s.target_length_s <= 45) return "reel · medium"
  if (s.target_length_s && s.target_length_s >= 15 && s.target_length_s <= 25) return "reel · short"
  return "reel"
}
