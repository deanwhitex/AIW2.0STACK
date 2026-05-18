import { NextRequest, NextResponse } from "next/server"
import { spawn } from "node:child_process"
import { existsSync, statSync } from "node:fs"
import { createServerSupabase } from "@/lib/supabase/server"
import ffmpegPath from "ffmpeg-static"

export const maxDuration = 30

/**
 * Smoke-test the bundled ffmpeg-static binary. Returns whether the
 * resolved path exists, its size, and the output of `ffmpeg -version`.
 * If any of these come back wrong, audio extraction is dead in the
 * water and we know to swap strategies.
 */
export async function GET(_req: NextRequest) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })

  const path = ffmpegPath ?? null
  let pathExists = false
  let pathSize: number | null = null

  if (path) {
    try {
      pathExists = existsSync(path)
      if (pathExists) pathSize = statSync(path).size
    } catch {
      // ignore
    }
  }

  let versionOutput = ""
  let spawnError: string | null = null
  let exitCode: number | null = null

  if (path && pathExists) {
    try {
      await new Promise<void>((resolve) => {
        const proc = spawn(path, ["-version"])
        proc.stdout.on("data", (chunk) => {
          versionOutput += chunk.toString()
        })
        proc.stderr.on("data", (chunk) => {
          versionOutput += chunk.toString()
        })
        proc.on("error", (err) => {
          spawnError = err.message
          resolve()
        })
        proc.on("close", (code) => {
          exitCode = code
          resolve()
        })
        setTimeout(() => {
          proc.kill("SIGKILL")
          resolve()
        }, 8000)
      })
    } catch (e) {
      spawnError = e instanceof Error ? e.message : String(e)
    }
  }

  return NextResponse.json({
    ffmpeg_path: path,
    path_exists: pathExists,
    path_size: pathSize,
    spawn_error: spawnError,
    exit_code: exitCode,
    version_output: versionOutput.slice(0, 600),
    cwd: process.cwd(),
    platform: process.platform,
    arch: process.arch,
  })
}
