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
import { BookOpen, Loader2, Copy, Check, Crown, ArrowUpRight, ExternalLink, RefreshCw } from "lucide-react"
import Link from "next/link"

interface ResearchCitation {
  number: number
  url: string
  title: string
}

interface ResearchReport {
  summary: string
  citations: ResearchCitation[]
  model: string
  generated_at: string
}

function ResearchText({ report }: { report: ResearchReport }) {
  const citationMap = new Map(report.citations.map((citation) => [citation.number, citation]))
  return (
    <div className="whitespace-pre-wrap text-sm leading-relaxed text-stone-800 dark:text-stone-200">
      {report.summary.split(/(\[\d+\])/).map((part, index) => {
        const match = part.match(/^\[(\d+)\]$/)
        const citation = match ? citationMap.get(Number(match[1])) : null
        return citation ? (
          <a
            key={`${part}-${index}`}
            href={citation.url}
            target="_blank"
            rel="noreferrer"
            aria-label={`Source ${citation.number}: ${citation.title}`}
            className="mx-0.5 font-semibold text-[var(--copper-text)] underline underline-offset-2"
          >
            [{citation.number}]
          </a>
        ) : <span key={`${part}-${index}`}>{part}</span>
      })}
    </div>
  )
}

export function MeetingPrepButton({ contactId }: { contactId: string }) {
  const { addToast } = useToast()
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [brief, setBrief] = useState<string | null>(null)
  const [research, setResearch] = useState<ResearchReport | null>(null)
  const [researchWarning, setResearchWarning] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [showUpgrade, setShowUpgrade] = useState(false)

  const handleGenerate = async (refreshResearch = false) => {
    setIsOpen(true)
    setIsLoading(true)
    setBrief(null)
    setResearch(null)
    setResearchWarning(null)

    try {
      const response = await fetch(`/api/contacts/${contactId}/prep${refreshResearch ? "?refresh=1" : ""}`, {
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
      setResearch(data.research || null)
      setResearchWarning(data.researchWarning || null)
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
    const researchText = research
      ? `\n\nPublic research (${new Date(research.generated_at).toLocaleDateString()}):\n${research.summary}\n\nSources:\n${research.citations.map((citation) => `[${citation.number}] ${citation.title}: ${citation.url}`).join("\n")}`
      : ""
    await navigator.clipboard.writeText(`${brief}${researchText}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => handleGenerate()}>
        <BookOpen className="mr-2 h-4 w-4" />
        Meeting Prep
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-2xl max-w-[calc(100vw-2rem)] max-h-[85vh] overflow-y-auto">
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
            <div className="space-y-6">
              <section aria-labelledby="crm-context-heading">
                <h3 id="crm-context-heading" className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--copper-text)]">Your CRM context</h3>
                <div className="prose prose-sm max-w-none whitespace-pre-wrap text-sm leading-relaxed">
                  {brief}
                </div>
              </section>

              <section aria-labelledby="public-research-heading" className="border-t pt-5">
                <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 id="public-research-heading" className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--copper-text)]">Public investor research</h3>
                    {research && (
                      <p className="mt-1 text-xs text-muted-foreground">Searched {new Date(research.generated_at).toLocaleString()}. Verify important details before your meeting.</p>
                    )}
                  </div>
                  <Button type="button" variant="outline" size="sm" onClick={() => handleGenerate(true)}>
                    <RefreshCw className="mr-2 h-3.5 w-3.5" /> Refresh
                  </Button>
                </div>
                {research ? (
                  <div className="space-y-4">
                    <ResearchText report={research} />
                    <div>
                      <p className="mb-2 text-xs font-semibold text-stone-700 dark:text-stone-300">Sources</p>
                      <ol className="space-y-1.5 text-xs text-muted-foreground">
                        {research.citations.map((citation) => (
                          <li key={citation.number}>
                            <a href={citation.url} target="_blank" rel="noreferrer" className="inline-flex items-start gap-1 text-[var(--copper-text)] underline underline-offset-2">
                              <span>[{citation.number}] {citation.title}</span><ExternalLink className="mt-0.5 h-3 w-3 shrink-0" />
                            </a>
                          </li>
                        ))}
                      </ol>
                    </div>
                  </div>
                ) : (
                  <p className="rounded-lg border bg-stone-50 p-3 text-sm text-stone-700 dark:bg-stone-900/50 dark:text-stone-300">
                    {researchWarning || "No public research available."}
                  </p>
                )}
              </section>
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
            <Button variant="copper" asChild>
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
