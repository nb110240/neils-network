"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { captureEvent } from "@/components/posthog-provider"
import {
  getTimeGreeting,
  inferCompanyFromEmail,
} from "@/lib/personalization"
import { Plus, ArrowRight, Upload, Network, FileText, CalendarDays } from "lucide-react"
import type { PlanType } from "@/lib/types"

interface WelcomeExperienceProps {
  userName: string | null
  userEmail: string | null
  plan: PlanType
}

/**
 * Empty-state dashboard for users with zero contacts.
 *
 * The fastest value path is a real meeting note. Adding/importing contacts and
 * connecting a calendar remain available as quiet alternatives.
 */
export function WelcomeExperience({
  userName,
  userEmail,
  plan,
}: WelcomeExperienceProps) {
  const firstName = userName?.split(" ")[0]
  const company = inferCompanyFromEmail(userEmail || undefined)
  const timeGreeting = getTimeGreeting()

  const greeting = firstName ? `${timeGreeting}, ${firstName}` : timeGreeting

  const subtitle = company
    ? `Turn your latest investor conversation for ${company} into the right next move.`
    : "Turn your latest investor conversation into the right next move."

  return (
    <div className="max-w-2xl mx-auto py-12 sm:py-20 animate-fade-in">
      <div className="text-center">
        <h1 className="text-3xl sm:text-4xl font-normal tracking-tight mb-3">
          {greeting}
        </h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto leading-relaxed mb-8">
          {subtitle}
        </p>

        <div className="flex flex-col items-center gap-3">
          <Button
            asChild
            variant="copper"
            className="h-14 px-10 text-base shadow-lg hover:shadow-xl transition-all"
          >
            <Link
              href="/capture"
              id="onboarding-add-cta"
              onClick={() => captureEvent("welcome_capture_clicked")}
            >
              <FileText className="mr-2.5 h-5 w-5" />
              Paste meeting notes
              <ArrowRight className="ml-2.5 h-5 w-5" />
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            Savvo extracts promises and a follow-up. You approve every change.
          </p>
          <div className="mt-2 flex flex-wrap items-center justify-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="min-h-11 px-3 text-muted-foreground hover:text-[var(--copper-text)]"
            >
              <Link href="/add" onClick={() => captureEvent("welcome_add_contact_clicked")}>
                <Plus className="mr-2 h-4 w-4" />
                Add a person
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild className="min-h-11 px-3 text-muted-foreground hover:text-[var(--copper-text)]">
              <Link href="/import">
                <Upload className="mr-2 h-4 w-4" /> Import a CSV
              </Link>
            </Button>
            <Button variant="ghost" size="sm" asChild className="min-h-11 px-3 text-muted-foreground hover:text-[var(--copper-text)]">
              <Link href={plan === "free" ? "/pricing" : "/settings"}>
                <CalendarDays className="mr-2 h-4 w-4" /> Connect calendar
              </Link>
            </Button>
          </div>
        </div>

        {/* Privacy reassurance — one line, not a card competing for attention */}
        <p className="mt-10 inline-flex items-center gap-2 text-xs text-muted-foreground">
          <Network className="h-3.5 w-3.5 text-[var(--copper-text)]" />
          Your data stays private. No social scraping, no contact sharing.
        </p>
      </div>
    </div>
  )
}
