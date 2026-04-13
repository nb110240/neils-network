"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import {
  type NetworkingGoal,
  GOAL_OPTIONS,
  GOAL_CONFIGS,
  getTimeGreeting,
  inferCompanyFromEmail,
} from "@/lib/personalization"
import {
  Plus,
  ArrowRight,
  Upload,
  Sparkles,
  Network,
  Check,
} from "lucide-react"

interface WelcomeExperienceProps {
  userName: string | null
  userEmail: string | null
  plan: string
}

export function WelcomeExperience({ userName, userEmail, plan }: WelcomeExperienceProps) {
  const router = useRouter()
  const [selectedGoal, setSelectedGoal] = useState<NetworkingGoal | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  const firstName = userName?.split(" ")[0]
  const company = inferCompanyFromEmail(userEmail || undefined)
  const timeGreeting = getTimeGreeting()

  const greeting = firstName
    ? `${timeGreeting}, ${firstName}`
    : timeGreeting

  const subtitle = company
    ? `Let's set up your network manager${company ? ` for your work at ${company}` : ""}.`
    : "Let's set up your personal network manager."

  const goalConfig = selectedGoal ? GOAL_CONFIGS[selectedGoal] : null

  async function handleGoalSelect(goal: NetworkingGoal) {
    setSelectedGoal(goal)
    setIsSaving(true)
    const supabase = createClient()
    await supabase.auth.updateUser({
      data: { networking_goal: goal },
    })
    setIsSaving(false)
  }

  return (
    <div className="max-w-3xl mx-auto py-6 sm:py-12 animate-fade-in">
      {/* Welcome header + Primary CTA */}
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-normal tracking-tight mb-2">{greeting}</h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto leading-relaxed mb-6">
          {subtitle}
        </p>
        <div className="flex flex-col items-center gap-3">
          <Button
            asChild
            className="bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 border-0 h-14 px-10 text-base shadow-lg hover:shadow-xl transition-all"
          >
            <Link href="/add" id="onboarding-add-cta">
              <Plus className="mr-2.5 h-5 w-5" />
              Add your first contact
              <ArrowRight className="ml-2.5 h-5 w-5" />
            </Link>
          </Button>
          <p className="text-xs text-muted-foreground">
            Takes 10 seconds — just describe who you met
          </p>
          {plan === "pro" && (
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground hover:text-[var(--copper)]">
              <Link href="/import">
                <Upload className="mr-2 h-4 w-4" />
                Or import existing contacts
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Goal picker */}
      <div className="mb-8">
        <p className="text-sm font-medium text-center mb-4">
          What are you primarily networking for?
        </p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {GOAL_OPTIONS.map((option) => {
            const isSelected = selectedGoal === option.value
            return (
              <button
                key={option.value}
                onClick={() => handleGoalSelect(option.value)}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all duration-200 ${
                  isSelected
                    ? "border-[var(--copper)] bg-[var(--copper)]/5 shadow-sm"
                    : "border-stone-200 dark:border-stone-800 hover:border-stone-300 dark:hover:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-900/50"
                }`}
              >
                <span className="text-lg shrink-0">{option.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium ${isSelected ? "text-[var(--copper)]" : ""}`}>
                    {option.label}
                  </p>
                </div>
                {isSelected && (
                  <div className="h-5 w-5 rounded-full bg-[var(--copper)] flex items-center justify-center shrink-0">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Personalized tagline */}
      {goalConfig && (
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--copper)]/10 text-[var(--copper)] text-sm font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            {goalConfig.tagline}
          </div>
        </div>
      )}

      {/* How it works — quick 3-step explainer */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider text-center">
          How it works
        </h2>

        <div className="grid sm:grid-cols-3 gap-3">
          <div className="rounded-xl border bg-white dark:bg-stone-900 p-4 shadow-refined text-center">
            <div className="w-9 h-9 rounded-xl bg-[var(--copper)]/10 flex items-center justify-center mx-auto mb-2">
              <Plus className="h-4 w-4 text-[var(--copper)]" />
            </div>
            <h3 className="text-sm font-semibold mb-1">1. Describe who you met</h3>
            <p className="text-xs text-muted-foreground">Type what you remember. AI extracts name, company, role, and next steps.</p>
          </div>

          <div className="rounded-xl border bg-white dark:bg-stone-900 p-4 shadow-refined text-center">
            <div className="w-9 h-9 rounded-xl bg-green-100 dark:bg-green-950/30 flex items-center justify-center mx-auto mb-2">
              <span className="text-sm">🌡️</span>
            </div>
            <h3 className="text-sm font-semibold mb-1">2. We track the health</h3>
            <p className="text-xs text-muted-foreground">Each contact gets a health score. Green is active, red means it&apos;s time to reconnect.</p>
          </div>

          <div className="rounded-xl border bg-white dark:bg-stone-900 p-4 shadow-refined text-center">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center mx-auto mb-2">
              <span className="text-sm">📧</span>
            </div>
            <h3 className="text-sm font-semibold mb-1">3. Never lose touch</h3>
            <p className="text-xs text-muted-foreground">Daily digest tells you who needs attention. AI drafts the follow-up message.</p>
          </div>
        </div>
      </div>

      {/* Jumpstart framing */}
      <p className="text-xs text-center text-muted-foreground mt-6">
        This is your quick-start screen. Once you add a contact, your dashboard will show your network overview.
      </p>

      {/* Privacy reassurance */}
      <div className="mt-4 text-center">
        <div className="inline-flex items-center gap-3 px-4 py-2.5 rounded-xl bg-stone-50 dark:bg-stone-900/50 border border-stone-100 dark:border-stone-800">
          <Network className="h-4 w-4 text-[var(--copper)]" />
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">Your data stays private.</span> No social login scraping. No contact sharing. Just you and your network.
          </p>
        </div>
      </div>
    </div>
  )
}
