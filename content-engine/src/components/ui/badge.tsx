import * as React from "react"
import { cn } from "@/lib/utils"

type Tone = "neutral" | "accent" | "success" | "warning" | "danger" | "info"

const TONE_CLASSES: Record<Tone, string> = {
  neutral:
    "bg-[color:var(--color-surface-raised)] text-[color:var(--color-secondary)]",
  accent: "bg-[color:var(--color-accent-soft)] text-[color:var(--color-accent)]",
  success: "bg-[color:var(--color-success)]/10 text-[color:var(--color-success)]",
  warning: "bg-[color:var(--color-warning)]/10 text-[color:var(--color-warning)]",
  danger: "bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)]",
  info: "bg-blue-500/10 text-blue-300",
}

export function Badge({
  tone = "neutral",
  className,
  ...props
}: { tone?: Tone } & React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium",
        TONE_CLASSES[tone],
        className
      )}
      {...props}
    />
  )
}
