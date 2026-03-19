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
import { BookOpen, Loader2, Copy, Check } from "lucide-react"

export function MeetingPrepButton({ contactId }: { contactId: string }) {
  const { addToast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [brief, setBrief] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  const handleGenerate = async () => {
    setIsOpen(true)
    setIsLoading(true)
    setBrief(null)

    try {
      const response = await fetch(`/api/contacts/${contactId}/prep`, {
        method: "POST",
      })

      if (response.status === 403) {
        addToast({
          title: "Pro feature",
          description: "Meeting prep briefs require Savvo Pro.",
          variant: "destructive",
        })
        setIsOpen(false)
        return
      }

      if (!response.ok) throw new Error("Failed to generate")

      const data = await response.json()
      setBrief(data.brief)
    } catch {
      addToast({
        title: "Error",
        description: "Failed to generate meeting prep",
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
              <Loader2 className="h-6 w-6 animate-spin text-[var(--copper)] mb-3" />
              <p className="text-sm text-muted-foreground">Preparing your brief...</p>
            </div>
          ) : brief ? (
            <div className="prose prose-sm max-w-none text-sm leading-relaxed whitespace-pre-wrap">
              {brief}
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
