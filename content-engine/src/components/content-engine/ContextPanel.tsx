"use client"

import { useEffect, useState, useCallback } from "react"
import { Plus, X } from "lucide-react"
import { BUCKET_DEFS, type Bucket } from "@/lib/content-engine/buckets"
import { BUCKET_ICONS, BUCKET_COLOR_VAR, BUCKET_SOFT_VAR } from "./icons"
import { AddItemDialog } from "./AddItemDialog"
import { BucketView } from "./BucketView"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ContextPanel({
  mobileOpen = false,
  onMobileClose,
}: {
  mobileOpen?: boolean
  onMobileClose?: () => void
}) {
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [addBucket, setAddBucket] = useState<Bucket>("video_ideas")
  const [viewBucket, setViewBucket] = useState<Bucket | null>(null)

  const reload = useCallback(async () => {
    try {
      const res = await fetch("/api/context")
      const json = await res.json()
      setCounts(json.counts ?? {})
    } catch {
      // ignore — surface only on user-initiated actions
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    reload()
  }, [reload])

  const total = Object.values(counts).reduce((a, b) => a + b, 0)

  return (
    <>
      {/* Mobile backdrop — shown only when mobileOpen below the lg breakpoint. */}
      {mobileOpen ? (
        <button
          type="button"
          onClick={onMobileClose}
          aria-label="Close library"
          className="fixed inset-0 z-30 bg-black/40 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          "z-40 flex h-full w-72 shrink-0 flex-col border-r border-[color:var(--color-border)] bg-[color:var(--color-background)] transition-transform duration-200 ease-out",
          // Desktop: always visible, in-flow.
          "lg:static lg:translate-x-0",
          // Mobile / tablet: fixed overlay that slides in from the left.
          "fixed inset-y-0 left-0",
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        )}
      >
        <div className="flex items-center justify-between border-b border-[color:var(--color-border)] px-4 py-3">
          <div>
            <h2 className="text-label font-semibold text-[color:var(--color-foreground)]">
              Context Library
            </h2>
            <p className="text-caption text-[color:var(--color-muted)]">
              {loading ? "Loading…" : `${total} items across 7 buckets`}
            </p>
          </div>
          {onMobileClose ? (
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={onMobileClose}
              aria-label="Close library"
            >
              <X className="h-4 w-4" />
            </Button>
          ) : null}
        </div>

        <div className="flex-1 space-y-1 overflow-y-auto p-2">
          {BUCKET_DEFS.map((b) => {
            const Icon = BUCKET_ICONS[b.slug]
            const colorVar = BUCKET_COLOR_VAR[b.slug]
            const softVar = BUCKET_SOFT_VAR[b.slug]
            const count = counts[b.slug] ?? 0
            return (
              <div
                key={b.slug}
                className="group rounded-lg p-2 transition-colors hover:bg-[color:var(--color-surface)]"
              >
                <button
                  type="button"
                  onClick={() => {
                    setViewBucket(b.slug)
                    onMobileClose?.()
                  }}
                  className="flex w-full items-center gap-2.5 text-left"
                >
                  <div
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
                    style={{ background: `var(${softVar})` }}
                  >
                    <Icon
                      className="h-4 w-4"
                      style={{ color: `var(${colorVar})` }}
                    />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-label font-medium text-[color:var(--color-foreground)]">
                        {b.label}
                      </span>
                      <span className="shrink-0 rounded-full bg-[color:var(--color-surface-raised)] px-1.5 py-0.5 text-caption font-medium text-[color:var(--color-secondary)]">
                        {count}
                      </span>
                    </div>
                    <p className="truncate text-caption text-[color:var(--color-muted)]">
                      {b.description}
                    </p>
                  </div>
                </button>
                <div className="mt-1 flex justify-end opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-caption"
                    onClick={() => {
                      setAddBucket(b.slug)
                      setAddOpen(true)
                    }}
                    aria-label={`Add to ${b.label}`}
                  >
                    <Plus className="h-3 w-3" />
                    Add
                  </Button>
                </div>
              </div>
            )
          })}
        </div>

        <AddItemDialog
          open={addOpen}
          onOpenChange={setAddOpen}
          bucket={addBucket}
          onAdded={reload}
        />
        <BucketView
          bucket={viewBucket}
          onClose={() => setViewBucket(null)}
          onAdd={() => {
            if (viewBucket) {
              setAddBucket(viewBucket)
              setAddOpen(true)
            }
          }}
          onDeleted={reload}
        />
      </aside>
    </>
  )
}
