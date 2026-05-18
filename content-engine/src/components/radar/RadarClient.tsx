"use client"

import { useEffect, useState, useCallback } from "react"
import { toast } from "sonner"
import { Loader2, Plus, Sparkles, Trash2, ExternalLink, History, ChevronRight, Eye } from "lucide-react"
import { ItemBreakdown } from "@/components/content-engine/ItemBreakdown"
import type { ContextItemRow } from "@/lib/content-engine/types"
import { Card, CardContent, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatRelativeTime } from "@/lib/utils"

type Signal = {
  id: string
  source_handle: string | null
  content_url: string
  title_or_caption: string | null
  velocity_score: number | null
  hook_formula: string | null
  suggestion_text: string | null
  status: "new" | "saved" | "dismissed" | "used"
  captured_at: string
}

type Watch = {
  id: string
  type: "creator_handle" | "hashtag"
  platform: "instagram" | "tiktok" | "youtube"
  value: string
  added_at: string
  paused_at: string | null
}

export function RadarClient() {
  const [signals, setSignals] = useState<Signal[]>([])
  const [watch, setWatch] = useState<Watch[]>([])
  const [filter, setFilter] = useState<"new" | "saved" | "dismissed" | "used">("new")
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const [s, w] = await Promise.all([
        fetch(`/api/radar/signals?status=${filter}`).then((r) => r.json()),
        fetch("/api/radar/watch").then((r) => r.json()),
      ])
      setSignals((s.rows ?? []) as Signal[])
      setWatch((w.rows ?? []) as Watch[])
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load")
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    void reload()
  }, [reload])

  async function action(id: string, act: "save" | "dismiss" | "generate") {
    try {
      const res = await fetch(`/api/radar/signals/${id}/action`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: act }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Action failed")
      }
      toast.success(
        act === "generate"
          ? "Generated 3 reels — find them in the Idea column"
          : act === "save"
            ? "Saved to Inspiration"
            : "Dismissed"
      )
      reload()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    }
  }

  async function triggerScan() {
    setScanning(true)
    try {
      const res = await fetch("/api/radar/scan", { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Scan failed (${res.status})`)
      }
      const json = await res.json()
      toast.success(
        `Scan done: ${json.watches_scanned} watches, ${json.signals_created} signals`
      )
      reload()
      // Notify scan history panel to refresh
      window.dispatchEvent(new CustomEvent("radar:scan-completed"))
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Scan failed")
    } finally {
      setScanning(false)
    }
  }

  return (
    <main className="mx-auto max-w-7xl space-y-6 px-6 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="aiw-wordmark text-display text-[color:var(--color-foreground)]">Content Radar</h1>
          <p className="text-sm text-[color:var(--color-secondary)]">
            What's spiking in your niche, every 6 hours.
          </p>
        </div>
        <Button onClick={triggerScan} variant="outline" disabled={scanning} className="cursor-pointer">
          {scanning ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Scanning...
            </>
          ) : (
            "Scan now"
          )}
        </Button>
      </header>

      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-[color:var(--color-accent)]" /> Signals
              </CardTitle>
              <CardDescription>
                {signals.length} {filter} signal{signals.length === 1 ? "" : "s"}
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Select value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
                <SelectTrigger className="w-32">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">New</SelectItem>
                  <SelectItem value="saved">Saved</SelectItem>
                  <SelectItem value="dismissed">Dismissed</SelectItem>
                  <SelectItem value="used">Used</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {loading ? (
            <div className="space-y-2" aria-label="Loading signals">
              {[0, 1, 2].map((i) => (
                <div key={i} className="skeleton h-20 w-full" />
              ))}
            </div>
          ) : signals.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[color:var(--color-border)] py-12 text-center text-xs text-[color:var(--color-muted)]">
              No signals yet. {filter === "new"
                ? "Add some hashtags / creators below and click Scan now."
                : `Nothing ${filter} yet.`}
            </p>
          ) : (
            <div className="space-y-2">
              {signals.map((s) => (
                <SignalCard key={s.id} signal={s} onAction={action} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <WatchPanel watch={watch} onChange={reload} />

      <ScanHistoryPanel />
    </main>
  )
}

type ScanRun = {
  id: string
  watch_id: string
  status: "running" | "completed" | "failed"
  started_at: string
  completed_at: string | null
  items_pulled: number | null
  signals_created: number | null
  error_message: string | null
  niche_watch: {
    type: "creator_handle" | "hashtag"
    platform: "instagram" | "tiktok" | "youtube"
    value: string
  } | null
}

function ScanHistoryPanel() {
  const [runs, setRuns] = useState<ScanRun[]>([])
  const [loading, setLoading] = useState(true)
  const [openRunId, setOpenRunId] = useState<string | null>(null)

  const reload = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/radar/runs")
      const json = await res.json()
      setRuns((json.rows ?? []) as ScanRun[])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void reload()
    const handler = () => reload()
    window.addEventListener("radar:scan-completed", handler)
    return () => window.removeEventListener("radar:scan-completed", handler)
  }, [reload])

  return (
    <>
      <Card>
        <CardContent className="space-y-3 pt-5">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <History className="h-4 w-4 text-[color:var(--color-secondary)]" /> Scan history
              </CardTitle>
              <CardDescription>
                Past scans. Click into one to see exactly what was found.
              </CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={reload} disabled={loading}>
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Refresh"}
            </Button>
          </div>

          {loading && runs.length === 0 ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-[color:var(--color-muted)]" />
            </div>
          ) : runs.length === 0 ? (
            <p className="rounded-lg border border-dashed border-[color:var(--color-border)] py-8 text-center text-xs text-[color:var(--color-muted)]">
              No scans yet. Click &ldquo;Scan now&rdquo; above to run one.
            </p>
          ) : (
            <div className="space-y-1.5">
              {runs.map((r) => (
                <ScanRunRow key={r.id} run={r} onOpen={() => setOpenRunId(r.id)} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <ScanDetailDialog
        runId={openRunId}
        onClose={() => setOpenRunId(null)}
      />
    </>
  )
}

function ScanRunRow({ run, onOpen }: { run: ScanRun; onOpen: () => void }) {
  const watch = run.niche_watch
  const tone =
    run.status === "completed"
      ? "success"
      : run.status === "failed"
        ? "danger"
        : "accent"

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group flex w-full items-center justify-between rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2 text-left transition-colors hover:border-[color:var(--color-border-strong)]"
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        {watch ? (
          <Badge tone="neutral" className="shrink-0">
            {watch.platform} · {watch.type === "hashtag" ? `#${watch.value}` : `@${watch.value}`}
          </Badge>
        ) : (
          <Badge tone="neutral">unknown watch</Badge>
        )}
        <Badge tone={tone} className="shrink-0 capitalize">
          {run.status}
        </Badge>
        <span className="text-[10px] text-[color:var(--color-muted)]">
          {formatRelativeTime(run.started_at)}
        </span>
      </div>
      <div className="flex items-center gap-3 text-[11px] tabular-nums text-[color:var(--color-secondary)]">
        <span>{run.items_pulled ?? 0} pulled</span>
        <span className={`${(run.signals_created ?? 0) > 0 ? "text-[color:var(--color-accent)] font-medium" : ""}`}>
          {run.signals_created ?? 0} signals
        </span>
        <ChevronRight className="h-3.5 w-3.5 text-[color:var(--color-muted)] transition-transform group-hover:translate-x-0.5" />
      </div>
    </button>
  )
}

