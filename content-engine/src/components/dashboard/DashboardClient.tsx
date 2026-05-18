"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { ArrowRight, Sparkles, TrendingUp, AlertCircle } from "lucide-react"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatRelativeTime } from "@/lib/utils"

type Summary = {
  pipeline: Record<string, { current: number; lastWeek: number }>
  stalled: { id: string; hook: string | null; status: string; age_days: number }[]
  performance: {
    total_reach: number
    avg_views: number
    tracked_posts: number
    top5: {
      post_id: string
      external_url: string | null
      platform: string | null
      views: number
      likes: number
      comments: number
      hook_formula: string | null
    }[]
    formula_breakdown: { formula: string; count: number }[]
  }
  radar_signals: {
    id: string
    source_handle: string | null
    title_or_caption: string | null
    velocity_score: number | null
    suggestion_text: string | null
    content_url: string
  }[]
}

const STAGE_LABEL: Record<string, string> = {
  idea: "Ideas",
  approved: "Approved",
  shot: "Shot",
  edited: "Edited",
  posted: "Posted",
}

export function DashboardClient() {
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/dashboard/summary")
        if (!res.ok) throw new Error("failed")
        setData((await res.json()) as Summary)
      } catch {
        // empty render
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  if (loading) {
    return (
      <main
        className="mx-auto max-w-6xl space-y-6 px-6 py-8"
        aria-label="Loading dashboard"
      >
        <header>
          <div className="skeleton h-8 w-40" />
          <div className="skeleton mt-2 h-3 w-72" />
        </header>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="skeleton h-24 w-full" />
          ))}
        </div>
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="skeleton h-64 w-full" />
          ))}
        </div>
      </main>
    )
  }

  if (!data) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <p className="text-sm text-[color:var(--color-muted)]">Failed to load dashboard.</p>
      </main>
    )
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6 px-6 py-8">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="aiw-wordmark text-display text-[color:var(--color-foreground)]">Dashboard</h1>
          <p className="text-sm text-[color:var(--color-secondary)]">
            What's in flight, what needs attention, what's working.
          </p>
        </div>
        <Button asChild>
          <Link href="/">
            Workspace <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <PipelinePanel data={data.pipeline} />
        <RadarPanel signals={data.radar_signals} />
        <PerformancePanel data={data.performance} />
        <AttentionPanel stalled={data.stalled} />
      </div>
    </main>
  )
}

function PipelinePanel({ data }: { data: Summary["pipeline"] }) {
  const stages = ["idea", "approved", "shot", "edited", "posted"] as const
  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center justify-between">
          <CardTitle>This week</CardTitle>
          <CardDescription className="m-0">By kanban stage</CardDescription>
        </div>
        <div className="space-y-2">
          {stages.map((s) => {
            const cur = data[s]?.current ?? 0
            const last = data[s]?.lastWeek ?? 0
            const delta = cur - last
            return (
              <Link
                key={s}
                href="/"
                className="flex items-center justify-between rounded-lg border border-[color:var(--color-border)] px-3 py-2 transition-colors hover:border-[color:var(--color-border-strong)]"
              >
                <span className="text-sm">{STAGE_LABEL[s]}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium tabular-nums">{cur}</span>
                  {delta !== 0 ? (
                    <Badge tone={delta > 0 ? "success" : "warning"} className="text-[10px]">
                      {delta > 0 ? "+" : ""}
                      {delta}
                    </Badge>
                  ) : null}
                </div>
              </Link>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

function RadarPanel({ signals }: { signals: Summary["radar_signals"] }) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-[color:var(--color-accent)]" /> Today's Radar
          </CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/radar">View all →</Link>
          </Button>
        </div>
        {signals.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[color:var(--color-border)] py-6 text-center text-xs text-[color:var(--color-muted)]">
            No fresh signals yet. The Radar runs every 6 hours once Apify is connected.
          </p>
        ) : (
          <div className="space-y-2">
            {signals.slice(0, 3).map((s) => (
              <div
                key={s.id}
                className="rounded-lg border border-[color:var(--color-border)] p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium text-[color:var(--color-foreground)]">
                      {s.source_handle ?? "Hashtag"}
                    </p>
                    <p className="line-clamp-2 text-[11px] text-[color:var(--color-secondary)]">
                      {s.title_or_caption ?? "(no caption)"}
                    </p>
                  </div>
                  {s.velocity_score ? (
                    <Badge tone="accent" className="shrink-0">
                      {(s.velocity_score * 100).toFixed(1)}% eng
                    </Badge>
                  ) : null}
                </div>
                {s.suggestion_text ? (
                  <p className="mt-2 text-[11px] italic text-[color:var(--color-secondary)]">
                    {s.suggestion_text}
                  </p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function PerformancePanel({ data }: { data: Summary["performance"] }) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-[color:var(--color-success)]" /> Performance · 30d
          </CardTitle>
          <span className="text-[11px] text-[color:var(--color-muted)]">
            {data.tracked_posts} posts
          </span>
        </div>
        {data.tracked_posts === 0 ? (
          <p className="rounded-lg border border-dashed border-[color:var(--color-border)] py-6 text-center text-xs text-[color:var(--color-muted)]">
            Mark something as Posted to start tracking performance.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Stat label="Total reach" value={data.total_reach.toLocaleString()} />
              <Stat label="Avg views/post" value={data.avg_views.toLocaleString()} />
            </div>
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
                Top 5 by views
              </p>
              {data.top5.map((p) => (
                <a
                  key={p.post_id}
                  href={p.external_url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between rounded-md px-2 py-1 text-xs transition-colors hover:bg-[color:var(--color-surface-raised)]"
                >
                  <span className="truncate">
                    {p.platform ?? "post"} · {p.views.toLocaleString()}v
                  </span>
                  {p.hook_formula ? (
                    <Badge tone="info" className="text-[9px]">
                      {p.hook_formula.replace(/_/g, " ")}
                    </Badge>
                  ) : null}
                </a>
              ))}
            </div>
            {data.formula_breakdown.length > 0 ? (
              <div className="space-y-1 pt-2">
                <p className="text-[10px] uppercase tracking-wider text-[color:var(--color-muted)]">
                  Hook formula counts
                </p>
                <div className="flex flex-wrap gap-1">
                  {data.formula_breakdown.map((f) => (
                    <Badge key={f.formula} tone="neutral">
                      {f.formula.replace(/_/g, " ")} · {f.count}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : null}
          </>
        )}
      </CardContent>
    </Card>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-[color:var(--color-border)] px-3 py-2">
      <p className="text-[10px] text-[color:var(--color-muted)]">{label}</p>
      <p className="mt-0.5 text-base font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function AttentionPanel({ stalled }: { stalled: Summary["stalled"] }) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-5">
        <CardTitle className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-[color:var(--color-warning)]" /> Needs your attention
        </CardTitle>
        {stalled.length === 0 ? (
          <p className="rounded-lg border border-dashed border-[color:var(--color-border)] py-6 text-center text-xs text-[color:var(--color-muted)]">
            Nothing stalled. Pipeline is clean.
          </p>
        ) : (
          <div className="space-y-2">
            {stalled.map((s) => (
              <Link
                key={s.id}
                href="/"
                className="block rounded-lg border border-[color:var(--color-border)] p-3 transition-colors hover:border-[color:var(--color-border-strong)]"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 text-xs text-[color:var(--color-foreground)]">
                    {s.hook ?? "(no hook)"}
                  </p>
                  <Badge tone={s.age_days >= 7 ? "danger" : "warning"} className="shrink-0">
                    {s.age_days}d in {s.status}
                  </Badge>
                </div>
              </Link>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
