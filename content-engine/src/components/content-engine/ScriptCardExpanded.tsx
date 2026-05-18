"use client"

import { useEffect, useState } from "react"
import { toast } from "sonner"
import {
  Copy,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  TrendingUp,
  Camera,
  Sparkles,
  Loader2,
  X,
  ArrowLeft,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input, Label, Textarea } from "@/components/ui/input"
import { StatusPipeline, type Stage } from "./StatusPipeline"
import type { ScriptRow } from "./ScriptCard"

type LongFormSection = {
  order: number
  heading: string
  content: string
  duration_s: number
  shot_ideas?: string[]
}

/**
 * The script Inspector pane. Replaces the old centered-modal expanded view.
 * Designed to render inside a slide-in right-side panel in Workspace, so
 * the Stage (chat / pipeline / radar) stays visible alongside it.
 */
export function ScriptCardExpanded({
  card,
  open,
  onOpenChange,
  onStatusChange,
  onPatch,
  onDelete,
  onFeedback,
  onExpanded,
}: {
  card: ScriptRow | null
  open: boolean
  onOpenChange: (b: boolean) => void
  onStatusChange: (id: string, status: Stage) => void
  onPatch: (id: string, patch: Partial<ScriptRow>) => Promise<void>
  onDelete: (id: string) => void
  onFeedback: (id: string, rating: "up" | "down" | null) => void
  onExpanded?: (id: string) => Promise<void> | void
}) {
  const [hook, setHook] = useState("")
  const [body, setBody] = useState("")
  const [cta, setCta] = useState("")
  const [caption, setCaption] = useState("")
  const [keyword, setKeyword] = useState("")
  const [saving, setSaving] = useState(false)
  const [postOpen, setPostOpen] = useState(false)
  const [expanding, setExpanding] = useState(false)

  useEffect(() => {
    if (card) {
      setHook(card.hook ?? "")
      setBody(card.body ?? "")
      setCta(card.cta ?? "")
      setCaption(card.caption ?? "")
      setKeyword(card.keyword ?? "")
      setPostOpen(false)
    }
  }, [card])

  if (!open || !card) return null

  const isExpanded = Boolean((card.body ?? "").trim())

  async function expandIdea() {
    if (!card) return
    setExpanding(true)
    try {
      const res = await fetch(`/api/scripts/${card.id}/expand`, { method: "POST" })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error ?? "Expansion failed")
      if (onExpanded) await onExpanded(card.id)
      toast.success("Expanded into full script")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Expansion failed")
    } finally {
      setExpanding(false)
    }
  }

  async function save() {
    if (!card) return
    setSaving(true)
    try {
      const fullScript = `${hook}\n\n${body}\n\n${cta}`.trim()
      await onPatch(card.id, {
        hook,
        body,
        cta,
        full_script: fullScript,
        caption,
        keyword: keyword.toUpperCase(),
      })
      toast.success("Saved")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed")
    } finally {
      setSaving(false)
    }
  }

  async function copy() {
    if (!card) return
    const text = `${card.hook ?? ""}\n\n${card.body ?? ""}\n\n${card.cta ?? ""}\n\n${card.caption ?? ""}\n\n${(card.hashtags ?? []).join(" ")}`
    try {
      await navigator.clipboard.writeText(text)
      toast.success("Copied to clipboard")
    } catch {
      toast.error("Copy failed")
    }
  }

  return (
    <aside
      className="fixed inset-y-0 right-0 z-30 flex w-full flex-col border-l border-[color:var(--color-border)] bg-[color:var(--color-background)] shadow-2xl animate-fade-in lg:relative lg:w-[520px] lg:shrink-0 lg:shadow-none xl:w-[600px]"
      role="complementary"
      aria-label="Script inspector"
    >
      {/* Header */}
      <header className="flex items-start justify-between gap-3 border-b border-[color:var(--color-border)] px-5 py-4">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <Badge tone="accent">{card.format}</Badge>
            {!isExpanded ? <Badge tone="warning">Hook only</Badge> : null}
            {card.hook_formula ? (
              <Badge tone="info" className="capitalize">
                {card.hook_formula.replace(/_/g, " ")}
              </Badge>
            ) : null}
            {card.content_format ? (
              <Badge tone="neutral" className="capitalize">
                {card.content_format.replace(/_/g, " ")}
              </Badge>
            ) : null}
            {card.target_length_s ? (
              <Badge tone="neutral">{card.target_length_s}s</Badge>
            ) : null}
          </div>
          <h2 className="mt-2 text-h2 font-semibold leading-tight text-[color:var(--color-foreground)]">
            {hook || card.title || card.topic || "Edit script"}
          </h2>
          <p className="mt-1 text-caption text-[color:var(--color-secondary)]">
            {isExpanded
              ? "Inline edit. Save commits the changes."
              : "Saved idea. Expand to write the full script using your buckets, voice, and frameworks."}
          </p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => onOpenChange(false)}
          aria-label="Close inspector"
        >
          <X className="h-4 w-4" />
        </Button>
      </header>

      {/* Body */}
      <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
        {!isExpanded ? (
          <div className="space-y-2 rounded-lg border border-[color:var(--color-warning)]/30 bg-[color:var(--color-warning-soft)] p-3">
            <div className="text-caption font-semibold uppercase tracking-wider text-[color:var(--color-secondary)]">
              Hook only — not yet expanded
            </div>
            {card.angle ? (
              <div>
                <span className="text-caption uppercase tracking-wider text-[color:var(--color-muted)]">Angle</span>
                <p className="text-body text-[color:var(--color-foreground)]">{card.angle}</p>
              </div>
            ) : null}
            {card.why_it_works ? (
              <div>
                <span className="text-caption uppercase tracking-wider text-[color:var(--color-muted)]">Why this works</span>
                <p className="text-body text-[color:var(--color-foreground)]">{card.why_it_works}</p>
              </div>
            ) : null}
            <Button onClick={expandIdea} disabled={expanding} className="w-full">
              {expanding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              {expanding ? "Writing the full script..." : "Expand to full script"}
            </Button>
          </div>
        ) : null}

        {/* Status pipeline */}
        <div className="space-y-1">
          <Label>Status</Label>
          <StatusPipeline
            status={card.status === "archived" ? "idea" : (card.status as Stage)}
            onChange={(s) => onStatusChange(card.id, s)}
          />
        </div>

        {/* Mark posted inline form */}
        {postOpen ? (
          <MarkPostedInline
            scriptId={card.id}
            onCancel={() => setPostOpen(false)}
            onPosted={() => {
              onStatusChange(card.id, "posted")
              setPostOpen(false)
            }}
          />
        ) : null}

        {/* Editor fields */}
        <div className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="exp-hook">Hook</Label>
            <Input
              id="exp-hook"
              value={hook}
              onChange={(e) => setHook(e.target.value)}
              aria-invalid={hook.trim().length === 0}
            />
            {hook.trim().length === 0 ? (
              <p className="text-caption text-[color:var(--color-warning)]">
                Hook is required before saving.
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor="exp-body">Body</Label>
            <Textarea
              id="exp-body"
              rows={6}
              value={body}
              onChange={(e) => setBody(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="exp-cta">CTA</Label>
            <Input id="exp-cta" value={cta} onChange={(e) => setCta(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="exp-keyword">Keyword</Label>
              <Input
                id="exp-keyword"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Hashtags</Label>
              <div className="flex flex-wrap gap-1 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-background)] px-2 py-1.5 text-caption text-[color:var(--color-secondary)]">
                {(card.hashtags ?? []).map((t) => (
                  <span key={t}>{t}</span>
                ))}
                {(card.hashtags ?? []).length === 0 ? (
                  <span className="text-[color:var(--color-muted)]">none</span>
                ) : null}
              </div>
            </div>
          </div>
          <div className="space-y-1">
            <Label htmlFor="exp-caption">Caption</Label>
            <Textarea
              id="exp-caption"
              rows={3}
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
            />
          </div>
        </div>

        {/* Why it works */}
        {card.why_it_works ? (
          <div className="rounded-lg border border-[color:var(--color-success)]/30 bg-[color:var(--color-success-soft)] p-3">
            <div className="mb-1.5 flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wider text-[color:var(--color-secondary)]">
              <TrendingUp className="h-3.5 w-3.5" /> Why this works
            </div>
            <p className="text-body text-[color:var(--color-foreground)]">{card.why_it_works}</p>
          </div>
        ) : null}

        {/* Shot ideas */}
        {card.shot_ideas && card.shot_ideas.length > 0 ? (
          <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
            <div className="mb-2 flex items-center gap-1.5 text-caption font-semibold uppercase tracking-wider text-[color:var(--color-secondary)]">
              <Camera className="h-3.5 w-3.5" /> Shot ideas
            </div>
            <ul className="space-y-1.5">
              {card.shot_ideas.map((shot, i) => (
                <li
                  key={i}
                  className="text-body text-[color:var(--color-foreground)] before:mr-2 before:text-[color:var(--color-muted)] before:content-['•']"
                >
                  {shot}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {/* Long form sections */}
        {card.format === "long_form" && card.sections && card.sections.length > 0 ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-caption font-semibold uppercase tracking-wider text-[color:var(--color-secondary)]">
              <span>Sections</span>
              {card.total_duration_min ? (
                <span className="text-[color:var(--color-muted)]">
                  ~{card.total_duration_min} min total
                </span>
              ) : null}
            </div>
            {(card.sections as LongFormSection[]).map((sec) => (
              <details
                key={sec.order}
                className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3"
              >
                <summary className="flex cursor-pointer items-center justify-between text-label font-medium text-[color:var(--color-foreground)]">
                  <span>
                    {sec.order}. {sec.heading}
                  </span>
                  <span className="text-caption text-[color:var(--color-muted)]">
                    {sec.duration_s}s
                  </span>
                </summary>
                <div className="mt-2 space-y-2">
                  <p className="whitespace-pre-wrap text-body text-[color:var(--color-foreground)]">
                    {sec.content}
                  </p>
                  {sec.shot_ideas && sec.shot_ideas.length > 0 ? (
                    <ul className="border-l-2 border-[color:var(--color-border)] pl-3 text-caption text-[color:var(--color-secondary)]">
                      {sec.shot_ideas.map((s, i) => (
                        <li key={i} className="before:mr-2 before:content-['•']">
                          {s}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              </details>
            ))}
          </div>
        ) : null}

      </div>

      {/* Footer / actions */}
      <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--color-border)] px-5 py-3">
        <div className="flex items-center gap-1">
          <Button
            variant={card.feedback_rating === "up" ? "primary" : "ghost"}
            size="sm"
            onClick={() => onFeedback(card.id, card.feedback_rating === "up" ? null : "up")}
            aria-label="Mark this script as a winner"
          >
            <ThumbsUp className="h-3 w-3" />
          </Button>
          <Button
            variant={card.feedback_rating === "down" ? "primary" : "ghost"}
            size="sm"
            onClick={() => onFeedback(card.id, card.feedback_rating === "down" ? null : "down")}
            aria-label="Mark this script as a flop"
          >
            <ThumbsDown className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="sm" onClick={copy}>
            <Copy className="h-3 w-3" /> Copy
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              if (confirm("Archive this script?")) onDelete(card.id)
            }}
            aria-label="Archive script"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
          {card.status === "edited" || card.status === "shot" ? (
            <Button variant="outline" size="sm" onClick={() => setPostOpen(true)}>
              <Send className="h-3 w-3" /> Mark posted
            </Button>
          ) : null}
        </div>
        <Button onClick={save} disabled={saving || hook.trim().length === 0}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </footer>
    </aside>
  )
}

function MarkPostedInline({
  scriptId,
  onCancel,
  onPosted,
}: {
  scriptId: string
  onCancel: () => void
  onPosted: () => void
}) {
  const [url, setUrl] = useState("")
  const [postedAt, setPostedAt] = useState("")
  const [busy, setBusy] = useState(false)

  async function submit() {
    setBusy(true)
    try {
      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          external_url: url.trim(),
          script_id: scriptId,
          posted_at: postedAt ? new Date(postedAt).toISOString() : undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `${res.status}`)
      }
      toast.success("Marked posted. Performance pulls scheduled.")
      onPosted()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-3 rounded-lg border border-[color:var(--color-accent)]/30 bg-[color:var(--color-accent-soft)] p-3">
      <div className="flex items-center justify-between">
        <span className="text-caption font-semibold uppercase tracking-wider text-[color:var(--color-secondary)]">
          Mark posted
        </span>
        <Button variant="ghost" size="sm" onClick={onCancel} aria-label="Cancel mark posted">
          <ArrowLeft className="h-3 w-3" />
          Back
        </Button>
      </div>
      <div className="space-y-1">
        <Label htmlFor="mp-url">Live URL</Label>
        <Input
          id="mp-url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.instagram.com/reel/..."
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="mp-posted-at">Posted at (optional)</Label>
        <Input
          id="mp-posted-at"
          type="datetime-local"
          value={postedAt}
          onChange={(e) => setPostedAt(e.target.value)}
        />
      </div>
      <Button onClick={submit} disabled={busy || !url.trim()} className="w-full">
        {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
        Mark posted
      </Button>
    </div>
  )
}
