"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { LogOut, Plus, Search, LayoutDashboard, Upload, Users, Settings, ScanLine, Code, Menu, X, Network, Sparkles, ChevronDown, ListChecks, Inbox, FileText, Mail } from "lucide-react"

// Client component can't read server env vars — hardcoded fallback matches .env ADMIN_EMAILS
const ADMIN_EMAILS = ["neilbajaj72@gmail.com"]

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/moves", label: "Moves", icon: ListChecks },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/search", label: "Search", icon: Search },
  { href: "/add", label: "Add", icon: Plus },
]

const moreNavItems = [
  { href: "/capture", label: "Capture Meeting", icon: FileText },
  { href: "/inbox", label: "Review Inbox", icon: Inbox },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/scan", label: "Scan QR", icon: ScanLine },
  { href: "/graph", label: "Graph", icon: Network },
  { href: "/intros", label: "Intros", icon: Sparkles },
  { href: "/updates", label: "Investor Update", icon: Mail },
]

export function NavHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [isAdmin, setIsAdmin] = useState(false)
  const isLocal = typeof window !== "undefined" && window.location.hostname === "localhost"
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const mobileMenuButtonRef = useRef<HTMLButtonElement>(null)
  const mobileMenuPanelRef = useRef<HTMLElement>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user && ADMIN_EMAILS.includes(user.email || "")) {
        setIsAdmin(true)
      }
    })
  }, [supabase])

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [pathname])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    router.push("/")
    router.refresh()
  }

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false)
  }, [])

  useEffect(() => {
    if (!mobileMenuOpen) return

    const panel = mobileMenuPanelRef.current
    const trigger = mobileMenuButtonRef.current
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const focusable = () =>
      Array.from(
        panel?.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) || []
      )

    const focusTimer = window.setTimeout(() => focusable()[0]?.focus(), 0)
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        closeMobileMenu()
        return
      }
      if (event.key !== "Tab") return
      const items = focusable()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", handleKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      document.removeEventListener("keydown", handleKeyDown)
      document.body.style.overflow = previousOverflow
      trigger?.focus()
    }
  }, [mobileMenuOpen, closeMobileMenu])

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b bg-background safe-area-inset-top">
        <div className="container mx-auto flex h-16 items-center px-4">
          {/* Mobile menu button */}
          <Button
            ref={mobileMenuButtonRef}
            variant="ghost"
            size="sm"
            className="mr-2 sm:hidden touch-target text-muted-foreground hover:text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          <div className="mr-4 flex">
            <Link href="/dashboard" className="mr-8 flex items-center gap-2 group">
              <img src="/logo.svg" alt="" className="h-7 w-7" />
              <span className="text-xl font-medium tracking-tight text-[var(--copper-text)] group-hover:opacity-80 transition-opacity">Savvo</span>
            </Link>
            <nav aria-label="Primary" className="hidden sm:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                      isActive
                        ? "bg-[var(--copper)]/10 text-[var(--copper-text)]"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
              {/* More dropdown */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setMoreOpen(!moreOpen)}
                  onBlur={() => setTimeout(() => setMoreOpen(false), 150)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") setMoreOpen(false)
                  }}
                  aria-expanded={moreOpen}
                  aria-controls="more-navigation"
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                    moreNavItems.some((i) => pathname === i.href)
                      ? "bg-[var(--copper)]/10 text-[var(--copper-text)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  More
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", moreOpen && "rotate-180")} />
                </button>
                {moreOpen && (
                  <div id="more-navigation" className="absolute top-full left-0 mt-1 w-44 rounded-xl border bg-background shadow-lg py-1 z-50">
                    {moreNavItems.map((item) => {
                      const Icon = item.icon
                      const isActive = pathname === item.href
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "flex items-center gap-2.5 px-4 py-2.5 text-sm font-medium transition-all",
                            isActive
                              ? "bg-[var(--copper)]/10 text-[var(--copper-text)]"
                              : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                          )}
                        >
                          <Icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      )
                    })}
                  </div>
                )}
              </div>
            </nav>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-2">
            {isAdmin && isLocal && (
              <Link
                href="/dev"
                aria-current={pathname === "/dev" ? "page" : undefined}
                className={cn(
                  "hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  pathname === "/dev"
                    ? "bg-[var(--copper)]/10 text-[var(--copper-text)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Code className="h-4 w-4" />
                <span>Dev</span>
              </Link>
            )}
            <Link
              href="/settings"
              aria-current={pathname === "/settings" ? "page" : undefined}
              className={cn(
                "hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                pathname === "/settings"
                  ? "bg-[var(--copper)]/10 text-[var(--copper-text)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Settings className="h-4 w-4" />
              <span>Settings</span>
            </Link>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
              className="hidden sm:flex text-muted-foreground hover:text-foreground"
            >
              <LogOut className="h-4 w-4" />
              <span className="ml-2">Sign Out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Mobile slide-out menu overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 sm:hidden safe-area-inset-top safe-area-inset-bottom">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={closeMobileMenu}
            aria-hidden="true"
          />
          {/* Slide-out panel */}
          <nav
            id="mobile-navigation"
            ref={mobileMenuPanelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] bg-background border-r shadow-refined-lg animate-fade-in p-6 flex flex-col gap-1 overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <span className="text-xl font-medium tracking-tight text-[var(--copper-text)]">Savvo</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={closeMobileMenu}
                className="touch-target text-muted-foreground hover:text-foreground"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={closeMobileMenu}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all touch-target",
                    isActive
                      ? "bg-[var(--copper)]/10 text-[var(--copper-text)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              )
            })}

            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-4 pt-4 pb-1">More</p>

            {moreNavItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  onClick={closeMobileMenu}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all touch-target",
                    isActive
                      ? "bg-[var(--copper)]/10 text-[var(--copper-text)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              )
            })}

            <div className="border-t my-3" />

            {isAdmin && isLocal && (
              <Link
                href="/dev"
                aria-current={pathname === "/dev" ? "page" : undefined}
                onClick={closeMobileMenu}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all touch-target",
                  pathname === "/dev"
                    ? "bg-[var(--copper)]/10 text-[var(--copper-text)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Code className="h-5 w-5" />
                <span>Dev</span>
              </Link>
            )}

            <Link
              href="/settings"
              aria-current={pathname === "/settings" ? "page" : undefined}
              onClick={closeMobileMenu}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all touch-target",
                pathname === "/settings"
                  ? "bg-[var(--copper)]/10 text-[var(--copper-text)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Settings className="h-5 w-5" />
              <span>Settings</span>
            </Link>

            <button
              type="button"
              onClick={() => {
                closeMobileMenu()
                handleSignOut()
              }}
              className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all touch-target text-left w-full"
            >
              <LogOut className="h-5 w-5" />
              <span>Sign Out</span>
            </button>
          </nav>
        </div>
      )}
    </>
  )
}
