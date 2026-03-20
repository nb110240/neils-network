"use client"

import { Suspense, useState, useRef, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import {
  ArrowLeft,
  Upload,
  FileSpreadsheet,
  Loader2,
  Check,
  ArrowRight,
  Mail,
} from "lucide-react"

const CONTACT_FIELDS = [
  { value: "skip", label: "Skip this column" },
  { value: "name", label: "Name" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Phone" },
  { value: "company", label: "Company" },
  { value: "job_title", label: "Job Title" },
  { value: "website", label: "Website" },
  { value: "how_we_met", label: "How We Met" },
]

function guessField(header: string): string {
  const h = header.toLowerCase().trim()
  if (h.includes("name") && !h.includes("company")) return "name"
  if (h.includes("email") || h.includes("e-mail")) return "email"
  if (h.includes("phone") || h.includes("mobile") || h.includes("tel")) return "phone"
  if (h.includes("company") || h.includes("organization") || h.includes("org")) return "company"
  if (h.includes("title") || h.includes("role") || h.includes("position") || h.includes("job")) return "job_title"
  if (h.includes("website") || h.includes("url") || h.includes("web")) return "website"
  return "skip"
}

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
  const [isLoading, setIsLoading] = useState(false)

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
      setGoogleImportedCount(data.imported)
      setStep("done")
    } catch (error) {
      addToast({ title: "Import failed", description: error instanceof Error ? error.message : "Something went wrong", variant: "destructive" })
    } finally {
      setIsGoogleImporting(false)
    }
  }

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (!selectedFile) return
    setFile(selectedFile)
    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append("file", selectedFile)

      const res = await fetch("/api/import/csv", {
        method: "PUT",
        body: formData,
      })
      const data = await res.json()

      if (!res.ok) throw new Error(data.message)

      setHeaders(data.headers)
      setPreviewRows(data.rows)
      setTotalRows(data.totalRows)

      const guessed: Record<string, string> = {}
      for (const header of data.headers) {
        guessed[header] = guessField(header)
      }
      setMapping(guessed)
      setStep("map")
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to parse CSV",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
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

      if (!res.ok) throw new Error(data.message)

      setImportedCount(data.imported)
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

      if (!res.ok) throw new Error(data.message)

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
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-3xl font-normal tracking-tight">Import Contacts</h1>
          <p className="text-muted-foreground">
            Bring your existing contacts into Savvo
          </p>
        </div>
      </div>

      {/* Step: Choose import method */}
      {mode === "choose" && (
        <div className="grid md:grid-cols-2 gap-4 animate-fade-in">
          <button
            type="button"
            className="text-left w-full rounded-xl border bg-card shadow-refined cursor-pointer transition-all hover:shadow-refined-lg hover:-translate-y-0.5 hover:border-[var(--copper)]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => setMode("csv")}
          >
            <div className="flex flex-col items-center justify-center py-10 px-6">
              <FileSpreadsheet className="h-10 w-10 text-[var(--copper)] mb-4" />
              <h3 className="text-lg font-medium">CSV File</h3>
              <p className="text-sm text-muted-foreground text-center mt-1">
                Upload from LinkedIn, Google Contacts, or any spreadsheet
              </p>
            </div>
          </button>
          <button
            type="button"
            className="text-left w-full rounded-xl border bg-card shadow-refined cursor-pointer transition-all hover:shadow-refined-lg hover:-translate-y-0.5 hover:border-[var(--copper)]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={handleGmailImport}
            disabled={isLoading}
          >
            <div className="flex flex-col items-center justify-center py-10 px-6">
              {isLoading ? (
                <Loader2 className="h-10 w-10 text-[var(--copper)] animate-spin mb-4" />
              ) : (
                <Mail className="h-10 w-10 text-[var(--copper)] mb-4" />
              )}
              <h3 className="text-lg font-medium">Google Contacts</h3>
              <p className="text-sm text-muted-foreground text-center mt-1">
                Import directly from your Gmail account
              </p>
            </div>
          </button>
        </div>
      )}

      {/* Google Contacts import confirmation */}
      {mode === "gmail" && googleReady && step !== "done" && (
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
                className="bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 border-0"
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
      {mode === "csv" && step === "upload" && (
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
                <Loader2 className="h-10 w-10 mx-auto text-[var(--copper)] animate-spin" />
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
      {mode === "csv" && step === "map" && (
        <div className="space-y-6 animate-fade-in">
          <Card className="glass shadow-refined">
            <CardHeader>
              <CardTitle className="text-lg font-normal">
                Map Columns ({totalRows} contacts found)
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
                    {CONTACT_FIELDS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              ))}

              {!hasNameMapping && (
                <p className="text-sm text-red-500">
                  Please map at least one column to &quot;Name&quot;
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
                  className="bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 border-0"
                  onClick={handleImport}
                  disabled={!hasNameMapping}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Import {totalRows} Contacts
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Importing */}
      {step === "importing" && (
        <Card className="glass shadow-refined animate-fade-in">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-10 w-10 text-[var(--copper)] animate-spin mb-4" />
            <p className="text-lg font-medium">Importing contacts...</p>
            <p className="text-sm text-muted-foreground mt-1">
              This may take a moment for large files
            </p>
          </CardContent>
        </Card>
      )}

      {/* Done */}
      {step === "done" && (
        <Card className="glass shadow-refined animate-fade-in">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mb-4">
              <Check className="h-7 w-7 text-emerald-600" />
            </div>
            <p className="text-xl font-normal">
              {importedCount || googleImportedCount} contacts imported!
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Embeddings are being generated in the background for semantic search
            </p>
            <div className="flex gap-3 mt-6">
              <Button variant="outline" onClick={() => { setStep("upload"); setFile(null); setMode("choose") }}>
                Import More
              </Button>
              <Button
                className="bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 border-0"
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
