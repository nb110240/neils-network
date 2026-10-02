"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Upload } from "lucide-react"
import { captureEvent } from "@/components/posthog-provider"
import { PLAN_LIMITS } from "@/lib/types"
import { countCsvDataRows, isUneditedTemplate, PENDING_IMPORT_MAX_BYTES, savePendingImport } from "@/lib/pending-import"

// "Already filled it in?" on the free template page: keep the CSV in this
// browser, send the visitor to signup, and import it right after.
export function TrackerUpload() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [dragging, setDragging] = useState(false)
  const [blocked, setBlocked] = useState(false)

  async function handleFile(file: File | undefined) {
    setError(null)
    if (!file) return
    if (!/\.csv$/i.test(file.name)) {
      setError("Choose a .csv file. In Google Sheets or Excel, use File, Download, CSV.")
      return
    }
    if (file.size > PENDING_IMPORT_MAX_BYTES) {
      setError("That file is over 1 MB. Sign up and import it from the Import page instead.")
      return
    }
    const text = await file.text()
    const rows = countCsvDataRows(text)
    if (rows === 0) {
      setError("This file has no investors yet. Add at least one row, then upload it.")
      return
    }
    if (isUneditedTemplate(text)) {
      setError("This is still the example data. Replace the example rows with your investors, then upload it.")
      return
    }
    captureEvent("tracker_upload_started", { rows })
    if (!savePendingImport(file.name, text)) {
      setBlocked(true)
      return
    }
    router.push("/login?mode=signup")
  }

  if (blocked) {
    return (
      <p className="rounded-xl border border-stone-200 bg-white p-4 text-sm text-stone-700 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-300">
        Your browser blocked saving the file. <Link href="/login?mode=signup" className="font-medium text-[var(--copper-text)] underline underline-offset-2">Create your free account</Link>, then import it from the Import page.
      </p>
    )
  }

  return (
    <div>
      <label
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          void handleFile(e.dataTransfer.files?.[0])
        }}
        className={`flex min-h-24 cursor-pointer flex-col focus-within:ring-2 focus-within:ring-[var(--copper)] focus-within:ring-offset-2 items-center justify-center gap-2 rounded-xl border-2 border-dashed p-5 text-center transition-colors ${
          dragging
            ? "border-[var(--copper)] bg-[var(--copper)]/5"
            : "border-stone-300 bg-white hover:border-[var(--copper)] dark:border-stone-600 dark:bg-stone-900"
        }`}
      >
        <Upload className="h-5 w-5 text-[var(--copper-text)]" aria-hidden="true" />
        <span className="text-sm font-medium text-stone-900 dark:text-stone-100">Upload your filled tracker (.csv)</span>
        <span className="text-xs text-stone-700 dark:text-stone-300">Free account, then your pipeline is imported. Up to {PLAN_LIMITS.free.maxContacts} investors free.</span>
        <input
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          onChange={(e) => void handleFile(e.target.files?.[0])}
        />
      </label>
      {error && (
        <p className="mt-2 text-sm text-red-700 dark:text-red-300" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}
