"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/toast"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Loader2, Plus, Linkedin, Crown, ScanLine, Check, Edit2 } from "lucide-react"
import Link from "next/link"

export default function AddContactPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const [rawNote, setRawNote] = useState("")
  const [linkedinUrl, setLinkedinUrl] = useState("")
  const [linkedinNote, setLinkedinNote] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isLinkedinLoading, setIsLinkedinLoading] = useState(false)
  const [linkedinSuccess, setLinkedinSuccess] = useState<{ id: string; name: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rawNote.trim()) return

    setIsLoading(true)

    try {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_note: rawNote }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Failed to add contact")
      }

      const data = await response.json()

      addToast({
        title: "Contact added",
        description: `${data.contact?.name || "New contact"} has been added to your network.`,
      })

      router.push(`/contact/${data.contact.id}`)
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to add contact",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleLinkedinImport = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!linkedinUrl.trim()) return

    setIsLinkedinLoading(true)

    try {
      const response = await fetch("/api/contacts/linkedin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: linkedinUrl, note: linkedinNote }),
      })

      const data = await response.json()

      if (response.status === 409) {
        addToast({
          title: "Already in your network",
          description: data.message,
        })
        if (data.contactId) router.push(`/contact/${data.contactId}`)
        return
      }

      if (!response.ok) {
        throw new Error(data.message || "Failed to import from LinkedIn")
      }

      setLinkedinSuccess({
        id: data.contact.id,
        name: data.contact.name || "Contact",
      })
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to import from LinkedIn",
        variant: "destructive",
      })
    } finally {
      setIsLinkedinLoading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-4xl font-normal tracking-tight">Add Contact</h1>
        <p className="text-muted-foreground mt-1 text-lg">
          Describe who you met or paste a LinkedIn URL.
        </p>
      </div>

      {/* Natural language entry — primary method */}
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-normal">Describe who you met</CardTitle>
          <CardDescription className="text-base mt-1">
            Just type what you remember. AI extracts name, company, role, and next steps automatically.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              placeholder={`Example: Met John Doe at the AI Summit. He's VP of Engineering at SersweAI. We talked about their platform and he mentioned they're hiring. Should follow up next week.`}
              value={rawNote}
              onChange={(e) => setRawNote(e.target.value)}
              rows={6}
              className="resize-none text-base leading-relaxed"
            />
            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isLoading || !rawNote.trim()}
                className="bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 border-0"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Contact
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* Divider */}
      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-dashed" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-background px-3 text-sm text-muted-foreground font-medium">or import from LinkedIn</span>
        </div>
      </div>

      {/* LinkedIn Import */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-3 text-lg font-normal">
            <div className="w-9 h-9 rounded-lg bg-[#0a66c2] flex items-center justify-center">
              <Linkedin className="h-4 w-4 text-white" />
            </div>
            Add from LinkedIn
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLinkedinImport} className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-3">
              <Input
                placeholder="https://linkedin.com/in/johndoe"
                value={linkedinUrl}
                onChange={(e) => setLinkedinUrl(e.target.value)}
                className="flex-1 h-11"
              />
              <Button
                type="submit"
                disabled={isLinkedinLoading || !linkedinUrl.trim()}
                variant="outline"
                className="h-11"
              >
                {isLinkedinLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Import"
                )}
              </Button>
            </div>
            <Input
              placeholder="Add context: met at AI Summit, she's in product (optional)"
              value={linkedinNote}
              onChange={(e) => setLinkedinNote(e.target.value)}
              className="h-11"
            />
          </form>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              Name extracted from URL — add context for richer details
              <Link href="/pricing" className="inline-flex items-center gap-1 text-[var(--copper)] font-medium hover:underline">
                <Crown className="h-3 w-3" /> Pro
              </Link>
            </p>
            <Link href="/scan" className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--copper)] hover:underline">
              <ScanLine className="h-3 w-3" />
              Scan QR code
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* LinkedIn Success Dialog */}
      <Dialog open={!!linkedinSuccess} onOpenChange={(open) => { if (!open) setLinkedinSuccess(null) }}>
        <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-green-500 flex items-center justify-center">
                <Check className="h-4 w-4 text-white" />
              </div>
              Contact added!
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            <strong>{linkedinSuccess?.name}</strong> has been added to your network from LinkedIn. Add more details like how you met, their role, or any follow-up notes to make this contact more useful.
          </p>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setLinkedinSuccess(null)
                setLinkedinUrl("")
                setLinkedinNote("")
              }}
            >
              Add Another
            </Button>
            <Button
              onClick={() => {
                if (linkedinSuccess) router.push(`/contact/${linkedinSuccess.id}`)
              }}
              className="bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 border-0"
            >
              <Edit2 className="mr-2 h-4 w-4" />
              Edit & Add Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
