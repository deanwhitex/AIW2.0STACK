"use client"

import Link from "next/link"
import Image from "next/image"
import { usePathname } from "next/navigation"
import {
  Settings as SettingsIcon,
  Menu,
  MessageSquare,
  Kanban,
  Radar,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export type ViewMode = "chat" | "pipeline" | "radar"

export function TopBar({
  userEmail,
  onToggleSidebar,
  view,
  onViewChange,
}: {
  userEmail?: string | null
  onToggleSidebar?: () => void
  view?: ViewMode
  onViewChange?: (v: ViewMode) => void
}) {
  const pathname = usePathname()
  const isWorkspace = pathname === "/"
  return (
    <div className="flex items-center justify-between border-b border-[color:var(--color-border)] bg-[color:var(--color-background)] px-4 py-2">
      <div className="flex items-center gap-3 sm:gap-4">
        {onToggleSidebar ? (
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleSidebar}
            aria-label="Toggle library"
            className="lg:hidden"
          >
            <Menu className="h-4 w-4" />
          </Button>
        ) : null}
        <Link href="/" className="flex items-center gap-2.5" aria-label="AIW Content Engine home">
          <Image
            src="/aiw-sparkle.png"
            alt="AIW"
            width={56}
            height={56}
            priority
            className="shrink-0"
          />
          <span className="text-h2 font-bold italic uppercase tracking-wider text-[color:var(--color-foreground)]">
            Content Engine
          </span>
        </Link>

        {/* View switcher — only meaningful on the workspace route */}
        {isWorkspace && view && onViewChange ? (
          <nav className="hidden items-center gap-0.5 rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-0.5 sm:flex">
            <ViewTab
              icon={<MessageSquare className="h-3.5 w-3.5" />}
              label="Workspace"
              active={view === "chat"}
              onClick={() => onViewChange("chat")}
            />
            <ViewTab
              icon={<Kanban className="h-3.5 w-3.5" />}
              label="Pipeline"
              active={view === "pipeline"}
              onClick={() => onViewChange("pipeline")}
            />
            <ViewTab
              icon={<Radar className="h-3.5 w-3.5" />}
              label="Radar"
              active={view === "radar"}
              onClick={() => onViewChange("radar")}
            />
          </nav>
        ) : null}
      </div>

      <div className="flex items-center gap-2">
        <NavLink href="/dashboard" label="Dashboard" active={pathname === "/dashboard"} />
        {userEmail ? (
          <span className="hidden text-caption text-[color:var(--color-muted)] md:inline">
            {userEmail}
          </span>
        ) : null}
        <Button asChild variant="ghost" size="icon">
          <Link href="/settings" aria-label="Settings">
            <SettingsIcon className="h-4 w-4" />
          </Link>
        </Button>
        <form action="/api/auth/signout" method="post">
          <Button variant="outline" size="sm" type="submit">
            Sign out
          </Button>
        </form>
      </div>
    </div>
  )
}

function ViewTab({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "flex items-center gap-1.5 rounded-md px-2.5 py-1 text-label transition-colors",
        active
          ? "bg-[color:var(--color-background)] text-[color:var(--color-foreground)] shadow-sm"
          : "text-[color:var(--color-secondary)] hover:text-[color:var(--color-foreground)]"
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function NavLink({
  href,
  label,
  active,
}: {
  href: string
  label: string
  active?: boolean
}) {
  return (
    <Link
      href={href}
      className={cn(
        "rounded-md px-2.5 py-1 text-label transition-colors",
        active
          ? "bg-[color:var(--color-surface)] text-[color:var(--color-foreground)]"
          : "text-[color:var(--color-secondary)] hover:bg-[color:var(--color-surface)] hover:text-[color:var(--color-foreground)]"
      )}
    >
      {label}
    </Link>
  )
}
