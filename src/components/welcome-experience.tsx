"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
  ThermometerSnowflake,
  Mail,
  Search,
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
  const [hoveredFeature, setHoveredFeature] = useState<number | null>(null)

  const firstName = userName?.split(" ")[0]
  const company = inferCompanyFromEmail(userEmail || undefined)
  const timeGreeting = getTimeGreeting()

  // Personalized greeting
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

    // Save to Supabase user_metadata for instant client-side access
    const supabase = createClient()
    await supabase.auth.updateUser({
      data: { networking_goal: goal },
    })

    setIsSaving(false)
  }

  const features = [
    {
      icon: Plus,
      title: "AI-powered contact capture",
      description: goalConfig
        ? goalConfig.featureHighlights[0]
        : "Type messy notes from a meeting. AI extracts name, company, role, and follow-ups.",
      color: "var(--copper)",
    },
    {
      icon: ThermometerSnowflake,
      title: "Relationship health scores",
      description: goalConfig
        ? goalConfig.featureHighlights[1]
        : "Every contact gets a health score. Green is active, red means going cold.",
      color: "#22c55e",
    },
    {
      icon: Mail,
      title: "Daily digest emails",
      description: "Wake up knowing exactly who needs your attention today.",
      color: "#3b82f6",
    },
    {
      icon: Search,
      title: "Search by context",
      description: "\"Who was that person at the conference?\" — search by what you remember.",
      color: "#a855f7",
    },
  ]

  return (
    <div className="max-w-2xl mx-auto py-8 sm:py-16 animate-fade-in">
      {/* Welcome header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-normal tracking-tight mb-2">{greeting}</h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto leading-relaxed">
          {subtitle}
        </p>
      </div>

      {/* Goal picker — single question */}
      <div className="mb-10">
        <p className="text-sm font-medium text-center mb-4">
          What are you primarily networking for?
        </p>
        <div className="grid gap-2 sm:grid-cols-2">
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
                  <p className="text-xs text-muted-foreground">{option.description}</p>
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

      {/* Personalized tagline after selection */}
      {goalConfig && (
        <div className="text-center mb-8 animate-fade-in">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-[var(--copper)]/10 text-[var(--copper)] text-sm font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            {goalConfig.tagline}
          </div>
        </div>
      )}

      {/* Primary CTA */}
      <div className="flex flex-col items-center gap-3 mb-12">
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

      {/* How it works — feature cards */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-[var(--copper)]" />
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {goalConfig ? `How Savvo helps with ${goalConfig.label.toLowerCase()}` : "How Savvo works"}
          </h2>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {features.map((feature, i) => {
            const Icon = feature.icon
            const isHovered = hoveredFeature === i
            return (
              <Card
                key={i}
                className={`shadow-refined transition-all duration-200 cursor-default ${
                  isHovered ? "shadow-md scale-[1.02]" : ""
                }`}
                onMouseEnter={() => setHoveredFeature(i)}
                onMouseLeave={() => setHoveredFeature(null)}
              >
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className="h-9 w-9 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor: `color-mix(in srgb, ${feature.color} 12%, transparent)`,
                      }}
                    >
                      <Icon className="h-4 w-4" style={{ color: feature.color }} />
                    </div>
                    <div>
                      <h3 className="text-sm font-medium leading-tight mb-1">{feature.title}</h3>
                      <p className="text-xs text-muted-foreground leading-relaxed">{feature.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      </div>

      {/* Privacy reassurance */}
      <div className="mt-10 text-center">
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
