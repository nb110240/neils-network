"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { Download, Loader2 } from "lucide-react"

export function ExportContactsButton() {
  const [isExporting, setIsExporting] = useState(false)
  const { addToast } = useToast()

  const handleExport = async () => {
    setIsExporting(true)
    try {
      const response = await fetch("/api/contacts/export")
      if (!response.ok) {
        throw new Error("Failed to export contacts")
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `savvo-contacts-${new Date().toISOString().split("T")[0]}.csv`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      addToast({
        title: "Export complete",
        description: "Your contacts have been downloaded as CSV.",
      })
    } catch {
      addToast({
        title: "Export didn't work",
        description: "Refresh the page and try again.",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <Button variant="outline" onClick={handleExport} disabled={isExporting}>
      {isExporting ? (
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      Export CSV
    </Button>
  )
}
