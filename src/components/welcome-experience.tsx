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
      {/* Welcome header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl sm:text-4xl font-normal tracking-tight mb-2">{greeting}</h1>
        <p className="text-muted-foreground text-lg max-w-md mx-auto leading-relaxed">
          {subtitle}
        </p>
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

      {/* Primary CTA */}
      <div className="flex flex-col items-center gap-3 mb-10">
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

      {/* What you get — product capability showcase */}
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-4 w-4 text-[var(--copper)]" />
          <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            What you get
          </h2>
        </div>

        {/* Capability 1: AI extraction */}
        <div className="rounded-xl border bg-white dark:bg-stone-900 p-5 shadow-refined">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--copper)]/10 flex items-center justify-center shrink-0">
              <Plus className="h-5 w-5 text-[var(--copper)]" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold mb-1">Type what you remember — AI does the rest</h3>
              <div className="rounded-lg border p-3 text-xs text-stone-500 dark:text-stone-400 italic mt-2">
                &ldquo;Met Sarah at TechCrunch. Partner at Sequoia, focused on B2B SaaS. Should send deck next week.&rdquo;
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {[{ l: "Name", v: "Sarah Chen" }, { l: "Company", v: "Sequoia" }, { l: "Next step", v: "Send deck" }].map((f) => (
                  <div key={f.l} className="text-xs">
                    <span className="text-muted-foreground">{f.l}</span>
                    <p className="font-medium text-stone-800 dark:text-stone-200">{f.v}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Capability 2: Health scores */}
        <div className="rounded-xl border bg-white dark:bg-stone-900 p-5 shadow-refined">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-950/30 flex items-center justify-center shrink-0">
              <span className="text-lg">🌡️</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold mb-1">Health scores show who needs attention</h3>
              <p className="text-xs text-muted-foreground mb-2">Every contact gets a color that updates automatically.</p>
              <div className="flex gap-3">
                {[
                  { color: "bg-green-500", label: "Active", sub: "< 30 days" },
                  { color: "bg-yellow-400", label: "Cooling", sub: "31-90d" },
                  { color: "bg-orange-500", label: "Cold", sub: "91-180d" },
                  { color: "bg-red-500", label: "At risk", sub: "180d+" },
                ].map((h) => (
                  <div key={h.label} className="flex items-center gap-1.5">
                    <span className={`w-2.5 h-2.5 rounded-full ${h.color}`} />
                    <div>
                      <p className="text-[11px] font-medium text-stone-700 dark:text-stone-300">{h.label}</p>
                      <p className="text-[10px] text-muted-foreground">{h.sub}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Capability 3: Daily digest + Reach out */}
        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-xl border bg-white dark:bg-stone-900 p-5 shadow-refined">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-950/30 flex items-center justify-center shrink-0">
                <span className="text-sm">📧</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-1">Daily digest</h3>
                <p className="text-xs text-muted-foreground">Every morning: who needs attention, with context and a link to reconnect.</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white dark:bg-stone-900 p-5 shadow-refined">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-100 dark:bg-purple-950/30 flex items-center justify-center shrink-0">
                <span className="text-sm">🔍</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-1">Smart search</h3>
                <p className="text-xs text-muted-foreground">&ldquo;Who do I know in fintech?&rdquo; — search by meaning, not just names.</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white dark:bg-stone-900 p-5 shadow-refined">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center shrink-0">
                <span className="text-sm">✍️</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-1">AI follow-up drafts</h3>
                <p className="text-xs text-muted-foreground">One tap to draft a personalized message. AI reads your history and writes naturally.</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border bg-white dark:bg-stone-900 p-5 shadow-refined">
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-100 dark:bg-emerald-950/30 flex items-center justify-center shrink-0">
                <span className="text-sm">📋</span>
              </div>
              <div>
                <h3 className="text-sm font-semibold mb-1">Import from spreadsheet</h3>
                <p className="text-xs text-muted-foreground">Upload a CSV or connect Google Contacts. Your existing network in 30 seconds.</p>
              </div>
            </div>
          </div>
        </div>

        {/* Capability 4: Dashboard preview */}
        <div className="rounded-xl border bg-white dark:bg-stone-900 p-5 shadow-refined">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--copper)]/10 flex items-center justify-center shrink-0">
              <span className="text-lg">📊</span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold mb-1">Your daily dashboard</h3>
              <p className="text-xs text-muted-foreground mb-3">See your network at a glance — who&apos;s active, who&apos;s going cold, who needs a follow-up.</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="p-2.5 rounded-lg bg-stone-50 dark:bg-stone-800">
                  <p className="text-[10px] text-muted-foreground">Contacts</p>
                  <p className="text-lg font-normal text-stone-800 dark:text-stone-200">—</p>
                </div>
                <div className="p-2.5 rounded-lg bg-stone-50 dark:bg-stone-800">
                  <p className="text-[10px] text-muted-foreground">Reach Out</p>
                  <p className="text-lg font-normal text-[var(--copper)]">—</p>
                </div>
                <div className="p-2.5 rounded-lg bg-stone-50 dark:bg-stone-800">
                  <p className="text-[10px] text-muted-foreground">Going Cold</p>
                  <p className="text-lg font-normal text-red-500">—</p>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">Add your first contact and watch these numbers come alive.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Privacy reassurance */}
      <div className="mt-8 text-center">
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
