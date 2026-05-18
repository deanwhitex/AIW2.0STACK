"use client"

import { useState, useRef, useEffect } from "react"
import { Send, Loader2, Mic, Square } from "lucide-react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { useVoiceRecorder, formatDuration } from "@/hooks/useVoiceRecorder"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { ScriptFormat, ScriptLength } from "@/lib/ai/types"

const SAMPLE_PROMPTS = [
  "5 reels about why most agency websites don't convert",
  "3 contrarian takes on the AI agency model",
  "A story-based reel about my journey from $0 to consistent leads",
]

export function ChatInput({
  onSend,
  busy,
  contextItemCount,
}: {
  onSend: (prompt: string, opts: { format: ScriptFormat; length: ScriptLength; count: number }) => void
  busy: boolean
  contextItemCount: number
}) {
  const [value, setValue] = useState("")
  // Generation always produces 3-5 full scripts per round. Less than 3 isn't
  // worth the round-trip; more than 5 dilutes attention and burns tokens.
  const [count, setCount] = useState(3)
  const [format, setFormat] = useState<ScriptFormat>("reel")
  const [length, setLength] = useState<ScriptLength>("medium")
  const [transcribing, setTranscribing] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)
  const { state: recState, audioBlob, duration, start: startRec, stop: stopRec, reset: resetRec } = useVoiceRecorder()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${Math.min(el.scrollHeight, 200)}px`
  }, [value])

  function submit() {
    const trimmed = value.trim()
    if (!trimmed || busy) return
    onSend(trimmed, { format, length, count })
    setValue("")
  }

  useEffect(() => {
    if (recState === "stopped" && audioBlob) {
      void (async () => {
        setTranscribing(true)
        try {
          const fd = new FormData()
          const ext = audioBlob.type.includes("mp4") ? "mp4" : "webm"
          fd.append("audio", new File([audioBlob], `voice.${ext}`, { type: audioBlob.type }))
          const res = await fetch("/api/transcribe", { method: "POST", body: fd })
          if (!res.ok) {
            const body = await res.json().catch(() => ({}))
            throw new Error(body.error ?? "Transcription failed")
          }
          const { text } = await res.json()
          setValue((prev) => (prev.trim() ? prev + " " + text : text))
          ref.current?.focus()
        } catch (e) {
          toast.error(e instanceof Error ? e.message : "Transcription failed")
        } finally {
          setTranscribing(false)
          resetRec()
        }
      })()
    }
  }, [recState, audioBlob, resetRec])

  return (
    <div className="border-t border-[color:var(--color-border)] bg-[color:var(--color-background)] px-4 py-3">
      {value.trim().length === 0 && contextItemCount === 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {SAMPLE_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => setValue(p)}
              className="rounded-full border border-[color:var(--color-border)] px-3 py-1 text-[11px] text-[color:var(--color-muted)] transition-colors hover:border-[color:var(--color-accent)]/40 hover:text-[color:var(--color-foreground)]"
            >
              {p}
            </button>
          ))}
        </div>
      ) : null}

      <div className={`flex items-end gap-2 rounded-2xl border bg-[color:var(--color-surface)] p-2 transition-colors ${recState === "recording" ? "border-[color:var(--color-danger)]/50" : "border-[color:var(--color-border)]"}`}>
        {recState === "recording" ? (
          <div className="flex flex-1 items-center gap-2 px-2 py-1">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[color:var(--color-danger)]" />
            <span className="font-mono text-sm tabular-nums text-[color:var(--color-danger)]">
              {formatDuration(duration)}
            </span>
            <span className="text-xs text-[color:var(--color-muted)]">Recording — tap stop when done</span>
          </div>
        ) : (
          <textarea
            ref={ref}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                submit()
              }
            }}
            rows={1}
            placeholder={transcribing ? "Transcribing..." : "What should I make today? (Cmd+Enter to send)"}
            disabled={transcribing}
            className="flex-1 resize-none bg-transparent px-2 py-1 text-sm text-[color:var(--color-foreground)] outline-none placeholder:text-[color:var(--color-muted)] disabled:opacity-60"
          />
        )}
        <div className="flex shrink-0 items-center gap-1.5">
          <Select value={format} onValueChange={(v) => setFormat(v as ScriptFormat)}>
            <SelectTrigger className="h-8 w-28 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="reel">Reel</SelectItem>
              <SelectItem value="carousel">Carousel</SelectItem>
              <SelectItem value="story_sequence">Story sequence</SelectItem>
              <SelectItem value="long_form">Long-form</SelectItem>
            </SelectContent>
          </Select>
          {format === "reel" ? (
            <Select value={length} onValueChange={(v) => setLength(v as ScriptLength)}>
              <SelectTrigger className="h-8 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="short">Short · 15-25s</SelectItem>
                <SelectItem value="medium">Medium · 30-45s</SelectItem>
                <SelectItem value="long">Long · 60-90s</SelectItem>
              </SelectContent>
            </Select>
          ) : null}
          <Select value={String(count)} onValueChange={(v) => setCount(Number(v))}>
            <SelectTrigger className="h-8 w-16 text-xs" aria-label="Number of scripts">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[3, 4, 5].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            variant={recState === "recording" ? "danger" : "ghost"}
            size="icon"
            onClick={recState === "recording" ? stopRec : startRec}
            disabled={busy || transcribing}
            title={recState === "recording" ? "Stop recording" : "Voice input"}
          >
            {transcribing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : recState === "recording" ? (
              <Square className="h-4 w-4 fill-current" />
            ) : (
              <Mic className="h-4 w-4" />
            )}
          </Button>
          <Button onClick={submit} disabled={busy || transcribing || value.trim().length === 0} size="icon">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      <p className="mt-2 text-[10px] text-[color:var(--color-muted)]">
        {contextItemCount} context items will inform this generation. The engine will brainstorm hooks first — pick the ones you like to expand into full scripts.
      </p>
    </div>
  )
}
