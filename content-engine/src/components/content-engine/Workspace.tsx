"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { toast } from "sonner"
import { Loader2, Sparkles } from "lucide-react"
import { ContextPanel } from "./ContextPanel"
import { ChatInput } from "./ChatInput"
import { type ScriptRow } from "./ScriptCard"
import { ScriptCardExpanded } from "./ScriptCardExpanded"
import { PipelineKanban } from "./PipelineKanban"
import { GeneratedScriptCard } from "./GeneratedScriptCard"
import { TopBar, type ViewMode } from "@/components/layout/top-bar"
import { RadarClient } from "@/components/radar/RadarClient"
import { Badge } from "@/components/ui/badge"
import type { GeneratedScript, ScriptFormat, ScriptLength } from "@/lib/ai/types"
import type { Stage } from "./StatusPipeline"

/**
 * Per-script state inside a generated turn. Tracks whether the user has
 * pushed it to the pipeline, whether the body is expanded inline, and the
 * resulting DB id once a push completes.
 */
type GeneratedItem = {
  local_id: string
  data: GeneratedScript
  pushed: boolean
  pushing: boolean
  pushed_script_id?: string
  expanded: boolean
}

type ChatItem =
  | { id: string; kind: "user"; text: string; ts: string }
  | { id: string; kind: "error"; text: string; ts: string }
  | {
      id: string
      kind: "generated"
      ts: string
      prompt: string
      format: ScriptFormat
      length: ScriptLength
      mode: "real" | "stub"
      scripts: GeneratedItem[]
    }

