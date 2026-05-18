"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2, Upload } from "lucide-react"
import { VoiceMemo } from "@/components/ui/VoiceMemo"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input, Label, Textarea } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  BUCKET_BY_SLUG,
  type Bucket,
  type SourceType,
} from "@/lib/content-engine/buckets"

type Tab = "text" | "url" | "file" | "voice"

const URL_TYPES: Record<string, SourceType> = {
  youtube: "youtube_url",
  instagram: "instagram_reel",
  tiktok: "tiktok_url",
  link: "link",
}

function detectUrlType(url: string): SourceType {
  if (/youtube\.com|youtu\.be/.test(url)) return URL_TYPES.youtube
  if (/instagram\.com\/(reel|p)\//.test(url)) return URL_TYPES.instagram
  if (/tiktok\.com/.test(url)) return URL_TYPES.tiktok
  return URL_TYPES.link
}

export function AddItemDialog({
  open,
  onOpenChange,
  bucket,
  onAdded,
}: {
  open: boolean
  onOpenChange: (b: boolean) => void
  bucket: Bucket
  onAdded?: () => void
}) {
  const def = BUCKET_BY_SLUG[bucket]
  const [tab, setTab] = useState<Tab>("text")
  const [title, setTitle] = useState("")
  const [text, setText] = useState("")
  const [url, setUrl] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const accepts = (st: SourceType) => def.accepted.includes(st)

  function reset() {
    setTitle("")
    setText("")
    setUrl("")
    setFile(null)
    setVoiceBlob(null)
    setTab("text")
  }

  async function submitVoice() {
    if (!voiceBlob) return
    setSubmitting(true)
    try {
      const fd = new FormData()
      const ext = voiceBlob.type.includes("mp4") ? "mp4" : "webm"
      fd.append("file", new File([voiceBlob], `voice-memo-${Date.now()}.${ext}`, { type: voiceBlob.type }))
      fd.append("bucket", bucket)
      if (title) fd.append("title", title)
      const res = await fetch("/api/context/upload", { method: "POST", body: fd })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `${res.status}`)
      }
      toast.success("Voice memo uploaded — transcribing in background")
      reset()
      onAdded?.()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to upload")
    } finally {
      setSubmitting(false)
    }
  }

  async function submitText() {
    setSubmitting(true)
    try {
      const res = await fetch("/api/context", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bucket,
          source_type: "text",
          title: title || undefined,
          content: text,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `${res.status}`)
      }
      toast.success("Added to library")
      reset()
      onAdded?.()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add")
    } finally {
      setSubmitting(false)
    }
  }

  async function submitUrl() {
    setSubmitting(true)
    try {
      const sourceType = detectUrlType(url)
      if (!accepts(sourceType)) {
        throw new Error(
          `${sourceType.replace("_", " ")} not accepted in ${def.label}`
        )
      }
      const res = await fetch("/api/context", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          bucket,
          source_type: sourceType,
          url,
          title: title || undefined,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `${res.status}`)
      }
      toast.success("Queued for ingestion")
      reset()
      onAdded?.()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to add")
    } finally {
      setSubmitting(false)
    }
  }

  async function submitFile() {
    if (!file) return
    setSubmitting(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      fd.append("bucket", bucket)
      if (title) fd.append("title", title)
      const res = await fetch("/api/context/upload", { method: "POST", body: fd })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `${res.status}`)
      }
      toast.success("Uploaded and queued")
      reset()
      onAdded?.()
      onOpenChange(false)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to upload")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add to {def.label}</DialogTitle>
          <DialogDescription>{def.description}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-1 rounded-lg border border-[color:var(--color-border)] p-1">
          {(["text", "url", "file", "voice"] as Tab[]).map((t) => {
            const enabled =
              t === "text"
                ? accepts("text")
                : t === "url"
                  ? accepts("youtube_url") || accepts("instagram_reel") || accepts("link") || accepts("tiktok_url")
                  : t === "file"
                    ? accepts("pdf") || accepts("audio_file") || accepts("video_file")
                    : accepts("audio_file") || accepts("video_file")
            return (
              <button
                key={t}
                type="button"
                disabled={!enabled}
                onClick={() => setTab(t)}
                className={`flex-1 rounded-md px-3 py-1 text-xs capitalize transition-colors cursor-pointer ${
                  tab === t
                    ? "bg-[color:var(--color-surface-raised)] text-[color:var(--color-foreground)]"
                    : "text-[color:var(--color-muted)] hover:text-[color:var(--color-foreground)] disabled:opacity-30 disabled:cursor-not-allowed"
                }`}
              >
                {t}
              </button>
            )
          })}
        </div>

        {tab === "text" ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="add-title">Title (optional)</Label>
              <Input
                id="add-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Short label for this note"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-text">Content</Label>
              <Textarea
                id="add-text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                rows={8}
                placeholder="Paste your text, idea, voice sample, or instructions"
              />
            </div>
          </div>
        ) : null}

        {tab === "url" ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="add-url">URL</Label>
              <Input
                id="add-url"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://www.instagram.com/reel/... or YouTube, TikTok, blog"
              />
              <p className="text-[10px] text-[color:var(--color-muted)]">
                We auto-detect Instagram, TikTok, YouTube, or general links.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-url-title">Title (optional)</Label>
              <Input
                id="add-url-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Override title (defaults to URL or scraped value)"
              />
            </div>
          </div>
        ) : null}

        {tab === "file" ? (
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="add-file">File</Label>
              <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-dashed border-[color:var(--color-border)] px-3 py-6 text-xs text-[color:var(--color-muted)] hover:border-[color:var(--color-border-strong)] hover:text-[color:var(--color-foreground)]">
                <Upload className="h-4 w-4" />
                <span>
                  {file
                    ? file.name
                    : "PDF (50MB), audio (MP3/WAV/M4A, 500MB), or video (MP4/MOV, 500MB)"}
                </span>
                <input
                  id="add-file"
                  type="file"
                  accept="application/pdf,.pdf,audio/*,video/*,.mp3,.wav,.m4a,.mp4,.mov,.webm"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </label>
              <p className="text-[10px] text-[color:var(--color-muted)]">
                Audio and video files are transcribed via AssemblyAI when a key is configured.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="add-file-title">Title (optional)</Label>
              <Input
                id="add-file-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Override title"
              />
            </div>
          </div>
        ) : null}

        {tab === "voice" ? (
          <div className="space-y-3">
            <VoiceMemo onRecorded={(blob) => setVoiceBlob(blob)} />
            {voiceBlob ? (
              <div className="space-y-1">
                <Label>Title (optional)</Label>
                <input
                  className="w-full rounded-lg border border-[color:var(--color-border)] bg-transparent px-3 py-2 text-sm outline-none focus:border-[color:var(--color-accent)] placeholder:text-[color:var(--color-muted)]"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Voice memo label"
                />
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            onClick={() => {
              if (tab === "text") submitText()
              else if (tab === "url") submitUrl()
              else if (tab === "voice") submitVoice()
              else submitFile()
            }}
            disabled={
              submitting ||
              (tab === "text" && !text.trim()) ||
              (tab === "url" && !url.trim()) ||
              (tab === "file" && !file) ||
              (tab === "voice" && !voiceBlob)
            }
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {submitting ? "Adding..." : "Add"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// Avoid unused-import in stricter projects
export const _BUCKET_DEFS_USED = !!BUCKET_BY_SLUG
