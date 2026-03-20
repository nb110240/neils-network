"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { LogOut, Plus, Search, LayoutDashboard, Upload, Users, Settings, ScanLine, Code, Menu, X, Network, BookOpen, Sparkles } from "lucide-react"
import { ThemeToggle } from "@/components/theme-toggle"

// Client component can't read server env vars — hardcoded fallback matches .env ADMIN_EMAILS
const ADMIN_EMAILS = ["neilbajaj72@gmail.com"]

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/contacts", label: "Contacts", icon: Users },
  { href: "/search", label: "Search", icon: Search },
  { href: "/add", label: "Add", icon: Plus },
  { href: "/scan", label: "Scan", icon: ScanLine },
  { href: "/import", label: "Import", icon: Upload },
  { href: "/graph", label: "Graph", icon: Network },
  { href: "/intros", label: "Intros", icon: Sparkles },
  { href: "/", label: "Features", icon: BookOpen },
]

export function NavHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [isAdmin, setIsAdmin] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

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
    router.push("/login")
    router.refresh()
  }

  const closeMobileMenu = useCallback(() => {
    setMobileMenuOpen(false)
  }, [])

  return (
    <>
      <header className="sticky top-0 z-40 w-full border-b bg-background/85 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center px-4">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="sm"
            className="mr-2 sm:hidden touch-target text-muted-foreground hover:text-foreground"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>

          <div className="mr-4 flex">
            <Link href="/" className="mr-8 flex items-center group">
              <span className="text-xl font-medium tracking-tight text-[var(--copper)] group-hover:opacity-80 transition-opacity">Savvo</span>
            </Link>
            <nav className="hidden sm:flex items-center space-x-1">
              {navItems.map((item) => {
                const Icon = item.icon
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
                      isActive
                        ? "bg-[var(--copper)]/10 text-[var(--copper)]"
                        : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </nav>
          </div>
          <div className="flex flex-1 items-center justify-end space-x-2">
            <ThemeToggle />
            {isAdmin && (
              <Link
                href="/dev"
                className={cn(
                  "hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                  pathname === "/dev"
                    ? "bg-[var(--copper)]/10 text-[var(--copper)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Code className="h-4 w-4" />
                <span>Dev</span>
              </Link>
            )}
            <Link
              href="/settings"
              className={cn(
                "hidden sm:flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all",
                pathname === "/settings"
                  ? "bg-[var(--copper)]/10 text-[var(--copper)]"
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
        <div className="fixed inset-0 z-50 sm:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={closeMobileMenu}
            aria-hidden="true"
          />
          {/* Slide-out panel */}
          <nav className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] bg-background border-r shadow-refined-lg animate-fade-in p-6 flex flex-col gap-1 overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <span className="text-xl font-medium tracking-tight text-[var(--copper)]">Savvo</span>
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
                  onClick={closeMobileMenu}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all touch-target",
                    isActive
                      ? "bg-[var(--copper)]/10 text-[var(--copper)]"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              )
            })}

            <div className="border-t my-3" />

            {isAdmin && (
              <Link
                href="/dev"
                onClick={closeMobileMenu}
                className={cn(
                  "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all touch-target",
                  pathname === "/dev"
                    ? "bg-[var(--copper)]/10 text-[var(--copper)]"
                    : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
                )}
              >
                <Code className="h-5 w-5" />
                <span>Dev</span>
              </Link>
            )}

            <Link
              href="/settings"
              onClick={closeMobileMenu}
              className={cn(
                "flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all touch-target",
                pathname === "/settings"
                  ? "bg-[var(--copper)]/10 text-[var(--copper)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <Settings className="h-5 w-5" />
              <span>Settings</span>
            </Link>

            <button
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