export function Workspace({
  demoMode,
  contextItemCount: initialContextCount,
  userEmail,
}: {
  demoMode: boolean
  contextItemCount: number
  userEmail?: string | null
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const viewParam = searchParams.get("view")
  const view: ViewMode =
    viewParam === "pipeline" ? "pipeline" : viewParam === "radar" ? "radar" : "chat"
  const setView = useCallback(
    (v: ViewMode) => {
      const params = new URLSearchParams(searchParams.toString())
      if (v === "chat") params.delete("view")
      else params.set("view", v)
      const qs = params.toString()
      router.push(qs ? `/?${qs}` : "/")
    },
    [router, searchParams]
  )

  const [items, setItems] = useState<ChatItem[]>([])
  const [busy, setBusy] = useState(false)
  const [cards, setCards] = useState<ScriptRow[]>([])
  const [contextItemCount, setContextItemCount] = useState(initialContextCount)
  const [expanded, setExpanded] = useState<ScriptRow | null>(null)
  const [expandedOpen, setExpandedOpen] = useState(false)
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Persist the chat turn list locally so generated previews survive a
  // refresh. Capped to the last 30 turns; key suffix bumps invalidate
  // older entries when ChatItem shape changes.
  const STORAGE_KEY = "aiw:workspace:items:v2"
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (raw) {
        const parsed = JSON.parse(raw) as ChatItem[]
        if (Array.isArray(parsed)) setItems(parsed.slice(-30))
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(-30)))
    } catch {}
  }, [items])

  const reloadCards = useCallback(async () => {
    try {
      const res = await fetch("/api/scripts?limit=200")
      const json = await res.json()
      setCards((json.rows ?? []) as ScriptRow[])
    } catch {}
  }, [])

  const reloadCounts = useCallback(async () => {
    try {
      const res = await fetch("/api/context")
      const json = await res.json()
      const total = Object.values(json.counts ?? {}).reduce(
        (a: number, b) => a + (b as number),
        0
      )
      setContextItemCount(total as number)
    } catch {}
  }, [])

  useEffect(() => {
    reloadCards()
  }, [reloadCards])

  /**
   * One-shot generation. Calls /api/generate with persist=false so the
   * scripts come back as data (no DB rows). The user pushes the ones
   * they want with the per-card "Push to Pipeline" button.
   */
  async function handleSend(
    prompt: string,
    opts: { format: ScriptFormat; length: ScriptLength; count: number }
  ) {
    const userItem: ChatItem = {
      id: `u-${Date.now()}`,
      kind: "user",
      text: prompt,
      ts: new Date().toISOString(),
    }
    setItems((prev) => [...prev, userItem])
    setBusy(true)
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          prompt,
          format: opts.format,
          length: opts.length,
          count: opts.count,
          source: "chat",
          persist: false,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Generation failed: ${res.status}`)
      }
      const json = (await res.json()) as {
        generation_id: string
        scripts: { id: string | null; data: GeneratedScript }[]
        mode: "real" | "stub"
      }
      const turnId = `g-${Date.now()}`
      setItems((prev) => [
        ...prev,
        {
          id: turnId,
          kind: "generated",
          ts: new Date().toISOString(),
          prompt,
          format: opts.format,
          length: opts.length,
          mode: json.mode,
          scripts: json.scripts.map((s, i) => ({
            local_id: `${turnId}-${i}`,
            data: s.data,
            pushed: false,
            pushing: false,
            expanded: false,
          })),
        },
      ])
    } catch (e) {
      setItems((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          kind: "error",
          text: e instanceof Error ? e.message : "Generation failed",
          ts: new Date().toISOString(),
        },
      ])
    } finally {
      setBusy(false)
    }
  }

  function toggleScriptExpanded(turnId: string, localId: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.id === turnId && it.kind === "generated"
          ? {
              ...it,
              scripts: it.scripts.map((s) =>
                s.local_id === localId ? { ...s, expanded: !s.expanded } : s
              ),
            }
          : it
      )
    )
  }

  function discardScript(turnId: string, localId: string) {
    setItems((prev) =>
      prev
        .map((it) =>
          it.id === turnId && it.kind === "generated"
            ? { ...it, scripts: it.scripts.filter((s) => s.local_id !== localId) }
            : it
        )
        // If the turn now has zero scripts, drop it entirely so the chat
        // doesn't accumulate empty turn shells.
        .filter((it) => !(it.kind === "generated" && it.scripts.length === 0))
    )
  }

  async function pushScript(turnId: string, localId: string) {
    const turn = items.find((it) => it.id === turnId)
    if (!turn || turn.kind !== "generated") return
    const item = turn.scripts.find((s) => s.local_id === localId)
    if (!item || item.pushed || item.pushing) return

    // Optimistic: mark pushing
    setItems((prev) =>
      prev.map((it) =>
        it.id === turnId && it.kind === "generated"
          ? {
              ...it,
              scripts: it.scripts.map((s) =>
                s.local_id === localId ? { ...s, pushing: true } : s
              ),
            }
          : it
      )
    )

    try {
      const s = item.data
      const res = await fetch("/api/scripts/save-idea", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          format: turn.format,
          prompt: turn.prompt,
          length: turn.length,
          topic: s.topic ?? "",
          angle: s.angle ?? "",
          why_it_works: s.why_it_works ?? "",
          hook: s.hook,
          hook_formula: s.hook_formula,
          title: s.title,
          body: s.body,
          cta: s.cta,
          full_script: s.full_script,
          caption: s.caption,
          keyword: s.keyword,
          hashtags: s.hashtags,
          target_length_s: s.target_length_s,
          total_duration_min: s.total_duration_min,
          content_format: s.content_format,
          shot_ideas: s.shot_ideas,
          slides: s.slides,
          sections: s.sections,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Push failed")
      }
      const json = (await res.json().catch(() => ({}))) as { script?: ScriptRow }
      // Optimistic insert into local kanban state
      if (json.script) {
        setCards((prev) => [json.script as ScriptRow, ...prev])
      }
      setItems((prev) =>
        prev.map((it) =>
          it.id === turnId && it.kind === "generated"
            ? {
                ...it,
                scripts: it.scripts.map((s) =>
                  s.local_id === localId
                    ? {
                        ...s,
                        pushed: true,
                        pushing: false,
                        pushed_script_id: json.script?.id,
                      }
                    : s
                ),
              }
            : it
        )
      )
      reloadCards()
      toast.success("Pushed to pipeline", {
        action: {
          label: "Open Pipeline",
          onClick: () => setView("pipeline"),
        },
      })
    } catch (e) {
      setItems((prev) =>
        prev.map((it) =>
          it.id === turnId && it.kind === "generated"
            ? {
                ...it,
                scripts: it.scripts.map((s) =>
                  s.local_id === localId ? { ...s, pushing: false } : s
                ),
              }
            : it
        )
      )
      toast.error(e instanceof Error ? e.message : "Push failed")
    }
  }

  async function patchCard(id: string, patch: Partial<ScriptRow>) {
    // Optimistic: snapshot the row, apply patch locally, send request,
    // revert on failure. The user sees their edit instantly with no flicker.
    const before = cards.find((c) => c.id === id)
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)))
    setExpanded((prev) => (prev && prev.id === id ? { ...prev, ...patch } : prev))
    try {
      const res = await fetch(`/api/scripts/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(patch),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `Update failed`)
      }
      const updated = (await res.json()) as ScriptRow
      setCards((prev) => prev.map((c) => (c.id === id ? updated : c)))
      setExpanded((prev) => (prev && prev.id === id ? updated : prev))
    } catch (e) {
      if (before) {
        setCards((prev) => prev.map((c) => (c.id === id ? before : c)))
        setExpanded((prev) => (prev && prev.id === id ? before : prev))
      }
      throw e
    }
  }

  async function statusChange(id: string, status: Stage) {
    setCards((prev) =>
      prev.map((c) => (c.id === id ? { ...c, status: status as ScriptRow["status"] } : c))
    )
    try {
      await patchCard(id, { status: status as ScriptRow["status"] })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Status change failed")
      reloadCards()
    }
  }

  async function deleteCard(id: string) {
    setCards((prev) => prev.filter((c) => c.id !== id))
    setExpandedOpen(false)
    try {
      const res = await fetch(`/api/scripts/${id}`, { method: "DELETE" })
      if (!res.ok) throw new Error("Archive failed")
      toast.success("Archived")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Archive failed")
      reloadCards()
    }
  }

  async function setFeedback(id: string, rating: "up" | "down" | null) {
    try {
      await patchCard(id, { feedback_rating: rating })
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Feedback failed")
    }
  }

  function openInspector(card: ScriptRow) {
    setExpanded(card)
    setExpandedOpen(true)
  }

  return (
    <div className="flex h-screen flex-col bg-[color:var(--color-background)] text-[color:var(--color-foreground)]">
      <TopBar
        userEmail={userEmail}
        onToggleSidebar={() => setSidebarOpen((o) => !o)}
        view={view}
        onViewChange={setView}
      />
      <div className="flex flex-1 overflow-hidden">
        <ContextPanel
          mobileOpen={sidebarOpen}
          onMobileClose={() => setSidebarOpen(false)}
        />

        <div className="flex flex-1 overflow-hidden">
          <main className="flex flex-1 flex-col overflow-hidden">
            {demoMode ? (
              <div className="border-b border-[color:var(--color-border)] bg-[color:var(--color-accent-soft)] px-4 py-2 text-caption text-[color:var(--color-accent)]">
                Demo mode — connect Anthropic, Apify, and AssemblyAI keys in Settings to flip on real generation.
              </div>
            ) : null}

            {view === "chat" ? (
              <ChatStage
                items={items}
                busy={busy}
                onSend={handleSend}
                onTogglePreview={toggleScriptExpanded}
                onPushScript={pushScript}
                onDiscardScript={discardScript}
                contextItemCount={contextItemCount}
                onCountReload={reloadCounts}
              />
            ) : view === "pipeline" ? (
              <div className="flex flex-1 overflow-hidden">
                <PipelineKanban
                  open
                  inline
                  onClose={() => {}}
                  cards={cards}
                  onExpand={openInspector}
                  onStatusChange={statusChange}
                  onDelete={deleteCard}
                />
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                <RadarClient />
              </div>
            )}
          </main>

          <ScriptCardExpanded
            card={expanded}
            open={expandedOpen}
            onOpenChange={setExpandedOpen}
            onStatusChange={statusChange}
            onPatch={patchCard}
            onDelete={deleteCard}
            onFeedback={setFeedback}
            onExpanded={async (id) => {
              try {
                const res = await fetch(`/api/scripts/${id}`)
                if (res.ok) {
                  const row = (await res.json()) as ScriptRow
                  setCards((prev) => prev.map((c) => (c.id === id ? row : c)))
                  setExpanded(row)
                }
              } catch {}
            }}
          />
        </div>
      </div>
    </div>
  )
}

