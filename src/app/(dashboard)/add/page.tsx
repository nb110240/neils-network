"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/toast"
import { Loader2, Sparkles, Lightbulb, User, Building2, MessageSquare, Calendar } from "lucide-react"

export default function AddContactPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const [rawNote, setRawNote] = useState("")
  const [isLoading, setIsLoading] = useState(false)

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

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="animate-fade-in">
        <h1 className="text-4xl font-normal tracking-tight">Add Contact</h1>
        <p className="text-muted-foreground mt-1 text-lg">
          Describe who you met and AI will organize the details.
        </p>
      </div>

      <Card className="glass shadow-refined-lg animate-fade-in stagger-1 opacity-0 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[var(--copper)]/5 via-transparent to-transparent pointer-events-none" />
        <CardHeader className="relative">
          <CardTitle className="flex items-center gap-3 text-xl font-normal">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[var(--copper)] to-[var(--copper-light)] flex items-center justify-center shadow-md">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            AI-Powered Entry
          </CardTitle>
          <CardDescription className="text-base mt-2">
            Write naturally about the person you met. Include any details you remember
            and our AI will automatically extract and organize the information.
          </CardDescription>
        </CardHeader>
        <CardContent className="relative">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              placeholder="Example: Met Sarah Chen at the AI conference last Tuesday. She's the VP of Engineering at TechCorp (sarah.chen@techcorp.com). We talked about their new machine learning platform and she mentioned they're hiring. Should follow up next week to send my portfolio."
              value={rawNote}
              onChange={(e) => setRawNote(e.target.value)}
              rows={8}
              className="resize-none text-base leading-relaxed transition-all focus:shadow-md"
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
                className="bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 shadow-md hover:shadow-lg border-0"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Sparkles className="mr-2 h-4 w-4" />
                    Add Contact
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card className="glass shadow-refined animate-fade-in stagger-2 opacity-0">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Lightbulb className="h-4 w-4 text-amber-500" />
            Tips for better results
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 text-sm text-muted-foreground">
            <div className="flex items-start gap-3">
              <User className="h-4 w-4 mt-0.5 text-[var(--copper)]/60" />
              <span>Full name and contact information (email, phone)</span>
            </div>
            <div className="flex items-start gap-3">
              <Building2 className="h-4 w-4 mt-0.5 text-[var(--copper)]/60" />
              <span>Company name and job title</span>
            </div>
            <div className="flex items-start gap-3">
              <MessageSquare className="h-4 w-4 mt-0.5 text-[var(--copper)]/60" />
              <span>Context: where you met, topics discussed, shared interests</span>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="h-4 w-4 mt-0.5 text-[var(--copper)]/60" />
              <span>Follow-up actions or things to remember</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
