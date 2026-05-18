import type { Metadata } from "next"
import { Toaster } from "@/components/ui/toaster"
import "./globals.css"

export const metadata: Metadata = {
  title: "AIW Content Engine",
  description:
    "Reels, carousels, stories, and long-form scripts written in your voice — anchored to your business, frameworks, and feedback.",
  icons: {
    icon: [
      { url: "/aiw-logo.png", type: "image/png" },
    ],
    shortcut: "/aiw-logo.png",
    apple: "/aiw-logo.png",
  },
  openGraph: {
    title: "AIW Content Engine",
    description: "Original scripts in your voice, every time.",
    images: ["/aiw-logo.png"],
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "AIW Content Engine",
    description: "Original scripts in your voice, every time.",
    images: ["/aiw-logo.png"],
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className="min-h-screen bg-background text-foreground antialiased"
        suppressHydrationWarning
      >
        {children}
        <Toaster />
      </body>
    </html>
  )
}