function ChatStage({
  items,
  busy,
  onSend,
  onTogglePreview,
  onPushScript,
  onDiscardScript,
  contextItemCount,
  onCountReload,
}: {
  items: ChatItem[]
  busy: boolean
  onSend: (
    prompt: string,
    opts: { format: ScriptFormat; length: ScriptLength; count: number }
  ) => void
  onTogglePreview: (turnId: string, localId: string) => void
  onPushScript: (turnId: string, localId: string) => void
  onDiscardScript: (turnId: string, localId: string) => void
  contextItemCount: number
  onCountReload: () => void
}) {
  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="flex-1 overflow-y-auto px-6 py-4" onClick={onCountReload}>
        {items.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="mx-auto max-w-3xl space-y-5">
            {items.map((it) => (
              <ChatTurn
                key={it.id}
                item={it}
                onTogglePreview={onTogglePreview}
                onPushScript={onPushScript}
                onDiscardScript={onDiscardScript}
              />
            ))}
            {busy ? (
              <div className="flex items-center gap-2 text-caption text-[color:var(--color-muted)]">
                <Loader2 className="h-3 w-3 animate-spin" /> Pulling context, writing scripts...
              </div>
            ) : null}
          </div>
        )}
      </div>

      <ChatInput onSend={onSend} busy={busy} contextItemCount={contextItemCount} />
    </div>
  )
}

