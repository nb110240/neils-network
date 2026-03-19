"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/toast"
import { Loader2, MessageSquare, Calendar, Copy, Check, Crown } from "lucide-react"
import Link from "next/link"

interface DraftMessageButtonProps {
  contactId: string
  contactName: string
  plan: string
}

export function DraftMessageButton({ contactId, contactName, plan }: DraftMessageButtonProps) {
  const { addToast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [draft, setDraft] = useState("")
  const [draftType, setDraftType] = useState<"followup" | "meeting">("followup")
  const [copied, setCopied] = useState(false)

  const generateDraft = async (type: "followup" | "meeting") => {
    if (plan === "free") return
    setDraftType(type)
    setIsLoading(true)
    setDraft("")
    setIsOpen(true)

    try {
      const res = await fetch(`/api/contacts/${contactId}/draft`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setDraft(data.draft)
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate draft",
        variant: "destructive",
      })
      setIsOpen(false)
    } finally {
      setIsLoading(false)
    }
  }

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(draft)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    addToast({ title: "Copied to clipboard" })
  }

  if (plan === "free") {
    return (
      <div className="flex gap-2">
        <Button variant="outline" size="sm" asChild>
          <Link href="/pricing" className="flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4" />
            Draft Follow-Up
            <Crown className="h-3 w-3 text-[var(--copper)]" />
          </Link>
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => generateDraft("followup")}>
          <MessageSquare className="mr-1.5 h-4 w-4" />
          Draft Follow-Up
        </Button>
        <Button variant="outline" size="sm" onClick={() => generateDraft("meeting")}>
          <Calendar className="mr-1.5 h-4 w-4" />
          Schedule Meeting
        </Button>
      </div>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle>
              {draftType === "meeting"
                ? `Meeting request for ${contactName}`
                : `Follow-up for ${contactName}`}
            </DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex flex-col items-center py-8">
              <Loader2 className="h-6 w-6 text-[var(--copper)] animate-spin mb-3" />
              <p className="text-sm text-muted-foreground">Drafting your message...</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-muted/50 text-sm leading-relaxed whitespace-pre-wrap">
                {draft}
              </div>
              <p className="text-xs text-muted-foreground">
                Edit as needed, then copy and send via email, LinkedIn, or text.
              </p>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              Close
            </Button>
            {draft && (
              <>
                <Button variant="outline" onClick={() => generateDraft(draftType)}>
                  Regenerate
                </Button>
                <Button onClick={copyToClipboard} className="bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 border-0">
                  {copied ? (
                    <><Check className="mr-2 h-4 w-4" /> Copied</>
                  ) : (
                    <><Copy className="mr-2 h-4 w-4" /> Copy Message</>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
