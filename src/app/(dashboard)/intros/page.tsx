"use client"

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/ui/toast"
import { ArrowLeft, ArrowRight, Copy, Check, Loader2, Sparkles, Users, RefreshCw } from "lucide-react"

interface IntroSuggestion {
  contact1_id: string
  contact2_id: string
  contact1_name: string
  contact2_name: string
  contact1_company: string | null
  contact2_company: string | null
  reason: string
  intro_template: string
}

export default function IntrosPage() {
  const { addToast } = useToast()
  const [suggestions, setSuggestions] = useState<IntroSuggestion[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasLoaded, setHasLoaded] = useState(false)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const loadSuggestions = async () => {
    setIsLoading(true)
    setMessage(null)
    try {
      const response = await fetch("/api/intros")

      if (response.status === 403) {
        setMessage("Intro suggestions require Savvo Pro.")
        return
      }

      if (!response.ok) throw new Error("Failed")

      const data = await response.json()
      setSuggestions(data.suggestions || [])
      if (data.message) setMessage(data.message)
      setHasLoaded(true)
    } catch {
      addToast({
        title: "Error",
        description: "Failed to generate intro suggestions",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleCopy = async (text: string, idx: number) => {
    await navigator.clipboard.writeText(text)
    setCopiedIdx(idx)
    setTimeout(() => setCopiedIdx(null), 2000)
  }

  // Initial state — show CTA to generate
  if (!hasLoaded && !isLoading) {
    return (
      <div className="space-y-8">
        <div className="animate-fade-in">
          <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
            <ArrowLeft className="h-3.5 w-3.5" />
            Dashboard
          </Link>
          <h1 className="text-4xl font-normal tracking-tight">Intro Suggestions</h1>
          <p className="text-muted-foreground mt-1 text-lg">
            AI-powered recommendations for who in your network should know each other.
          </p>
        </div>

        <Card className="shadow-refined">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <div className="w-16 h-16 rounded-2xl bg-[var(--copper)]/10 flex items-center justify-center mb-6">
              <Sparkles className="h-8 w-8 text-[var(--copper)]" />
            </div>
            <h3 className="text-xl font-normal mb-2">Find valuable introductions</h3>
            <p className="text-muted-foreground text-center max-w-md mb-8">
              We&apos;ll analyze your contacts&apos; industries, roles, and shared interests to suggest
              introductions that create mutual value.
            </p>
            <Button
              onClick={loadSuggestions}
              className="bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 border-0 h-12 px-8 text-base"
            >
              <Sparkles className="mr-2 h-5 w-5" />
              Generate Suggestions
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="animate-fade-in">
        <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-4">
          <ArrowLeft className="h-3.5 w-3.5" />
          Dashboard
        </Link>
      </div>
      <div className="flex items-start justify-between animate-fade-in">
        <div>
          <h1 className="text-4xl font-normal tracking-tight">Intro Suggestions</h1>
          <p className="text-muted-foreground mt-1 text-lg">
            People in your network who should know each other.
          </p>
        </div>
        <Button variant="outline" onClick={loadSuggestions} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Refresh
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="shadow-refined">
              <CardContent className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-4 w-8" />
                  <Skeleton className="h-10 w-10 rounded-full" />
                  <Skeleton className="h-4 w-48" />
                </div>
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4 mt-2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : message && suggestions.length === 0 ? (
        <Card className="shadow-refined">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">{message}</p>
          </CardContent>
        </Card>
      ) : suggestions.length === 0 ? (
        <Card className="shadow-refined">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Users className="h-8 w-8 text-muted-foreground mb-3" />
            <p className="text-muted-foreground">
              No strong intro suggestions found. Add more contacts with detailed notes to improve results.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {suggestions.map((s, idx) => (
            <Card key={idx} className="shadow-refined">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-medium flex items-center gap-3">
                  <Link
                    href={`/contact/${s.contact1_id}`}
                    className="text-[var(--copper)] hover:underline"
                  >
                    {s.contact1_name}
                  </Link>
                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  <Link
                    href={`/contact/${s.contact2_id}`}
                    className="text-[var(--copper)] hover:underline"
                  >
                    {s.contact2_name}
                  </Link>
                </CardTitle>
                {(s.contact1_company || s.contact2_company) && (
                  <p className="text-sm text-muted-foreground">
                    {[s.contact1_company, s.contact2_company].filter(Boolean).join(" & ")}
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm">{s.reason}</p>
                <div className="bg-muted/50 rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Draft intro message
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 px-2"
                      onClick={() => handleCopy(s.intro_template, idx)}
                    >
                      {copiedIdx === idx ? (
                        <Check className="h-3 w-3 text-green-600" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground italic">
                    {s.intro_template}
                  </p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
