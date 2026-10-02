"use client"

import { useEffect } from "react"
import { usePathname, useRouter } from "next/navigation"
import { readPendingImport } from "@/lib/pending-import"

// After signup every path lands on /dashboard. If the visitor uploaded their
// tracker on the template page first, take them straight to the import.
// /import clears the pending file as soon as it loads it, so this can't loop.
export function PendingImportRedirect() {
  const pathname = usePathname()
  const router = useRouter()

  useEffect(() => {
    if (pathname === "/import") return
    if (readPendingImport()) router.replace("/import")
  }, [pathname, router])

  return null
}
