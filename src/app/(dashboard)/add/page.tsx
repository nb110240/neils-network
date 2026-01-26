"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/components/ui/toast"
import { Loader2, Sparkles } from "lucide-react"

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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Add Contact</h1>
        <p className="text-muted-foreground">
          Write free-form notes about your new contact. AI will extract the details.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-yellow-500" />
            AI-Powered Entry
          </CardTitle>
          <CardDescription>
            Just describe the person you met. Include any details like their name,
            company, how you met, and any follow-up actions. Our AI will
            automatically extract and organize the information.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Textarea
              placeholder="Example: Met Sarah Chen at the AI conference last Tuesday. She's the VP of Engineering at TechCorp (sarah.chen@techcorp.com). We talked about their new machine learning platform and she mentioned they're hiring. Should follow up next week to send my portfolio."
              value={rawNote}
              onChange={(e) => setRawNote(e.target.value)}
              rows={8}
              className="resize-none"
            />
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isLoading || !rawNote.trim()}>
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

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Tips for better results</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>Include details like:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Full name and contact information</li>
            <li>Company and job title</li>
            <li>Where and when you met</li>
            <li>Topics you discussed</li>
            <li>Any follow-up actions needed</li>
            <li>Personal notes or conversation highlights</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  )
}
