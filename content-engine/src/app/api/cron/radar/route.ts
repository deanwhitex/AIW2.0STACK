import { NextRequest, NextResponse } from "next/server"
import { runRadarScan } from "@/lib/radar/run"

export const maxDuration = 300

function authorised(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return true // dev convenience: no secret = open
  // Vercel Cron sends Authorization: Bearer <CRON_SECRET>
  const auth = req.headers.get("authorization")
  if (auth === `Bearer ${expected}`) return true
  // Fall-back: query param ?secret= for manual triggers
  const q = req.nextUrl.searchParams.get("secret")
  return q === expected
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const result = await runRadarScan()
  return NextResponse.json({ ok: true, ...result })
}

export async function POST(req: NextRequest) {
  return GET(req)
}
