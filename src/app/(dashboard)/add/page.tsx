"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
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
import { Loader2, Plus, Linkedin, Crown, ScanLine, Check, Edit2, ArrowUpRight } from "lucide-react"
import Link from "next/link"
import { type NetworkingGoal, GOAL_CONFIGS } from "@/lib/personalization"
import { Celebration, useFirstContactCelebration } from "@/components/celebration"
import { trackContactsCreated } from "@/components/posthog-provider"
import { isOfflineQueuedResponse } from "@/lib/offline-queue"

const DEFAULT_PLACEHOLDER = `Example: Met John Doe at the AI Summit. He's VP of Engineering at Acme Corp. We talked about their platform and he mentioned they're hiring. Should follow up next week.`

export default function AddContactPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const [rawNote, setRawNote] = useState("")
  // Shown when the API could not find a name in the note (422 needs_name).
  const [needsName, setNeedsName] = useState(false)
  const [contactName, setContactName] = useState("")
  const [linkedinUrl, setLinkedinUrl] = useState("")
  const [linkedinNote, setLinkedinNote] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isLinkedinLoading, setIsLinkedinLoading] = useState(false)
  const [linkedinSuccess, setLinkedinSuccess] = useState<{ id: string; name: string } | null>(null)
  const [showUpgradePrompt, setShowUpgradePrompt] = useState(false)
  const [placeholder, setPlaceholder] = useState(DEFAULT_PLACEHOLDER)
  const { showCelebration, triggerIfFirst, onComplete: onCelebrationComplete } = useFirstContactCelebration()

  // Load personalized placeholder from user's networking goal
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      const goal = user?.user_metadata?.networking_goal as NetworkingGoal | undefined
      if (goal && GOAL_CONFIGS[goal]) {
        setPlaceholder(GOAL_CONFIGS[goal].addContactPlaceholder)
      }
    })
  }, [])

  // The name prompt answers the note that produced it. Editing the note
  // drops the prompt so a stale name cannot override the edited note's name.
  const handleNoteChange = (value: string) => {
    setRawNote(value)
    if (needsName) {
      setNeedsName(false)
      setContactName("")
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!rawNote.trim()) return

    setIsLoading(true)

    try {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raw_note: rawNote,
          ...(needsName && contactName.trim() ? { name: contactName.trim() } : {}),
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        // No name found in the note (or AI extraction failed). Nothing was
        // saved; ask for the name instead of creating an unnamed contact.
        if (response.status === 422 && payload.needs_name) {
          setNeedsName(true)
          if (!contactName.trim() && typeof payload.suggested_name === "string") {
            setContactName(payload.suggested_name)
          }
          setIsLoading(false)
          return
        }
        // 409 name-mismatch conflict from the auto-merge safety check.
        // Surface the structured message so the user can decide whether
        // to force-create (skip_dedup) or open the matched contact.
        if (response.status === 409 && payload.conflict) {
          addToast({
            title: "Possible duplicate found",
            description:
              payload.message ||
              `Matches "${payload.candidate?.contactName ?? "existing contact"}". Review before saving.`,
            variant: "destructive",
          })
          setIsLoading(false)
          return
        }
        throw new Error(payload.error || payload.message || "Failed to add contact")
      }

      const data = await response.json()

      // Offline: the service worker queued the note and answered for the
      // server, so there is no contact (or id) yet. Stay here, ready for the
      // next note; it syncs when the connection returns.
      if (isOfflineQueuedResponse(data)) {
        addToast({
          title: "Saved offline",
          description: "We'll add this contact as soon as you're back online.",
        })
        setRawNote("")
        setNeedsName(false)
        setContactName("")
        return
      }

      // Handle merged response — note was added to existing contact
      if (data.merged) {
        addToast({
          title: "Added to existing contact",
          description: data.message || "Your note was added to a matching contact.",
        })
        router.push(`/contact/${data.contactId}`)
        return
      }

      const c = data.contact
      const extractedParts = [c?.name, c?.company, c?.job_title].filter(Boolean)
      addToast({
        title: "Contact added",
        description: extractedParts.length > 0
          ? `Extracted: ${extractedParts.join(" · ")}. Review and edit on the next page.`
          : `${c?.name || "New contact"} has been added. Review details on the next page.`,
      })

      // Check if this was the user's first contact — celebrate!
      const isFirstEver = localStorage.getItem("savvo-first-contact-celebrated") !== "true"
      trackContactsCreated("natural_language", 1, { first: isFirstEver })
      if (isFirstEver) {
        triggerIfFirst(1)
        // Let confetti play before navigating
        setTimeout(() => router.push(`/contact/${data.contact.id}`), 1800)
      } else {
        router.push(`/contact/${data.contact.id}`)
      }
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
          description: data.error || data.message,
        })
        if (data.contactId) router.push(`/contact/${data.contactId}`)
        return
      }

      if (response.status === 403) {
        setShowUpgradePrompt(true)
        return
      }

      if (!response.ok) {
        throw new Error(data.error || data.message || "Failed to import from LinkedIn")
      }

      trackContactsCreated("linkedin")
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
      <Celebration show={showCelebration} onComplete={onCelebrationComplete} />
      <div>
        <h1 className="text-4xl font-normal tracking-tight">Add Contact</h1>
        <p className="text-muted-foreground mt-1 text-lg">
          Describe who you met, and AI extracts the details. You can always edit after.
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
              aria-label="Describe who you met"
              placeholder={placeholder}
              value={rawNote}
              onChange={(e) => handleNoteChange(e.target.value)}
              rows={6}
              className="resize-none text-base leading-relaxed"
            />
            {needsName && (
              <div className="space-y-2 rounded-lg border border-stone-200 bg-stone-50 p-4 dark:border-stone-700 dark:bg-stone-800">
                <label htmlFor="add-contact-name" className="text-sm font-medium text-stone-900 dark:text-stone-100">
                  Who is this?
                </label>
                <p className="text-sm text-stone-700 dark:text-stone-300">
                  We couldn&apos;t find a name in your note. Add one and we&apos;ll save the rest.
                </p>
                <Input
                  id="add-contact-name"
                  autoFocus
                  placeholder="Full name"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  maxLength={200}
                  className="bg-white dark:bg-stone-900"
                />
              </div>
            )}
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
                disabled={isLoading || !rawNote.trim() || (needsName && !contactName.trim())}
                variant="copper"
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
            <Input
              aria-label="LinkedIn profile URL"
              placeholder="https://linkedin.com/in/johndoe"
              value={linkedinUrl}
              onChange={(e) => setLinkedinUrl(e.target.value)}
              className="h-11"
            />
            <Input
              aria-label="Context for LinkedIn contact"
              placeholder="Add context: met at AI Summit, she's in product (optional)"
              value={linkedinNote}
              onChange={(e) => setLinkedinNote(e.target.value)}
              className="h-11"
            />
            <Button
              type="submit"
              disabled={isLinkedinLoading || !linkedinUrl.trim()}
              variant="outline"
              className="h-11 w-full sm:w-auto"
            >
              {isLinkedinLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Import from LinkedIn"
              )}
            </Button>
          </form>
          <div className="flex items-center justify-between mt-2">
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              Name extracted from URL. Add context for richer details.
              <Link href="/pricing" className="inline-flex items-center gap-1 py-1 text-[var(--copper-text)] font-medium hover:underline">
                <Crown className="h-3 w-3" /> Pro
              </Link>
            </p>
            <Link href="/scan" className="inline-flex items-center gap-1.5 py-1 text-xs font-medium text-[var(--copper-text)] hover:underline">
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
              variant="copper"
            >
              <Edit2 className="mr-2 h-4 w-4" />
              Edit & Add Details
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Upgrade to Pro prompt */}
      <Dialog open={showUpgradePrompt} onOpenChange={setShowUpgradePrompt}>
        <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[var(--copper)]/10 flex items-center justify-center">
                <Crown className="h-4 w-4 text-[var(--copper-text)]" />
              </div>
              LinkedIn import is a Pro feature
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Upgrade to Pro to import contacts directly from LinkedIn URLs, plus get AI drafts, meeting prep, calendar sync, and unlimited contacts.
          </p>
          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button
              variant="outline"
              onClick={() => setShowUpgradePrompt(false)}
            >
              Maybe later
            </Button>
            <Button
              asChild
              variant="copper"
            >
              <Link href="/pricing">
                <ArrowUpRight className="mr-2 h-4 w-4" />
                See Pro plans
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
