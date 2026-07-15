"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Check, Circle, Plus, Search, Users, Eye, X, Sparkles, ChevronRight, Download } from "lucide-react"

const STORAGE_KEY = "savvo-onboarding-checklist"
const DISMISSED_KEY = "savvo-onboarding-checklist-dismissed"

interface ChecklistItem {
  id: string
  label: string
  description: string
  href: string
  icon: React.ElementType
  /** How to auto-detect completion */
  autoComplete?: boolean
}

const CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: "add-contact",
    label: "Add your first contact",
    description: "Type what you remember, and AI does the rest",
    href: "/add",
    icon: Plus,
  },
  {
    id: "view-contact",
    label: "View a contact's profile",
    description: "See health score, details, and timeline",
    href: "/contacts",
    icon: Eye,
  },
  {
    id: "try-search",
    label: "Search your network",
    description: "Find people by what you remember, not just names",
    href: "/search",
    icon: Search,
  },
  {
    id: "explore-dashboard",
    label: "Check your dashboard",
    description: "See who needs attention and network health",
    href: "/dashboard",
    icon: Users,
  },
  {
    id: "install-app",
    label: "Add Savvo to your home screen",
    description: "One-tap launch, offline access for recent contacts",
    href: "/install",
    icon: Download,
  },
]

interface OnboardingChecklistProps {
  contactCount: number
}

export function OnboardingChecklist({ contactCount }: OnboardingChecklistProps) {
  const pathname = usePathname()
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set())
  const [dismissed, setDismissed] = useState(true) // default hidden until loaded

  // Load state from localStorage
  useEffect(() => {
    if (typeof window === "undefined") return
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      try {
        setCompletedSteps(new Set(JSON.parse(saved)))
      } catch {
        // ignore
      }
    }
    setDismissed(localStorage.getItem(DISMISSED_KEY) === "true")
  }, [])

  // Auto-complete based on navigation and contact count
  useEffect(() => {
    if (typeof window === "undefined") return

    const newCompleted = new Set(completedSteps)

    // Auto-complete "add-contact" when user has contacts
    if (contactCount > 0) newCompleted.add("add-contact")

    // Auto-complete based on current page visit
    if (pathname === "/contacts" || pathname?.startsWith("/contact/")) {
      newCompleted.add("view-contact")
    }
    if (pathname === "/search") {
      newCompleted.add("try-search")
    }
    if (pathname === "/dashboard" && contactCount > 0) {
      newCompleted.add("explore-dashboard")
    }
    // Auto-complete the install step if running as an installed PWA
    if (
      typeof window !== "undefined" &&
      (window.matchMedia?.("(display-mode: standalone)").matches ||
        (navigator as { standalone?: boolean }).standalone)
    ) {
      newCompleted.add("install-app")
    }

    if (newCompleted.size !== completedSteps.size) {
      setCompletedSteps(newCompleted)
      localStorage.setItem(STORAGE_KEY, JSON.stringify([...newCompleted]))
    }
  }, [pathname, contactCount, completedSteps])

  // Don't show if dismissed or all complete or too many contacts
  if (dismissed || contactCount >= 10 || completedSteps.size === CHECKLIST_ITEMS.length) return null

  const progress = completedSteps.size
  const total = CHECKLIST_ITEMS.length

  function handleDismiss() {
    setDismissed(true)
    localStorage.setItem(DISMISSED_KEY, "true")
  }

  return (
    <Card className="shadow-refined border-[var(--copper)]/20 overflow-hidden">
      {/* Header with progress */}
      <div className="px-4 pt-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-[var(--copper)]/10 flex items-center justify-center">
            <Sparkles className="h-4 w-4 text-[var(--copper-text)]" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">Get started with Savvo</h3>
            <p className="text-xs text-muted-foreground">{progress}/{total} complete</p>
          </div>
        </div>
        <button
          onClick={handleDismiss}
          className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-stone-100 dark:hover:bg-stone-800 transition-colors"
          aria-label="Dismiss checklist"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Progress bar */}
      <div className="mx-4 mb-3 h-1 rounded-full bg-stone-100 dark:bg-stone-800 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] transition-all duration-700 ease-out"
          style={{ width: `${(progress / total) * 100}%` }}
        />
      </div>

      <CardContent className="px-2 pb-3 pt-0 space-y-0.5">
        {CHECKLIST_ITEMS.map((item) => {
          const isComplete = completedSteps.has(item.id)
          const Icon = item.icon
          return (
            <Link
              key={item.id}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all group ${
                isComplete
                  ? "opacity-60"
                  : "hover:bg-[var(--copper)]/5"
              }`}
            >
              {/* Checkbox */}
              <div className="shrink-0">
                {isComplete ? (
                  <div className="h-5 w-5 rounded-full bg-[var(--copper)] flex items-center justify-center">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                ) : (
                  <Circle className="h-5 w-5 text-stone-300 dark:text-stone-600" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-medium leading-tight ${isComplete ? "line-through text-muted-foreground" : ""}`}>
                  {item.label}
                </p>
                {!isComplete && (
                  <p className="text-xs text-muted-foreground mt-0.5">{item.description}</p>
                )}
              </div>

              {/* Arrow for incomplete items */}
              {!isComplete && (
                <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all shrink-0" />
              )}
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}
