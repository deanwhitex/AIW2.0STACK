import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "100mb",
    },
  },
  // ffmpeg-static ships a precompiled native binary. Tell Next.js to
  // treat the package as external so it is preserved as-is in
  // node_modules during the build. Without this the bundler tree-
  // shakes the binary out and audio extraction fails on Vercel.
  serverExternalPackages: ["ffmpeg-static"],
  // Belt-and-braces: also include the binary explicitly via the file
  // tracer for every route that may call it. Both keys (with and
  // without /route suffix) are listed because Next.js has shifted
  // conventions across versions.
  outputFileTracingIncludes: {
    "/api/webhooks/apify": ["./node_modules/ffmpeg-static/**/*"],
    "/api/webhooks/assemblyai": ["./node_modules/ffmpeg-static/**/*"],
    "/api/context/[id]/reprocess": ["./node_modules/ffmpeg-static/**/*"],
    "/api/cron/recover-stuck": ["./node_modules/ffmpeg-static/**/*"],
    "/api/radar/signals/[id]/action": ["./node_modules/ffmpeg-static/**/*"],
    "/api/cron/radar": ["./node_modules/ffmpeg-static/**/*"],
    "/api/debug/test-ffmpeg": ["./node_modules/ffmpeg-static/**/*"],
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.cdninstagram.com" },
      { protocol: "https", hostname: "**.fbcdn.net" },
      { protocol: "https", hostname: "**.tiktokcdn.com" },
      { protocol: "https", hostname: "i.ytimg.com" },
      { protocol: "https", hostname: "**.supabase.co" },
    ],
  },
}

export default nextConfig