type ScanDetail = {
  run: ScanRun
  signals: {
    id: string
    content_url: string
    source_handle: string | null
    title_or_caption: string | null
    posted_at: string | null
    metrics: Record<string, unknown>
    velocity_score: number | null
    hook_formula: string | null
    suggestion_text: string | null
    status: string
    captured_at: string
  }[]
}

function ScanDetailDialog({ runId, onClose }: { runId: string | null; onClose: () => void }) {
  const [data, setData] = useState<ScanDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [breakdownItem, setBreakdownItem] = useState<ContextItemRow | null>(null)
  const [loadingBreakdown, setLoadingBreakdown] = useState<string | null>(null)

  useEffect(() => {
    if (!runId) {
      setData(null)
      return
    }
    setLoading(true)
    void fetch(`/api/radar/runs/${runId}`)
      .then((r) => r.json())
      .then((json) => setData(json as ScanDetail))
      .finally(() => setLoading(false))
  }, [runId])

  async function openBreakdown(signalId: string, contentUrl: string) {
    setLoadingBreakdown(signalId)
    try {
      const res = await fetch(`/api/context/by-url?url=${encodeURIComponent(contentUrl)}`)
      const json = await res.json()
      if (!json.item) {
        toast.info("Deep analysis not yet available — still being processed")
        return
      }
      setBreakdownItem(json.item as ContextItemRow)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load breakdown")
    } finally {
      setLoadingBreakdown(null)
    }
  }

  return (
    <>
    <Dialog open={Boolean(runId)} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Scan details</DialogTitle>
          <DialogDescription>
            {data?.run.niche_watch
              ? `${data.run.niche_watch.platform} · ${data.run.niche_watch.type === "hashtag" ? "#" : "@"}${data.run.niche_watch.value}`
              : "Loading..."}
          </DialogDescription>
        </DialogHeader>

        {loading || !data ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-4 w-4 animate-spin text-[color:var(--color-muted)]" />
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-3 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
              <Stat label="Started" value={formatRelativeTime(data.run.started_at)} />
              <Stat label="Items pulled" value={String(data.run.items_pulled ?? 0)} />
              <Stat label="Signals created" value={String(data.run.signals_created ?? 0)} />
            </div>

            {data.run.error_message ? (
              <p className="rounded-md border border-[color:var(--color-danger)]/30 bg-[color:var(--color-danger)]/10 p-2 text-xs text-[color:var(--color-danger)]">
                {data.run.error_message}
              </p>
            ) : null}

            {data.signals.length === 0 ? (
              <p className="rounded-lg border border-dashed border-[color:var(--color-border)] py-8 text-center text-xs text-[color:var(--color-muted)]">
                No spike signals from this scan. Either nothing crossed the velocity threshold, or the watched account/hashtag had no recent posts.
              </p>
            ) : (
              <div className="space-y-2">
                {data.signals.map((s) => (
                  <div
                    key={s.id}
                    className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-medium text-[color:var(--color-foreground)]">
                        {s.source_handle ?? "Hashtag"}
                      </span>
                      {s.velocity_score !== null ? (
                        <Badge tone="accent">{(s.velocity_score * 100).toFixed(1)}% eng</Badge>
                      ) : null}
                      {s.hook_formula ? (
                        <Badge tone="info">{s.hook_formula.replace(/_/g, " ")}</Badge>
                      ) : null}
                      <div className="ml-auto flex items-center gap-1">
                        <button
                          onClick={() => openBreakdown(s.id, s.content_url)}
                          disabled={loadingBreakdown === s.id}
                          className="rounded p-1 text-[color:var(--color-muted)] hover:text-[color:var(--color-foreground)]"
                          title="View deep breakdown"
                        >
                          {loadingBreakdown === s.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Eye className="h-3.5 w-3.5" />
                          )}
                        </button>
                        <a
                          href={s.content_url}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded p-1 text-[color:var(--color-muted)] hover:text-[color:var(--color-foreground)]"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                    </div>
                    {s.title_or_caption ? (
                      <p className="mt-1 line-clamp-2 text-xs text-[color:var(--color-secondary)]">
                        {s.title_or_caption}
                      </p>
                    ) : null}
                    {s.suggestion_text ? (
                      <p className="mt-2 rounded-md bg-[color:var(--color-surface-raised)] p-2 text-[11px] italic text-[color:var(--color-secondary)]">
                        {s.suggestion_text}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>

    <ItemBreakdown item={breakdownItem} onClose={() => setBreakdownItem(null)} />
    </>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <span className="text-[9px] uppercase tracking-wider text-[color:var(--color-muted)]">
        {label}
      </span>
      <span className="text-sm font-medium tabular-nums text-[color:var(--color-foreground)]">
        {value}
      </span>
    </div>
  )
}

function SignalCard({
  signal,
  onAction,
}: {
  signal: Signal
  onAction: (id: string, action: "save" | "dismiss" | "generate") => void
}) {
  return (
    <div className="rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-xs font-medium text-[color:var(--color-foreground)]">
              {signal.source_handle ?? "Hashtag"}
            </p>
            {signal.velocity_score !== null ? (
              <Badge tone="accent">{(signal.velocity_score * 100).toFixed(1)}% eng</Badge>
            ) : null}
            {signal.hook_formula ? (
              <Badge tone="info">{signal.hook_formula.replace(/_/g, " ")}</Badge>
            ) : null}
            <span className="text-[10px] text-[color:var(--color-muted)]">
              {formatRelativeTime(signal.captured_at)}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-[color:var(--color-secondary)]">
            {signal.title_or_caption ?? "(no caption)"}
          </p>
          {signal.suggestion_text ? (
            <p className="mt-2 rounded-md bg-[color:var(--color-surface-raised)] p-2 text-[11px] italic text-[color:var(--color-secondary)]">
              {signal.suggestion_text}
            </p>
          ) : null}
        </div>
        <a
          href={signal.content_url}
          target="_blank"
          rel="noreferrer"
          className="shrink-0 rounded-md p-1 text-[color:var(--color-muted)] hover:text-[color:var(--color-foreground)]"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      {signal.status === "new" ? (
        <div className="mt-3 flex items-center gap-2">
          <Button size="sm" onClick={() => onAction(signal.id, "generate")}>
            Generate my version
          </Button>
          <Button variant="outline" size="sm" onClick={() => onAction(signal.id, "save")}>
            Save to Inspiration
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onAction(signal.id, "dismiss")}>
            Dismiss
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function WatchPanel({
  watch,
  onChange,
}: {
  watch: Watch[]
  onChange: () => void
}) {
  const [type, setType] = useState<"hashtag" | "creator_handle">("hashtag")
  const [value, setValue] = useState("")
  const [busy, setBusy] = useState(false)

  async function add() {
    setBusy(true)
    try {
      const res = await fetch("/api/radar/watch", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type, platform: "instagram", value }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Add failed")
      }
      setValue("")
      toast.success("Added")
      onChange()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    } finally {
      setBusy(false)
    }
  }

  async function remove(id: string) {
    try {
      const res = await fetch(`/api/radar/watch/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Delete failed")
      onChange()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed")
    }
  }

  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <CardTitle>Niche watch</CardTitle>
        <CardDescription>
          Hashtags and creators the Radar monitors. Up to 25 of each.
        </CardDescription>

        <div className="flex items-center gap-2">
          <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="hashtag">#hashtag</SelectItem>
              <SelectItem value="creator_handle">@creator</SelectItem>
            </SelectContent>
          </Select>
          <Input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={type === "hashtag" ? "agencyowner" : "hormozi"}
          />
          <Button onClick={add} disabled={busy || !value.trim()}>
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>

        {watch.length === 0 ? (
          <p className="text-xs text-[color:var(--color-muted)]">No watches yet.</p>
        ) : (
          <div className="space-y-1">
            {watch.map((w) => (
              <div
                key={w.id}
                className="flex items-center justify-between rounded-md border border-[color:var(--color-border)] px-3 py-1.5 text-xs"
              >
                <span>
                  <Badge tone="neutral" className="mr-2">
                    {w.platform}
                  </Badge>
                  {w.value}
                </span>
                <button
                  onClick={() => remove(w.id)}
                  className="text-[color:var(--color-muted)] hover:text-[color:var(--color-danger)]"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