function EmptyState() {
  return (
    <div className="mx-auto flex h-full max-w-lg flex-col items-center justify-center px-4 text-center">
      <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[color:var(--color-accent-soft)]">
        <Sparkles className="h-8 w-8 text-[color:var(--color-accent)]" />
      </div>
      <h3 className="aiw-wordmark mb-2 text-h1 text-[color:var(--color-foreground)]">
        What should we make today?
      </h3>
      <p className="text-body text-[color:var(--color-secondary)]">
        Drop context into the buckets on the left, then describe the kind of reel, carousel,
        story, or long-form piece you want. The engine writes 3-5 full scripts at a time —
        push the ones you like into the pipeline, discard the rest.
      </p>
      <p className="mt-4 text-caption text-[color:var(--color-muted)]">
        Try: &ldquo;3 contrarian reels about why my offer beats the alternatives&rdquo; or &ldquo;a 5-section
        long-form video on the framework from my latest book&rdquo;.
      </p>
    </div>
  )
}

function ChatTurn({
  item,
  onTogglePreview,
  onPushScript,
  onDiscardScript,
}: {
  item: ChatItem
  onTogglePreview: (turnId: string, localId: string) => void
  onPushScript: (turnId: string, localId: string) => void
  onDiscardScript: (turnId: string, localId: string) => void
}) {
  if (item.kind === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl bg-[color:var(--color-surface-raised)] px-3 py-2 text-body">
          {item.text}
        </div>
      </div>
    )
  }
  if (item.kind === "error") {
    return (
      <div className="rounded-xl border border-[color:var(--color-danger)]/40 bg-[color:var(--color-danger)]/10 p-3 text-caption text-[color:var(--color-danger)]">
        {item.text}
      </div>
    )
  }
  // Generated turn
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-caption text-[color:var(--color-secondary)]">
        <Badge tone="accent">Engine</Badge>
        <span>
          {item.scripts.length} {item.format}
          {item.scripts.length === 1 ? "" : "s"} ready to push
          {item.mode === "stub" ? " (demo mode)" : ""}
        </span>
      </div>
      <div className="space-y-2">
        {item.scripts.map((s) => (
          <GeneratedScriptCard
            key={s.local_id}
            script={s.data}
            pushed={s.pushed}
            pushing={s.pushing}
            expanded={s.expanded}
            onToggleExpanded={() => onTogglePreview(item.id, s.local_id)}
            onPush={() => onPushScript(item.id, s.local_id)}
            onDiscard={() => onDiscardScript(item.id, s.local_id)}
          />
        ))}
      </div>
    </div>
  )
}
