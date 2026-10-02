"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/toast"
import {
  ArrowLeft,
  Camera,
  Loader2,
  Check,
  ExternalLink,
  Linkedin,
  ScanLine,
  Info,
} from "lucide-react"
import { trackContactsCreated } from "@/components/posthog-provider"
import { extractLinkedInUrl } from "@/lib/linkedin"

export default function ScanPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const scannerRef = useRef<HTMLDivElement>(null)
  const html5QrCodeRef = useRef<unknown>(null)

  const [isScanning, setIsScanning] = useState(false)
  const [scannedUrl, setScannedUrl] = useState("")
  const [manualUrl, setManualUrl] = useState("")
  const [isImporting, setIsImporting] = useState(false)
  const [importedContact, setImportedContact] = useState<{ id: string; name: string } | null>(null)
  const [error, setError] = useState("")

  async function startScanner() {
    setIsScanning(true)
    setError("")
    setScannedUrl("")
    setImportedContact(null)

    try {
      // Request camera permission explicitly first
      await navigator.mediaDevices.getUserMedia({ video: true }).then((stream) => {
        // Stop the stream immediately — we just needed the permission grant
        stream.getTracks().forEach((track) => track.stop())
      })

      const { Html5Qrcode } = await import("html5-qrcode")
      const scanner = new Html5Qrcode("qr-reader")
      html5QrCodeRef.current = scanner

      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => {
          const url = extractLinkedInUrl(decodedText)
          if (url) {
            setScannedUrl(url)
            scanner.stop().catch(() => {})
            setIsScanning(false)
          } else {
            setError("Not a LinkedIn QR code. Please scan a LinkedIn profile QR code.")
          }
        },
        () => {} // ignore scan failures (happens every frame without a QR)
      )
    } catch {
      setIsScanning(false)
      setError("Camera access was blocked. Please allow camera access in your browser settings, then try again or paste the URL below.")
    }
  }

  function stopScanner() {
    if (html5QrCodeRef.current) {
      const scanner = html5QrCodeRef.current as { stop: () => Promise<void>; isScanning?: boolean; getState?: () => number }
      // Only stop if scanner is actually running (state 2 = scanning)
      try {
        if (scanner.getState?.() === 2) {
          scanner.stop().catch(() => {})
        }
      } catch {
        // Scanner not in a stoppable state — ignore
      }
    }
    setIsScanning(false)
  }

  useEffect(() => {
    return () => {
      if (html5QrCodeRef.current) {
        const scanner = html5QrCodeRef.current as { stop: () => Promise<void>; getState?: () => number }
        try {
          if (scanner.getState?.() === 2) {
            scanner.stop().catch(() => {})
          }
        } catch {
          // Already stopped or not started — ignore
        }
      }
    }
  }, [])

  async function handleImport(url: string) {
    if (!url) return
    setIsImporting(true)
    setError("")

    try {
      const res = await fetch("/api/contacts/linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      })

      const data = await res.json()

      if (res.status === 409) {
        addToast({ title: "Already in your network", description: data.error || data.message })
        if (data.contactId) router.push(`/contact/${data.contactId}`)
        return
      }

      if (!res.ok) throw new Error(data.error || "Failed to import")

      trackContactsCreated("qr_scan")
      setImportedContact({ id: data.contact.id, name: data.contact.name })
      addToast({
        title: "Contact added",
        description: `${data.contact.name} has been added to your network.`,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to import contact")
    } finally {
      setIsImporting(false)
    }
  }

  function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault()
    const url = extractLinkedInUrl(manualUrl)
    if (url) {
      setScannedUrl(url)
      handleImport(url)
    } else {
      setError("Please enter a valid LinkedIn profile URL")
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="inline-flex items-center gap-1 py-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          Dashboard
        </Link>
        <div>
          <h1 className="text-3xl font-normal tracking-tight">Scan LinkedIn</h1>
          <p className="text-muted-foreground">
            Scan a QR code or paste a profile URL
          </p>
        </div>
      </div>

      {/* Info Banner */}
      <div className="flex gap-3 p-4 rounded-xl border border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/30">
        <Info className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
        <p className="text-sm text-blue-900 dark:text-blue-200">
          We&apos;ll pull their profile details and add them as a contact. To actually connect on LinkedIn, use the link we provide to visit their profile directly.
        </p>
      </div>

      {/* Scanner */}
      {!scannedUrl && !importedContact && (
        <Card className="shadow-refined overflow-hidden">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-normal">
              <ScanLine className="h-4 w-4 text-muted-foreground" />
              QR Code Scanner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {isScanning ? (
              <>
                <div id="qr-reader" ref={scannerRef} className="rounded-lg overflow-hidden" />
                <Button variant="outline" onClick={stopScanner} className="w-full">
                  Stop Scanning
                </Button>
              </>
            ) : (
              <button
                type="button"
                onClick={startScanner}
                className="w-full flex flex-col items-center justify-center py-12 rounded-xl border-2 border-dashed hover:border-[var(--copper)]/50 hover:bg-[var(--copper)]/5 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Camera className="h-10 w-10 text-muted-foreground mb-3" />
                <span className="font-medium">Tap to scan LinkedIn QR code</span>
                <span className="text-sm text-muted-foreground mt-1">
                  Open LinkedIn &rarr; Search &rarr; QR code icon
                </span>
              </button>
            )}

            {/* Divider */}
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-dashed" />
              </div>
              <div className="relative flex justify-center">
                <span className="bg-card px-3 text-sm text-muted-foreground">or paste URL</span>
              </div>
            </div>

            {/* Manual URL input */}
            <form onSubmit={handleManualSubmit} className="flex gap-3">
              <Input
                aria-label="LinkedIn profile URL"
                placeholder="https://linkedin.com/in/johndoe"
                value={manualUrl}
                onChange={(e) => { setManualUrl(e.target.value); setError("") }}
                className="flex-1 h-11"
              />
              <Button
                type="submit"
                disabled={isImporting || !manualUrl.trim()}
                variant="outline"
                className="h-11"
              >
                {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
              </Button>
            </form>

            {error && (
              <p className="text-sm text-red-500">{error}</p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Scanned URL — confirm import */}
      {scannedUrl && !importedContact && !isImporting && (
        <Card className="shadow-refined">
          <CardContent className="py-8 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-[#0a66c2] flex items-center justify-center mb-4">
              <Linkedin className="h-6 w-6 text-white" />
            </div>
            <p className="font-medium mb-1">LinkedIn profile found</p>
            <p className="text-sm text-muted-foreground mb-6 break-all">{scannedUrl}</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => { setScannedUrl(""); setError("") }}>
                Scan Again
              </Button>
              <Button
                onClick={() => handleImport(scannedUrl)}
                variant="copper"
              >
                Add as Contact
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Importing state */}
      {isImporting && (
        <Card className="shadow-refined">
          <CardContent className="py-12 flex flex-col items-center">
            <Loader2 className="h-8 w-8 text-[var(--copper-text)] animate-spin mb-3" />
            <p className="font-medium">Pulling profile details...</p>
          </CardContent>
        </Card>
      )}

      {/* Success — show contact + LinkedIn link */}
      {importedContact && (
        <Card className="shadow-refined">
          <CardContent className="py-8 flex flex-col items-center text-center">
            <div className="w-12 h-12 rounded-xl bg-green-500 flex items-center justify-center mb-4">
              <Check className="h-6 w-6 text-white" />
            </div>
            <p className="text-lg font-medium mb-1">{importedContact.name} added!</p>
            <p className="text-sm text-muted-foreground mb-6">
              Their profile details have been saved to your network.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Button variant="outline" asChild className="h-11 w-full sm:w-auto">
                <Link href={`/contact/${importedContact.id}`}>
                  View Contact
                </Link>
              </Button>
              <Button variant="outline" asChild className="h-11 w-full sm:w-auto">
                <a href={scannedUrl} target="_blank" rel="noopener noreferrer">
                  <Linkedin className="mr-2 h-4 w-4" />
                  Connect on LinkedIn
                  <ExternalLink className="ml-2 h-3 w-3" />
                </a>
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setScannedUrl("")
                  setManualUrl("")
                  setImportedContact(null)
                  setError("")
                }}
                className="h-11 w-full sm:w-auto"
              >
                Scan Another
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
