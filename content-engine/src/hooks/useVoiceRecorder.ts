"use client"

import { useState, useRef, useCallback } from "react"

export type RecorderState = "idle" | "requesting" | "recording" | "stopped"

export function useVoiceRecorder() {
  const [state, setState] = useState<RecorderState>("idle")
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null)
  const [duration, setDuration] = useState(0)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const start = useCallback(async () => {
    setState("requesting")
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = MediaRecorder.isTypeSupported("audio/webm")
        ? "audio/webm"
        : "audio/mp4"
      const mr = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mr
      chunksRef.current = []
      setAudioBlob(null)
      setDuration(0)

      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType })
        setAudioBlob(blob)
        stream.getTracks().forEach((t) => t.stop())
        if (timerRef.current) clearInterval(timerRef.current)
      }

      mr.start(250)
      setState("recording")
      timerRef.current = setInterval(() => setDuration((d) => d + 1), 1000)
    } catch {
      setState("idle")
    }
  }, [])

  const stop = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current)
    mediaRecorderRef.current?.stop()
    setState("stopped")
  }, [])

  const reset = useCallback(() => {
    setAudioBlob(null)
    setDuration(0)
    setState("idle")
  }, [])

  return { state, audioBlob, duration, start, stop, reset }
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, "0")}`
}
