"use client"

import { cn } from "@/lib/utils"

const STAGES = [
  { value: "idea", label: "Idea", color: "var(--color-muted)" },
  { value: "approved", label: "Approved", color: "var(--color-info, #60A5FA)" },
  { value: "shot", label: "Shot", color: "var(--color-warning)" },
  { value: "edited", label: "Edited", color: "#A855F7" },
  { value: "posted", label: "Posted", color: "var(--color-success)" },
] as const

type Stage = (typeof STAGES)[number]["value"]

export function StatusPipeline({
  status,
  onChange,
  compact = false,
}: {
  status: Stage
  onChange: (s: Stage) => void
  compact?: boolean
}) {
  const currentIdx = STAGES.findIndex((s) => s.value === status)

  return (
    <div className={cn("flex items-center gap-0.5", compact ? "" : "")}>
      {STAGES.map((stage, i) => {
        const reached = i <= currentIdx
        const isCurrent = i === currentIdx
        return (
          <button
            key={stage.value}
            type="button"
            onClick={() => onChange(stage.value)}
            title={stage.label}
            className={cn(
              "h-2 rounded-full transition-all",
              isCurrent ? "w-5" : "w-2",
              reached ? "" : "opacity-30"
            )}
            style={{ background: reached ? stage.color : "var(--color-border)" }}
          />
        )
      })}
    </div>
  )
}

export { STAGES, type Stage }
