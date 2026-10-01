import Link from "next/link"
import { Check, Circle, FileText, Sparkles, Upload, CalendarDays, ArrowRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import type { PlanType } from "@/lib/types"

interface OnboardingChecklistProps {
  contactCount: number
  calendarConnected: boolean
  reviewCount: number
  pendingReviewCount: number
  actionCount: number
  moveCount: number
  plan: PlanType
}

export function OnboardingChecklist({
  contactCount,
  calendarConnected,
  reviewCount,
  pendingReviewCount,
  actionCount,
  moveCount,
  plan,
}: OnboardingChecklistProps) {
  const hasContext = contactCount >= 5 || calendarConnected || reviewCount > 0
  const hasInteraction = reviewCount > 0
  const hasApprovedAction = actionCount > 0
  if (hasApprovedAction || (moveCount > 0 && contactCount >= 5) || contactCount >= 10) return null

  const steps = [
    { label: "Bring in real context", complete: hasContext },
    { label: "Capture one investor interaction", complete: hasInteraction },
    { label: "Approve your first next move", complete: hasApprovedAction },
  ]
  const completed = steps.filter((step) => step.complete).length
  const primary = pendingReviewCount > 0
    ? { href: "/inbox", label: "Review your next move" }
    : { href: "/capture", label: "Paste meeting notes" }

  return (
    <Card className="overflow-hidden border-[var(--copper)]/25 shadow-refined">
      <div className="h-1 bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)]" />
      <CardContent className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0 flex-1">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--copper)]/10">
                <Sparkles className="h-4 w-4 text-[var(--copper-text)]" />
              </div>
              <div>
                <h2 className="text-lg font-semibold">Get a real next move in under 10 minutes</h2>
                <p className="mt-1 text-sm text-muted-foreground">Use your own investor context. Savvo will not change or send anything until you approve it.</p>
              </div>
            </div>
            <ol className="mt-5 grid gap-3 sm:grid-cols-3" aria-label={`${completed} of ${steps.length} activation steps complete`}>
              {steps.map((step) => (
                <li key={step.label} className="flex items-center gap-2 text-sm">
                  {step.complete
                    ? <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--copper)]"><Check className="h-3 w-3 text-white" /></span>
                    : <Circle className="h-5 w-5 text-stone-400 dark:text-stone-500" />}
                  <span className={step.complete ? "text-muted-foreground line-through" : "font-medium"}>{step.label}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="flex shrink-0 flex-col gap-2 sm:flex-row lg:flex-col">
            <Button asChild className="min-h-11 bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] border-0">
              <Link href={primary.href}><FileText className="mr-2 h-4 w-4" />{primary.label}<ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <div className="flex gap-1">
              <Button variant="ghost" size="sm" className="min-h-11" asChild>
                <Link href="/import"><Upload className="mr-2 h-4 w-4" />Import a CSV</Link>
              </Button>
              <Button variant="ghost" size="sm" className="min-h-11" asChild>
                <Link href={plan === "free" ? "/pricing" : "/settings"}><CalendarDays className="mr-2 h-4 w-4" />Calendar</Link>
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
