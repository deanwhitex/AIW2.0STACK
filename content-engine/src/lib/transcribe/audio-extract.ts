/**
 * Audio extraction helper. Some Apify-scraped video URLs (Instagram in
 * particular) come back as MP4 files where AssemblyAI cannot find the
 * audio stream -- typically because the video and audio tracks are
 * served as separate streams or the muxer wrote unusual atom ordering.
 * AssemblyAI returns "No audio stream found in the file."
 *
 * Fix: download the video, run it through ffmpeg to extract a clean
 * audio file, upload that to AssemblyAI's upload endpoint, and submit
 * transcription using the resulting upload URL.
 *
 * Uses ffmpeg-static which ships a precompiled binary at install time.
 * Vercel deploys the binary along with the function bundle.
 */

import { spawn } from "node:child_process"
import { writeFile, readFile, unlink } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomUUID } from "node:crypto"
import { AssemblyAI } from "assemblyai"
import { getSecret } from "@/lib/supabase/secrets"
import ffmpegPath from "ffmpeg-static"

const FFMPEG_TIMEOUT_MS = 90_000 // hard cap so a runaway extract cannot hang the function

/**
 * Download `videoUrl`, extract the audio track to MP3, upload it to
 * AssemblyAI, and return the upload URL ready to pass into a transcript
 * submission.
 *
 * Caller is responsible for handling errors -- if extraction fails for
 * any reason we throw, and the caller can either fall back to direct
 * URL submission or mark the item failed.
 */
export async function extractAudioAndUpload(videoUrl: string): Promise<string> {
  const apiKey = await getSecret("assemblyai_api_key")
  if (!apiKey) throw new Error("AssemblyAI key not configured")
  if (!ffmpegPath) throw new Error("ffmpeg-static binary not available in this environment")

  console.log(`[audio-extract] start url-len=${videoUrl.length} ffmpeg-path=${ffmpegPath}`)

  const id = randomUUID()
  const inputPath = join(tmpdir(), `${id}.mp4`)
  const outputPath = join(tmpdir(), `${id}.mp3`)

  try {
    // 1. Download video to /tmp
    const res = await fetch(videoUrl)
    if (!res.ok) {
      throw new Error(`Failed to download video: HTTP ${res.status}`)
    }
    const arrayBuffer = await res.arrayBuffer()
    await writeFile(inputPath, Buffer.from(arrayBuffer))
    console.log(`[audio-extract] downloaded ${arrayBuffer.byteLength} bytes to ${inputPath}`)

    // 2. Extract audio to MP3 with ffmpeg
    await runFfmpeg(ffmpegPath, [
      "-y", // overwrite output
      "-i", inputPath,
      "-vn", // skip video
      "-acodec", "libmp3lame",
      "-ar", "16000", // 16kHz is plenty for speech, smaller upload
      "-ac", "1", // mono
      "-b:a", "64k",
      outputPath,
    ])

    const audioBuffer = await readFile(outputPath)
    console.log(`[audio-extract] ffmpeg produced ${audioBuffer.byteLength} bytes of MP3`)
    if (audioBuffer.byteLength < 1024) {
      throw new Error("Extracted audio file is too small -- likely no audio track")
    }

    // 3. Upload to AssemblyAI
    const client = new AssemblyAI({ apiKey })
    const uploadUrl = await client.files.upload(audioBuffer)
    if (!uploadUrl) throw new Error("AssemblyAI upload returned no URL")
    console.log(`[audio-extract] uploaded to AssemblyAI: ${uploadUrl}`)
    return uploadUrl
  } finally {
    // Best-effort cleanup
    void unlink(inputPath).catch(() => {})
    void unlink(outputPath).catch(() => {})
  }
}

function runFfmpeg(bin: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(bin, args, { stdio: ["ignore", "pipe", "pipe"] })
    let stderr = ""
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString()
    })
    const timer = setTimeout(() => {
      proc.kill("SIGKILL")
      reject(new Error("ffmpeg timed out"))
    }, FFMPEG_TIMEOUT_MS)
    proc.on("error", (err) => {
      clearTimeout(timer)
      reject(err)
    })
    proc.on("close", (code) => {
      clearTimeout(timer)
      if (code === 0) resolve()
      else reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`))
    })
  })
}
