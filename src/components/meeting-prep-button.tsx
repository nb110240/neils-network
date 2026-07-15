"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/toast"
import { BookOpen, Loader2, Copy, Check, Crown, ArrowUpRight } from "lucide-react"
import Link from "next/link"

export function MeetingPrepButton({ contactId }: { contactId: string }) {
  const { addToast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [brief, setBrief] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)

  const handleGenerate = async () => {
    setIsOpen(true)
    setIsLoading(true)
    setBrief(null)

    try {
      const response = await fetch(`/api/contacts/${contactId}/prep`, {
        method: "POST",
      })

      if (response.status === 403) {
        setIsOpen(false)
        setShowUpgrade(true)
        return
      }

      if (!response.ok) throw new Error("Failed to generate")

      const data = await response.json()
      setBrief(data.brief)
    } catch {
      addToast({
        title: "Couldn't generate meeting prep",
        description: "AI is having a moment. Try again.",
        variant: "destructive",
      })
      setIsOpen(false)
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!brief) return
    await navigator.clipboard.writeText(brief)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={handleGenerate}>
        <BookOpen className="mr-2 h-4 w-4" />
        Meeting Prep
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-lg max-w-[calc(100vw-2rem)] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle>Meeting Prep Brief</DialogTitle>
              {brief && (
                <Button variant="ghost" size="sm" onClick={handleCopy} className="h-7">
                  {copied ? (
                    <Check className="h-3.5 w-3.5 text-green-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5" />
                  )}
                </Button>
              )}
            </div>
          </DialogHeader>

          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-[var(--copper-text)] mb-3" />
              <p className="text-sm text-muted-foreground">Preparing your brief...</p>
            </div>
          ) : brief ? (
            <div className="prose prose-sm max-w-none text-sm leading-relaxed whitespace-pre-wrap">
              {brief}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={showUpgrade} onOpenChange={setShowUpgrade}>
        <DialogContent className="sm:max-w-md max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-[var(--copper)]/10 flex items-center justify-center">
                <Crown className="h-4 w-4 text-[var(--copper-text)]" />
              </div>
              Meeting prep is a Pro feature
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Upgrade to Pro to get AI-generated meeting prep briefs, plus follow-up drafts, unlimited contacts, and daily digest emails.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setShowUpgrade(false)}>
              Maybe later
            </Button>
            <Button asChild className="bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 border-0">
              <Link href="/pricing">
                <ArrowUpRight className="mr-2 h-4 w-4" />
                See Pro plans
              </Link>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
