"use client"

import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import {
  Loader2,
  Plus,
  Search,
  Trash2,
  ExternalLink,
  RefreshCw,
  X,
  ChevronLeft,
} from "lucide-react"
import { ItemBreakdown } from "./ItemBreakdown"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { BUCKET_BY_SLUG, type Bucket } from "@/lib/content-engine/buckets"
import { BUCKET_ICONS, BUCKET_COLOR_VAR, BUCKET_SOFT_VAR } from "./icons"
import { formatRelativeTime } from "@/lib/utils"
import type { ContextItemRow } from "@/lib/content-engine/types"

const STATUS_TONE: Record<string, "neutral" | "accent" | "success" | "warning" | "danger"> = {
  ready: "success",
  queued: "neutral",
  fetching: "accent",
  transcribing: "accent",
  summarising: "accent",
  failed: "danger",
}

const NON_TERMINAL_STATUSES = new Set(["queued", "fetching", "transcribing", "summarising"])
const POLL_INTERVAL_MS = 4000

export function BucketView({
  bucket,
  onClose,
  onAdd,
  onDeleted,
}: {
  bucket: Bucket | null
  onClose: () => void
  onAdd: () => void
  onDeleted?: () => void
}) {
  const [items, setItems] = useState<ContextItemRow[]>([])
  const [search, setSearch] = useState("")
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState<ContextItemRow | null>(null)

  const reload = useCallback(async () => {
    if (!bucket) return
    setLoading(true)
    try {
      const params = new URLSearchParams({ bucket })
      if (search.trim()) params.set("search", search.trim())
      const res = await fetch(`/api/context?${params.toString()}`)
      const json = await res.json()
      setItems((json.rows ?? []) as ContextItemRow[])
    } finally {
      setLoading(false)
    }
  }, [bucket, search])

  useEffect(() => {
    if (bucket) {
      reload()
      setSelected(null)
    }
  }, [bucket, reload])

  // Auto-poll while any item in the bucket is mid-pipeline.
  useEffect(() => {
    if (!bucket) return
    const anyPending = items.some((i) => NON_TERMINAL_STATUSES.has(i.status))
    if (!anyPending) return
    const id = setInterval(reload, POLL_INTERVAL_MS)
    return () => clearInterval(id)
  }, [bucket, items, reload])

  // If a polled refresh produces a fresher version of the open item, swap it in.
  useEffect(() => {
    if (!selected) return
    const fresh = items.find((i) => i.id === selected.id)
    if (fresh && fresh !== selected) setSelected(fresh)
  }, [items, selected])

  if (!bucket) return null
  const def = BUCKET_BY_SLUG[bucket]
  const Icon = BUCKET_ICONS[bucket]
  const colorVar = BUCKET_COLOR_VAR[bucket]
  const softVar = BUCKET_SOFT_VAR[bucket]

  return (
    <DialogPrimitive.Root open={Boolean(bucket)} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in" />
        <DialogPrimitive.Content
          className="fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-[color:var(--color-border)] bg-[color:var(--color-background)] shadow-2xl outline-none focus-visible:outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-right md:max-w-[min(1100px,95vw)]"
        >
          <DialogPrimitive.Title className="sr-only">{def.label}</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">{def.description}</DialogPrimitive.Description>

          {/* Sheet header */}
          <header className="flex items-center justify-between border-b border-[color:var(--color-border)] px-5 py-3">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg"
                style={{ background: `var(${softVar})` }}
              >
                <Icon className="h-4 w-4" style={{ color: `var(${colorVar})` }} />
              </div>
              <div>
                <h2 className="text-h2 font-semibold tracking-tight">{def.label}</h2>
                <p className="text-caption text-[color:var(--color-secondary)]">
                  {def.description}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </header>

          {/* Two-column body: list (left) + detail (right). On small screens
              we collapse to one column and swap to detail when an item is
              selected. */}
          <div className="flex flex-1 overflow-hidden">
            {/* List pane — hidden on small screens when a detail is open. */}
            <section
              className={`${selected ? "hidden md:flex" : "flex"} w-full flex-col border-r border-[color:var(--color-border)] md:max-w-md md:flex-shrink-0`}
            >
              <div className="flex items-center gap-2 border-b border-[color:var(--color-border)] px-4 py-3">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[color:var(--color-muted)]" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search items..."
                    className="pl-9"
                  />
                </div>
                <Button onClick={onAdd} size="sm" aria-label="Add item">
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-3">
                {loading && items.length === 0 ? (
                  <div className="space-y-2" aria-label="Loading items">
                    {[0, 1, 2, 3].map((i) => (
                      <div key={i} className="skeleton h-16 w-full" />
                    ))}
                  </div>
                ) : items.length === 0 ? (
                  <EmptyBucket bucket={bucket} onAdd={onAdd} />
                ) : (
                  items.map((item) => (
                    <ItemRow
                      key={item.id}
                      item={item}
                      selected={selected?.id === item.id}
                      onOpen={() => setSelected(item)}
                      onDeleted={() => {
                        onDeleted?.()
                        if (selected?.id === item.id) setSelected(null)
                        reload()
                      }}
                      onReprocessed={reload}
                    />
                  ))
                )}
              </div>
            </section>

            {/* Detail pane — shown to the right on md+, replaces list on small. */}
            <section className={`${selected ? "flex" : "hidden md:flex"} flex-1 flex-col overflow-y-auto`}>
              {selected ? (
                <div className="flex flex-1 flex-col">
                  <div className="flex items-center gap-2 border-b border-[color:var(--color-border)] px-4 py-2 md:hidden">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelected(null)}
                      aria-label="Back to list"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                      Back
                    </Button>
                  </div>
                  <ItemBreakdown item={selected} onClose={() => setSelected(null)} inline />
                </div>
              ) : (
                <div className="flex flex-1 items-center justify-center px-6 py-12 text-center text-caption text-[color:var(--color-muted)]">
                  Select an item to see its breakdown.
                </div>
              )}
            </section>
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function ItemRow({
  item,
  selected,
  onOpen,
  onDeleted,
  onReprocessed,
}: {
  item: ContextItemRow
  selected: boolean
  onOpen: () => void
  onDeleted: () => void
  onReprocessed: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [reprocessing, setReprocessing] = useState(false)

  async function del(e: React.MouseEvent) {
    e.stopPropagation()
    if (!confirm("Move this to trash?")) return
    setDeleting(true)
    try {
      const res = await fetch(`/api/context/${item.id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Delete failed")
      toast.success("Moved to trash")
      onDeleted()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Delete failed")
    } finally {
      setDeleting(false)
    }
  }

  async function reprocess(e: React.MouseEvent) {
    e.stopPropagation()
    setReprocessing(true)
    try {
      const res = await fetch(`/api/context/${item.id}/reprocess`, { method: "POST" })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error ?? "Reprocess failed")
      const status = body.status as string
      if (status === "fetching") {
        toast.success("Re-scraping in background")
      } else if (status === "ready") {
        toast.success("Re-processed")
      } else {
        toast.info(`Status: ${status}`)
      }
      onReprocessed()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reprocess failed")
    } finally {
      setReprocessing(false)
    }
  }

  const tone = STATUS_TONE[item.status] ?? "neutral"

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group block w-full rounded-lg border p-3 text-left transition-colors ${
        selected
          ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent-soft)]"
          : "border-[color:var(--color-border)] bg-[color:var(--color-surface)] hover:border-[color:var(--color-border-strong)]"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-label font-medium text-[color:var(--color-foreground)]">
              {item.title || "Untitled"}
            </p>
            <Badge tone={tone} className="capitalize">
              {item.status}
            </Badge>
          </div>
          {item.summary ? (
            <p className="mt-1 line-clamp-2 text-caption text-[color:var(--color-secondary)]">
              {item.summary}
            </p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="text-caption text-[color:var(--color-muted)]">
              {item.source_type.replace("_", " ")}
            </span>
            <span className="text-caption text-[color:var(--color-muted)]">·</span>
            <span className="text-caption text-[color:var(--color-muted)]">
              {formatRelativeTime(item.created_at)}
            </span>
            {item.tags.slice(0, 3).map((t) => (
              <Badge key={t} tone="neutral" className="text-caption">
                {t}
              </Badge>
            ))}
          </div>
          {item.error_message ? (
            <p className="mt-1 text-caption text-[color:var(--color-danger)]">
              {item.error_message}
            </p>
          ) : null}
        </div>
        <div
          className="flex shrink-0 items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100"
          onClick={(e) => e.stopPropagation()}
        >
          {item.source_url ? (
            <Button
              asChild
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              aria-label="Open source URL"
            >
              <a href={item.source_url} target="_blank" rel="noreferrer">
                <ExternalLink className="h-3 w-3" />
              </a>
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={reprocess}
            disabled={reprocessing || deleting}
            aria-label="Reprocess item"
          >
            {reprocessing ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={del}
            disabled={deleting || reprocessing}
            aria-label="Delete item"
          >
            {deleting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          </Button>
        </div>
      </div>
    </button>
  )
}

function EmptyBucket({
  bucket,
  onAdd,
}: {
  bucket: Bucket
  onAdd: () => void
}) {
  const def = BUCKET_BY_SLUG[bucket]
  const examples: Record<Bucket, string[]> = {
    video_ideas: ["A reel about why most agency websites do not convert", "A contrarian take on the AI agency model"],
    inspiration: ["A competitor reel URL", "A TikTok with high engagement"],
    expert_brain: ["A YouTube link to a podcast", "A book PDF on copywriting"],
    my_voice: ["A past reel of yours", "A voice memo about how you talk"],
    context: ["Your offer one-pager (PDF)", "A case study URL"],
    instructions: ["Always end with comment WEB", "No swearing"],
    feedback: ["(populated automatically as posts perform)"],
  }
  const lines = examples[bucket] ?? []

  return (
    <div className="rounded-xl border border-dashed border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-6 text-center">
      <h3 className="text-label font-semibold text-[color:var(--color-foreground)]">
        Nothing here yet
      </h3>
      <p className="mt-1 text-caption text-[color:var(--color-secondary)]">
        {def.description}
      </p>
      {lines.length > 0 ? (
        <ul className="mt-3 space-y-1 text-left text-caption text-[color:var(--color-muted)]">
          {lines.map((l, i) => (
            <li key={i} className="before:mr-2 before:content-['·']">{l}</li>
          ))}
        </ul>
      ) : null}
      {bucket !== "feedback" ? (
        <Button onClick={onAdd} size="sm" className="mt-4">
          <Plus className="h-3.5 w-3.5" />
          Add your first
        </Button>
      ) : null}
    </div>
  )
}
