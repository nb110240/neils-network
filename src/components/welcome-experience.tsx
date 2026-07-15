"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { captureEvent } from "@/components/posthog-provider"
import {
  getTimeGreeting,
  inferCompanyFromEmail,
} from "@/lib/personalization"
import { Plus, ArrowRight, Upload, Network } from "lucide-react"

interface WelcomeExperienceProps {
  userName: string | null
  userEmail: string | null
  plan: string
}

/**
 * Empty-state dashboard for users with zero contacts.
 *
 * Single-action by design: the only thing a new user should be deciding is
 * "do I click the button or not." Goal picker and how-it-works grid were
 * removed (2026-05-28) because they competed visually with the CTA and were
 * the activation-overwhelm complaint in user feedback #1.
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
    ? `Let's set up your network manager for your work at ${company}.`
    : "Let's set up your personal network manager."

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
            className="bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 border-0 h-14 px-10 text-base shadow-lg hover:shadow-xl transition-all"
          >
            <Link
              href="/add"
              id="onboarding-add-cta"
              onClick={() => captureEvent("welcome_cta_clicked")}
            >
              <Plus className="mr-2.5 h-5 w-5" />
              Add your first contact
              <ArrowRight className="ml-2.5 h-5 w-5" />
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            Takes 10 seconds. Just describe who you met.
          </p>
          {plan !== "free" && (
            <Button
              variant="ghost"
              size="sm"
              asChild
              className="text-muted-foreground hover:text-[var(--copper-text)]"
            >
              <Link href="/import">
                <Upload className="mr-2 h-4 w-4" />
                Or import existing contacts
              </Link>
            </Button>
          )}
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
