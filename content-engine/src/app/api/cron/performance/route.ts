import { NextRequest, NextResponse } from "next/server"
import { pullDuePosts } from "@/lib/performance/run"

export const maxDuration = 300

function authorised(req: NextRequest): boolean {
  const expected = process.env.CRON_SECRET
  if (!expected) return true
  const auth = req.headers.get("authorization")
  if (auth === `Bearer ${expected}`) return true
  const q = req.nextUrl.searchParams.get("secret")
  return q === expected
}

export async function GET(req: NextRequest) {
  if (!authorised(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }
  const result = await pullDuePosts(50)
  return NextResponse.json({ ok: true, ...result })
}

export async function POST(req: NextRequest) {
  return GET(req)
}
