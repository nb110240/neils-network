"use client"

import { useEffect } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { useToast } from "@/components/ui/toast"

export function UpgradeToast() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { addToast } = useToast()

  useEffect(() => {
    if (searchParams.get("upgraded") === "true") {
      addToast({
        title: "Welcome to Pro!",
        description: "You now have unlimited contacts, import, calendar sync, and daily digest emails.",
      })
      // Clean up URL
      router.replace("/dashboard", { scroll: false })
    }
    if (searchParams.get("calendar") === "connected") {
      addToast({
        title: "Calendar connected!",
        description: "Your Google Calendar is now syncing. New 1:1 meetings will auto-create contacts.",
      })
      router.replace("/dashboard", { scroll: false })
    }
    if (searchParams.get("calendar") === "error") {
      addToast({
        title: "Calendar connection failed",
        description: "Please try connecting your calendar again.",
        variant: "destructive",
      })
      router.replace("/dashboard", { scroll: false })
    }
  }, [searchParams, addToast, router])

  return null
}
