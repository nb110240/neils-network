"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Plus, LayoutDashboard } from "lucide-react"

export function MobileFab() {
  const pathname = usePathname()

  // On add/scan pages, show "Dashboard" button instead
  const isAddPage = pathname === "/add" || pathname === "/scan"

  return (
    <Link
      href={isAddPage ? "/dashboard" : "/add"}
      className="fixed bottom-5 right-4 z-50 sm:hidden flex items-center justify-center h-12 w-12 rounded-full bg-[var(--copper)] text-white shadow-lg active:scale-95 transition-transform"
      style={{ bottom: "max(1.25rem, env(safe-area-inset-bottom, 1.25rem))" }}
      aria-label={isAddPage ? "Go to Dashboard" : "Add Contact"}
    >
      {isAddPage ? (
        <LayoutDashboard className="h-5 w-5" />
      ) : (
        <Plus className="h-6 w-6" />
      )}
    </Link>
  )
}
