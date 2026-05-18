"use client"

import { useMemo } from "react"
import { X, Expand, GripVertical, Trash2 } from "lucide-react"
import {
  DndContext,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core"
import { useDraggable } from "@dnd-kit/core"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { STAGES, type Stage } from "./StatusPipeline"
import type { ScriptRow } from "./ScriptCard"

const COLUMN_DEFS: Record<Stage, { tone: string; subtitle: string }> = {
  idea: { tone: "border-zinc-700 bg-zinc-800/30", subtitle: "Brainstormed, not yet greenlit" },
  approved: { tone: "border-blue-500/30 bg-blue-500/5", subtitle: "Greenlit for production" },
  shot: { tone: "border-orange-500/30 bg-orange-500/5", subtitle: "Footage captured" },
  edited: { tone: "border-purple-500/30 bg-purple-500/5", subtitle: "Cut and ready to post" },
  posted: { tone: "border-emerald-500/30 bg-emerald-500/5", subtitle: "Published, gathering feedback" },
}

export function PipelineKanban({
  open,
  onClose,
  cards,
  onExpand,
  onStatusChange,
  onDelete,
  inline = false,
}: {
  open: boolean
  onClose: () => void
  cards: ScriptRow[]
  onExpand: (c: ScriptRow) => void
  onStatusChange: (id: string, status: Stage) => void
  onDelete?: (id: string) => void
  inline?: boolean
}) {
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))
  const grouped = useMemo(() => {
    const out: Record<Stage, ScriptRow[]> = {
      idea: [],
      approved: [],
      shot: [],
      edited: [],
      posted: [],
    }
    for (const c of cards) {
      if ((STAGES as readonly { value: Stage }[]).some((s) => s.value === c.status)) {
        out[c.status as Stage].push(c)
      }
    }
    return out
  }, [cards])

  function handleDragEnd(e: DragEndEvent) {
    const cardId = e.active.id as string
    const targetStage = e.over?.id as Stage | undefined
    if (!targetStage) return
    const card = cards.find((c) => c.id === cardId)
    if (!card || card.status === targetStage) return
    onStatusChange(cardId, targetStage)
  }

  const inner = (
    <>
      <header className="flex items-center justify-between border-b border-[color:var(--color-border)] px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="hidden h-1 w-10 rounded-full bg-[color:var(--color-border-strong)] sm:block" />
          <div>
            <h2 className="aiw-wordmark text-h2 text-[color:var(--color-foreground)]">
              Content Pipeline
            </h2>
            <p className="text-caption text-[color:var(--color-secondary)]">
              {cards.length} scripts · drag between columns to change status
            </p>
          </div>
        </div>
        {!inline ? (
          <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close pipeline">
            <X className="h-4 w-4" />
          </Button>
        ) : null}
      </header>

      <DndContext sensors={sensors} collisionDetection={closestCorners} onDragEnd={handleDragEnd}>
        <div className="flex flex-1 gap-4 overflow-x-auto px-5 py-4">
          {STAGES.map((stage) => (
            <Column
              key={stage.value}
              stage={stage.value}
              label={stage.label}
              cards={grouped[stage.value]}
              onExpand={onExpand}
              onDelete={onDelete}
            />
          ))}
        </div>
      </DndContext>
    </>
  )

  if (inline) {
    return <div className="flex h-full flex-1 flex-col overflow-hidden">{inner}</div>
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-40 bg-black/30 data-[state=open]:animate-in data-[state=open]:fade-in" />
        <DialogPrimitive.Content
          className="fixed inset-x-0 bottom-0 z-50 flex max-h-[78vh] flex-col rounded-t-2xl border border-[color:var(--color-border)] border-b-0 bg-[color:var(--color-background)] shadow-2xl outline-none focus-visible:outline-none data-[state=open]:animate-in data-[state=open]:slide-in-from-bottom"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Content Pipeline</DialogPrimitive.Title>
          {inner}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}

function Column({
  stage,
  label,
  cards,
  onExpand,
  onDelete,
}: {
  stage: Stage
  label: string
  cards: ScriptRow[]
  onExpand: (c: ScriptRow) => void
  onDelete?: (id: string) => void
}) {
  const { setNodeRef, isOver } = useDroppable({ id: stage })
  const def = COLUMN_DEFS[stage]
  return (
    <div className="flex w-72 shrink-0 flex-col">
      <div className={`mb-3 rounded-lg border px-3 py-2.5 ${def.tone}`}>
        <div className="flex items-center justify-between">
          <span className="text-label font-semibold text-[color:var(--color-foreground)]">
            {label}
          </span>
          <span className="rounded-full bg-[color:var(--color-surface)] px-1.5 py-0.5 text-caption font-bold text-[color:var(--color-secondary)]">
            {cards.length}
          </span>
        </div>
        <p className="mt-0.5 text-caption text-[color:var(--color-muted)]">{def.subtitle}</p>
      </div>
      <div
        ref={setNodeRef}
        className={`flex-1 space-y-2 overflow-y-auto rounded-lg p-1 transition-shadow ${
          isOver ? "ring-2 ring-[color:var(--color-accent)]/40" : ""
        }`}
      >
        {cards.map((c) => (
          <KanbanCard key={c.id} card={c} onExpand={onExpand} onDelete={onDelete} />
        ))}
        {cards.length === 0 ? (
          <div className="rounded-lg border border-dashed border-[color:var(--color-border)] py-8 text-center text-caption text-[color:var(--color-muted)]">
            No scripts
          </div>
        ) : null}
      </div>
    </div>
  )
}

function KanbanCard({
  card,
  onExpand,
  onDelete,
}: {
  card: ScriptRow
  onExpand: (c: ScriptRow) => void
  onDelete?: (id: string) => void
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: card.id })
  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined
  const isUnexpanded = !((card.body ?? "").trim())
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-3 transition-colors hover:border-[color:var(--color-border-strong)] ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <div className="mb-1 flex items-center gap-1.5">
        <button
          {...listeners}
          {...attributes}
          aria-label="Drag card"
          className="-ml-1 cursor-grab rounded p-1 text-[color:var(--color-muted)] hover:text-[color:var(--color-foreground)]"
        >
          <GripVertical className="h-3 w-3" />
        </button>
        <Badge tone="accent" className="text-caption">
          {card.format}
        </Badge>
        {isUnexpanded ? (
          <Badge tone="warning" className="text-caption">Hook only</Badge>
        ) : null}
        {card.topic ? (
          <Badge tone="neutral" className="truncate text-caption">
            {card.topic}
          </Badge>
        ) : null}
      </div>
      {/* Title falls back through hook -> title -> topic -> "(no hook)" so
          saved carousel/story ideas (which only carry topic + angle) still
          show meaningful text instead of "(no hook)". */}
      <p className="line-clamp-2 text-label text-[color:var(--color-foreground)]">
        {card.hook ?? card.title ?? card.topic ?? "(no hook)"}
      </p>
      <div className="mt-2 flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
        {onDelete ? (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={(e) => {
              e.stopPropagation()
              if (confirm("Archive this script?")) onDelete(card.id)
            }}
            aria-label="Archive script"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        ) : null}
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-caption"
          onClick={(e) => {
            e.stopPropagation()
            onExpand(card)
          }}
          aria-label="Open card in inspector"
        >
          <Expand className="h-3 w-3" />
          Open
        </Button>
      </div>
    </div>
  )
}
