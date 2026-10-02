"use client"

import { Suspense, useState, useRef, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { IMPORT_FIELDS, guessImportField } from "@/lib/import-mapping"
import { PLAN_LIMITS } from "@/lib/types"
import { readPendingImport, resumePendingImport } from "@/lib/pending-import"
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  Loader2,
  Check,
  ArrowRight,
  Mail,
  Crown,
} from "lucide-react"
import { trackContactsCreated } from "@/components/posthog-provider"

const FREE_CSV_LIMIT = PLAN_LIMITS.free.maxContacts

export default function ImportPage() {
  return (
    <Suspense>
      <ImportPageInner />
    </Suspense>
  )
}

function ImportPageInner() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { addToast } = useToast()
  const fileRef = useRef<HTMLInputElement>(null)

  const [mode, setMode] = useState<"choose" | "csv" | "gmail">("choose")
  const [googleReady, setGoogleReady] = useState(false)
  const [isGoogleImporting, setIsGoogleImporting] = useState(false)
  const [googleImportedCount, setGoogleImportedCount] = useState(0)
  const [step, setStep] = useState<"upload" | "map" | "importing" | "done">("upload")
  const [headers, setHeaders] = useState<string[]>([])
  const [previewRows, setPreviewRows] = useState<Record<string, string>[]>([])
  const [totalRows, setTotalRows] = useState(0)
  const [mapping, setMapping] = useState<Record<string, string>>({})
  const [file, setFile] = useState<File | null>(null)
  const [importedCount, setImportedCount] = useState(0)
  const [skippedCount, setSkippedCount] = useState(0)
  const [possibleDuplicateCount, setPossibleDuplicateCount] = useState(0)
  const [isLoading, setIsLoading] = useState(false)
  const [isPro, setIsPro] = useState<boolean | null>(null)

  // Free accounts can CSV-import up to their contact allowance. Google
  // and unlimited bulk imports remain Pro and are still server-enforced.
  useEffect(() => {
    async function checkPlan() {
      try {
        const res = await fetch("/api/subscription")
        if (res.ok) {
          const data = await res.json()
          setIsPro(data.plan !== "free")
          return
        }
      } catch {
        // fall through — treat as pro and let the API 403 enforce
      }
      setIsPro(true)
    }
    checkPlan()
  }, [])

  // Handle Google OAuth callback — token is in httpOnly cookie, not URL
  useEffect(() => {
    const googleStatus = searchParams.get("google")

    if (googleStatus === "error") {
      addToast({ title: "Google Import Failed", description: "Could not connect to Google. Please try again.", variant: "destructive" })
    } else if (googleStatus === "ready") {
      setGoogleReady(true)
      setMode("gmail")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleGoogleImportContacts = async () => {
    setIsGoogleImporting(true)
    try {
      // Token is read from httpOnly cookie server-side — never exposed to client
      const res = await fetch("/api/import/google", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || data.message)
      trackContactsCreated("google_import", data.imported || 0)
      setGoogleImportedCount(data.imported)
      setStep("done")
    } catch (error) {
      addToast({ title: "Import failed", description: error instanceof Error ? error.message : "Something went wrong", variant: "destructive" })
    } finally {
      setIsGoogleImporting(false)
    }
  }

  // A tracker uploaded on the public template page before signup: load it
  // straight into column mapping. Cleared once the server has parsed (or
  // rejected) it, so a failed request keeps it for a retry while the
  // dashboard redirect (PendingImportRedirect) still can't loop.
  const resumedPending = useRef(false)
  useEffect(() => {
    if (isPro === null || resumedPending.current) return
    const pending = readPendingImport()
    if (!pending) return
    resumedPending.current = true
    setMode("csv")
    void resumePendingImport(pending, loadCsvFile)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPro])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    await loadCsvFile(selectedFile)
  }

  /** Resolves true once the server gave a final answer: parsed, or rejected as invalid (4xx). */
  const loadCsvFile = async (selectedFile: File): Promise<boolean> => {
    setFile(selectedFile)
    setIsLoading(true)
    let settled = false

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)

      const res = await fetch("/api/import/csv", {
        method: "PUT",
        body: formData,
      })
      settled = res.status >= 400 && res.status < 500
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || "Failed to parse CSV")

      setHeaders(data.headers)
      setPreviewRows(data.rows)
      setTotalRows(data.totalRows)

      const guessed: Record<string, string> = {}
      for (const header of data.headers) {
        guessed[header] = guessImportField(header)
      }
      setMapping(guessed)
      setStep("map")
      settled = true
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to parse CSV",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
    return settled
  }

  const handleImport = async () => {
    if (!file) return
    setStep("importing")

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("mapping", JSON.stringify(mapping))

      const res = await fetch("/api/import/csv", {
        method: "POST",
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || "Failed to import contacts")

      trackContactsCreated("csv_import", data.imported || 0)
      setImportedCount(data.imported)
      setSkippedCount(data.skipped || 0)
      setPossibleDuplicateCount(
        new Set((data.duplicates || []).map((d: { imported_contact: { id: string } }) => d.imported_contact.id)).size
      )
      setStep("done")
    } catch (error) {
      addToast({
        title: "Import failed",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      })
      setStep("map")
    }
  }

  const handleGmailImport = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/import/google")
      const data = await res.json()

      if (!res.ok) throw new Error(data.error || "Failed to connect Google")

      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to start Gmail import",
        variant: "destructive",
      })
      setIsLoading(false)
    }
  }

  const hasNameMapping = Object.values(mapping).includes("name")

  return (
    <div className="space-y-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="inline-flex items-center gap-1 py-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          Dashboard
        </Link>
        <div>
          <h1 className="text-3xl font-normal tracking-tight">Import Contacts</h1>
          <p className="text-muted-foreground">
            Bring your existing contacts into Savvo
          </p>
        </div>
      </div>

      {/* Plan check in flight */}
      {isPro === null && (
        <Card className="glass shadow-refined">
          <CardContent className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 text-[var(--copper-text)] animate-spin" />
          </CardContent>
        </Card>
      )}

      {/* Free onboarding allowance */}
      {isPro === false && (
        <Card className="border-[var(--copper)]/20 bg-[var(--copper)]/5 shadow-refined animate-fade-in">
          <CardContent className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="font-medium">Import up to {FREE_CSV_LIMIT} contacts free</p>
              <p className="mt-1 text-sm text-stone-700 dark:text-stone-300">Bring in your investor tracker or any CSV. Unlimited contacts and Google Contacts import are included with Pro.</p>
            </div>
            <Button asChild variant="outline" size="sm" className="shrink-0">
              <Link href="/pricing"><Crown className="mr-2 h-4 w-4" /> See Pro</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* One-time import disclaimer */}
      {isPro !== null && mode === "choose" && (
        <p className="text-xs text-muted-foreground">
          Imports are one-time. Future changes in Google Contacts won&apos;t sync automatically.
        </p>
      )}

      {/* Step: Choose import method */}
      {isPro !== null && mode === "choose" && (
        <div className="grid md:grid-cols-2 gap-4 animate-fade-in">
          <button
            type="button"
            className="text-left w-full rounded-xl border bg-card shadow-refined cursor-pointer transition-all hover:shadow-refined-lg hover:-translate-y-0.5 hover:border-[var(--copper)]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => setMode("csv")}
          >
            <div className="flex flex-col items-center justify-center py-10 px-6">
              <FileSpreadsheet className="h-10 w-10 text-[var(--copper-text)] mb-4" />
              <h3 className="text-lg font-medium">CSV File</h3>
              <p className="text-sm text-muted-foreground text-center mt-1">
                Upload from LinkedIn, Google Contacts, or any spreadsheet
              </p>
            </div>
          </button>
          {isPro ? <button
            type="button"
            className="text-left w-full rounded-xl border bg-card shadow-refined cursor-pointer transition-all hover:shadow-refined-lg hover:-translate-y-0.5 hover:border-[var(--copper)]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={handleGmailImport}
            disabled={isLoading}
          >
            <div className="flex flex-col items-center justify-center py-10 px-6">
              {isLoading ? (
                <Loader2 className="h-10 w-10 text-[var(--copper-text)] animate-spin mb-4" />
              ) : (
                <Mail className="h-10 w-10 text-[var(--copper-text)] mb-4" />
              )}
              <h3 className="text-lg font-medium">Google Contacts</h3>
              <p className="text-sm text-muted-foreground text-center mt-1">
                Import directly from your Gmail account
              </p>
            </div>
          </button> : <Link href="/pricing" className="text-left w-full rounded-xl border bg-card shadow-refined transition-all hover:border-[var(--copper)]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
            <div className="flex flex-col items-center justify-center py-10 px-6">
              <Crown className="h-10 w-10 text-[var(--copper-text)] mb-4" />
              <h3 className="text-lg font-medium">Google Contacts · Pro</h3>
              <p className="text-sm text-muted-foreground text-center mt-1">Upgrade for direct Google import and unlimited CSVs</p>
            </div>
          </Link>}
        </div>
      )}

      {/* Google Contacts import confirmation */}
      {isPro === true && mode === "gmail" && googleReady && step !== "done" && (
        <Card className="glass shadow-refined animate-fade-in">
          <CardHeader>
            <CardTitle className="text-lg font-normal">
              Google Contacts Ready
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Your Google account is connected. Click import to bring your contacts into Savvo.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setMode("choose"); setGoogleReady(false) }}>
                Cancel
              </Button>
              <Button
                className="bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] text-white hover:opacity-90 border-0"
                onClick={handleGoogleImportContacts}
                disabled={isGoogleImporting}
              >
                {isGoogleImporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
                Import Contacts
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* CSV: Upload */}
      {isPro !== null && mode === "csv" && step === "upload" && (
        <Card className="glass shadow-refined animate-fade-in">
          <CardHeader>
            <CardTitle className="text-lg font-normal">Upload CSV File</CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className="border-2 border-dashed rounded-xl p-8 sm:p-12 text-center cursor-pointer hover:border-[var(--copper)]/50 hover:bg-[var(--copper)]/5 transition-all"
              onClick={() => fileRef.current?.click()}
            >
              {isLoading ? (
                <Loader2 className="h-10 w-10 mx-auto text-[var(--copper-text)] animate-spin" />
              ) : (
                <>
                  <FileSpreadsheet className="h-10 w-10 mx-auto text-muted-foreground mb-4" />
                  <p className="font-medium">Click to upload a CSV file</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Export from Google Contacts, LinkedIn, or any spreadsheet
                  </p>
                </>
              )}
              <input
                ref={fileRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={handleFileSelect}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="mt-4 text-muted-foreground"
              onClick={() => setMode("choose")}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Choose different method
            </Button>
          </CardContent>
        </Card>
      )}

      {/* CSV: Map Columns */}
      {isPro !== null && mode === "csv" && step === "map" && (
        <div className="space-y-6 animate-fade-in">
          <Card className="glass shadow-refined">
            <CardHeader>
              <CardTitle className="text-lg font-normal">
                Map Columns ({totalRows} {totalRows === 1 ? "contact" : "contacts"} found)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {headers.map((header) => (
                <div key={header} className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4">
                  <div className="w-full sm:w-1/3">
                    <p className="text-sm font-medium">{header}</p>
                    {previewRows[0]?.[header] && (
                      <p className="text-xs text-muted-foreground truncate">
                        e.g. {previewRows[0][header]}
                      </p>
                    )}
                  </div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0" />
                  <select
                    value={mapping[header] || "skip"}
                    onChange={(e) =>
                      setMapping((prev) => ({ ...prev, [header]: e.target.value }))
                    }
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  >
                    {IMPORT_FIELDS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}

              {totalRows === 0 && (
                <p className="text-sm text-red-500">
                  No contacts found in this file. Add at least one row below the header.
                </p>
              )}

              {!hasNameMapping && (
                <p className="text-sm text-red-500">
                  Please map at least one column to &quot;Name&quot;
                </p>
              )}

              {isPro === false && totalRows > FREE_CSV_LIMIT && (
                <p className="text-sm text-amber-800 dark:text-amber-300">
                  The free plan holds up to {FREE_CSV_LIMIT} contacts. Trim this file or upgrade for unlimited contacts.
                </p>
              )}

              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setStep("upload")
                    setFile(null)
                  }}
                >
                  Back
                </Button>
                <Button
                  className="bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] text-white hover:opacity-90 border-0"
                  onClick={handleImport}
                  disabled={!hasNameMapping || totalRows === 0 || (isPro === false && totalRows > FREE_CSV_LIMIT)}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Import {totalRows} {totalRows === 1 ? "Contact" : "Contacts"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Importing */}
      {isPro !== null && step === "importing" && (
        <Card className="glass shadow-refined animate-fade-in">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-10 w-10 text-[var(--copper-text)] animate-spin mb-4" />
            <p className="text-lg font-medium">Importing contacts...</p>
            <p className="text-sm text-muted-foreground mt-1">
              This may take a moment for large files
            </p>
          </CardContent>
        </Card>
      )}

      {/* Done */}
      {isPro !== null && step === "done" && (
        <Card className="glass shadow-refined animate-fade-in">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
              <Check className="h-7 w-7 text-emerald-600" />
            </div>
            <p className="text-xl font-normal">
              {(() => {
                const n = importedCount || googleImportedCount
                return `${n} ${n === 1 ? "contact" : "contacts"} imported`
              })()}
            </p>
            {skippedCount > 0 && (
              <p className="text-sm text-stone-700 dark:text-stone-300 mt-1">
                {skippedCount} already in your network {skippedCount === 1 ? "was" : "were"} skipped.
              </p>
            )}
            {possibleDuplicateCount > 0 && (
              <p className="text-sm text-amber-800 dark:text-amber-300 mt-1">
                {possibleDuplicateCount} may match people you already have.{" "}
                <Link href="/settings#duplicates" className="underline underline-offset-2">
                  Review duplicates
                </Link>
              </p>
            )}
            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => { setStep("upload"); setFile(null); setMode("choose"); setImportedCount(0); setGoogleImportedCount(0); setSkippedCount(0); setPossibleDuplicateCount(0) }}>
                Import More
              </Button>
              <Button
                className="bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] text-white hover:opacity-90 border-0"
                onClick={() => router.push("/contacts")}
              >
                View Contacts
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
