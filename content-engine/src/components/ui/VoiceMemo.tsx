"use client"

import { Mic, Square, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useVoiceRecorder, formatDuration } from "@/hooks/useVoiceRecorder"

export function VoiceMemo({
  onRecorded,
}: {
  onRecorded: (blob: Blob) => void
}) {
  const { state, audioBlob, duration, start, stop, reset } = useVoiceRecorder()

  function confirm() {
    if (audioBlob) onRecorded(audioBlob)
    reset()
  }

  return (
    <div className="flex flex-col items-center gap-4 py-4">
      {state === "idle" || state === "requesting" ? (
        <>
          <button
            type="button"
            onClick={start}
            disabled={state === "requesting"}
            className="flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--color-surface-raised)] text-[color:var(--color-muted)] transition-all hover:bg-[color:var(--color-accent)]/10 hover:text-[color:var(--color-accent)] active:scale-95 disabled:opacity-50"
          >
            <Mic className="h-7 w-7" />
          </button>
          <p className="text-xs text-[color:var(--color-muted)]">
            {state === "requesting" ? "Waiting for microphone..." : "Tap to record"}
          </p>
        </>
      ) : null}

      {state === "recording" ? (
        <>
          <button
            type="button"
            onClick={stop}
            className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[color:var(--color-danger)]/10 text-[color:var(--color-danger)] active:scale-95"
          >
            <span className="absolute inset-0 animate-ping rounded-full bg-[color:var(--color-danger)]/20" />
            <Square className="relative h-6 w-6 fill-current" />
          </button>
          <p className="font-mono text-sm tabular-nums text-[color:var(--color-danger)]">
            {formatDuration(duration)}
          </p>
          <p className="text-xs text-[color:var(--color-muted)]">Recording — tap to stop</p>
        </>
      ) : null}

      {state === "stopped" && audioBlob ? (
        <div className="w-full space-y-3">
          <audio
            controls
            src={URL.createObjectURL(audioBlob)}
            className="w-full rounded-lg"
          />
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={reset} className="gap-1">
              <RotateCcw className="h-3.5 w-3.5" /> Redo
            </Button>
            <Button size="sm" onClick={confirm} className="flex-1">
              Use this recording
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
