"use client"

import { useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/toast"
import { ArrowLeft, Loader2, Send, CheckCircle, MessageSquare } from "lucide-react"

const TOPICS = [
  "Bug report",
  "Feature request",
  "Account issue",
  "Billing question",
  "General feedback",
  "Other",
]

export default function SupportPage() {
  const { addToast } = useToast()
  const [subject, setSubject] = useState("")
  const [message, setMessage] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [isSent, setIsSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!subject || !message.trim()) return

    setIsLoading(true)
    try {
      const res = await fetch("/api/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject, message: message.trim() }),
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Failed to send message")

      setIsSent(true)
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to send message",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isSent) {
    return (
      <div className="max-w-lg mx-auto">
        <Card className="shadow-refined">
          <CardContent className="py-16 flex flex-col items-center text-center">
            <div className="w-14 h-14 rounded-2xl bg-green-500 flex items-center justify-center mb-4">
              <CheckCircle className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-2xl font-normal mb-2">Thank you for contacting support</h1>
            <p className="text-muted-foreground max-w-sm">
              We&apos;ve received your message and will get back to you shortly via email.
            </p>
            <div className="flex gap-3 mt-8">
              <Button variant="outline" onClick={() => { setIsSent(false); setSubject(""); setMessage("") }}>
                Send Another Message
              </Button>
              <Button variant="copper" asChild>
                <Link href="/dashboard">Back to Dashboard</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard" className="inline-flex items-center gap-1 py-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" />
          Dashboard
        </Link>
        <div>
          <h1 className="text-3xl font-normal tracking-tight">Contact Support</h1>
          <p className="text-muted-foreground">We typically respond within 24 hours</p>
        </div>
      </div>

      <Card className="shadow-refined">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-normal">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            Send us a message
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium" id="support-topic-label">Topic</p>
              <div className="flex flex-wrap gap-2" role="group" aria-labelledby="support-topic-label">
                {TOPICS.map((topic) => (
                  <button
                    key={topic}
                    type="button"
                    onClick={() => setSubject(topic)}
                    aria-pressed={subject === topic}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all border ${
                      subject === topic
                        ? "bg-[var(--copper)] text-white border-[var(--copper)]"
                        : "border-border hover:border-[var(--copper)]/30 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {topic}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <label htmlFor="message" className="text-sm font-medium">Message</label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Describe your issue or feedback..."
                rows={5}
                className="resize-none text-base leading-relaxed"
              />
            </div>
            <Button
              type="submit"
              disabled={isLoading || !subject || message.trim().length < 5}
              variant="copper"
            >
              {isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Send Message
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
