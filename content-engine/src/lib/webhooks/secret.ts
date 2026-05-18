import type { NextRequest } from "next/server"

/**
 * Append the shared WEBHOOK_SECRET as a query param when constructing a
 * webhook callback URL we hand to a third party (AssemblyAI, Apify). Both
 * services echo the URL exactly when calling back, so the param survives.
 *
 * No-op when WEBHOOK_SECRET is unset, so existing flows keep working until
 * the user generates one. Once set, every callback must present it.
 */
export function withWebhookSecret(url: string): string {
  const secret = process.env.WEBHOOK_SECRET
  if (!secret) return url
  const sep = url.includes("?") ? "&" : "?"
  return `${url}${sep}secret=${encodeURIComponent(secret)}`
}

/**
 * Verify an incoming webhook request carries the expected secret.
 * Returns true when WEBHOOK_SECRET is unset (accept-all mode for first
 * deploys) and logs a warning so the gap is visible.
 */
export function isWebhookAuthorized(req: NextRequest): boolean {
  const expected = process.env.WEBHOOK_SECRET
  if (!expected) {
    console.warn(
      "[webhooks] WEBHOOK_SECRET not set; accepting unverified callbacks. " +
      "Generate one with `openssl rand -hex 32` and set it in env to enforce."
    )
    return true
  }
  const provided = req.nextUrl.searchParams.get("secret")
  return provided === expected
}
