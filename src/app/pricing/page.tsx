"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { createClient } from "@/lib/supabase/client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/ui/toast"
import { Check, X, Loader2, ArrowLeft } from "lucide-react"

const features = [
  { name: "Contacts", free: "50", pro: "Unlimited", team: "Unlimited" },
  { name: "Health scores", free: true, pro: true, team: true },
  { name: "Natural language input", free: true, pro: true, team: true },
  { name: "Semantic search", free: "5/month", pro: "Unlimited", team: "Unlimited" },
  { name: "Import (CSV & Gmail)", free: false, pro: true, team: true },
  { name: "Google Calendar sync", free: false, pro: true, team: true },
  { name: "Digest emails", free: "Weekly", pro: "Daily", team: "Daily" },
  { name: "Shared contact graph", free: false, pro: false, team: true },
  { name: "Team intro requests", free: false, pro: false, team: true },
  { name: "Admin dashboard", free: false, pro: false, team: true },
]

export default function PricingPage() {
  const router = useRouter()
  const { addToast } = useToast()
  const supabase = createClient()
  const [isLoading, setIsLoading] = useState(false)
  const [billing, setBilling] = useState<"monthly" | "yearly">("monthly")
  // null = still checking. /pricing is publicly reachable, so default to the
  // logged-out treatment until auth is confirmed.
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsAuthed(!!user)
    })
  }, [supabase])

  const handleUpgrade = async () => {
    // Logged-out visitors can reach /pricing directly. Calling the
    // authenticated checkout endpoint for them returns 401 and dead-ends
    // them with an error toast — route them into signup instead.
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push("/login?mode=signup")
      return
    }

    setIsLoading(true)
    try {
      // Native (iOS): Apple Guideline 3.1.1 requires In-App Purchase for digital
      // goods, so route the upgrade through RevenueCat instead of Stripe. Web
      // falls through to Stripe Checkout below.
      const { isNative } = await import("@/lib/native/capacitor")
      if (isNative()) {
        const { configurePurchases, purchasePro } = await import(
          "@/lib/native/purchases"
        )
        await configurePurchases(user.id)
        const result = await purchasePro(billing)
        if (result.ok) {
          addToast({
            title: "You're on Pro",
            description: "Your upgrade is active.",
          })
          router.push("/dashboard")
          router.refresh()
        } else if (result.error && result.error !== "cancelled") {
          addToast({
            title: "Error",
            description: result.error,
            variant: "destructive",
          })
        }
        setIsLoading(false)
        return
      }

      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billing }),
      })
      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || data.message || "Failed to start checkout")
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch (error) {
      addToast({
        title: "Error",
        description: error instanceof Error ? error.message : "Something went wrong",
        variant: "destructive",
      })
      setIsLoading(false)
    }
  }

  // Launch promo until June 1, 2026: $5/mo (was $8), $50/yr (was $75)
  const isLaunchPromo = new Date() < new Date("2026-06-01")
  const price = billing === "monthly"
    ? (isLaunchPromo ? 5 : 8)
    : (isLaunchPromo ? 50 : 75)
  const originalPrice = isLaunchPromo
    ? (billing === "monthly" ? 8 : 75)
    : null
  const perMonth = billing === "monthly" ? price : Math.round((price / 12) * 100) / 100
  const monthlyEquivalent = isLaunchPromo ? 5 : 8
  const yearlySavings = Math.round((1 - (isLaunchPromo ? 50 : 75) / ((isLaunchPromo ? 5 : 8) * 12)) * 100)
  const savings = billing === "yearly" ? yearlySavings : 0

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto py-12 px-4 max-w-5xl">
        <div className="mb-6">
          <Button variant="ghost" size="sm" asChild>
            <Link href={isAuthed ? "/dashboard" : "/"}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              {isAuthed ? "Back to Dashboard" : "Back to home"}
            </Link>
          </Button>
        </div>

        <div className="text-center mb-12">
          <h1 className="text-4xl font-normal tracking-tight mb-2">
            Never let a relationship drift
          </h1>
          <p className="text-lg text-muted-foreground max-w-lg mx-auto">
            Simple pricing. Start free, upgrade when you need more.
          </p>

          {/* Billing toggle */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-6">
            <button
              onClick={() => setBilling("monthly")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                billing === "monthly"
                  ? "bg-[var(--copper)]/10 text-[var(--copper)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling("yearly")}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${
                billing === "yearly"
                  ? "bg-[var(--copper)]/10 text-[var(--copper)]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yearly
              <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-900/30 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                Save {yearlySavings}%
              </span>
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto">
          {/* Free Plan */}
          <Card className="shadow-refined">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl font-normal">Free</CardTitle>
              <div className="mt-2">
                <span className="text-4xl font-normal">$0</span>
                <span className="text-muted-foreground">/month</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                {features.map((f) => (
                  <li key={f.name} className="flex items-center gap-3 text-sm">
                    {f.free ? (
                      <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    )}
                    <span className={!f.free ? "text-muted-foreground/60" : ""}>
                      {f.name}
                      {typeof f.free === "string" && ` (${f.free})`}
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                className="w-full"
                onClick={() =>
                  router.push(isAuthed ? "/dashboard" : "/login?mode=signup")
                }
              >
                {isAuthed ? "Current Plan" : "Get started free"}
              </Button>
            </CardContent>
          </Card>

          {/* Pro Plan */}
          <Card className="shadow-refined-lg border-[var(--copper)]/30 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)]" />
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl font-normal">Pro</CardTitle>
              <div className="mt-2">
                {isLaunchPromo && billing === "monthly" && (
                  <span className="text-xl text-muted-foreground line-through mr-2">${originalPrice}</span>
                )}
                <span className="text-4xl font-normal">${price}</span>
                <span className="text-muted-foreground">
                  /{billing === "monthly" ? "month" : "year"}
                </span>
              </div>
              {isLaunchPromo && (
                <p className="text-sm text-emerald-600 dark:text-emerald-400 font-medium mt-1">
                  Launch price — ends June 2026
                </p>
              )}
              {billing === "yearly" && !isLaunchPromo && (
                <p className="text-sm text-muted-foreground mt-1">
                  ${perMonth}/mo &middot; Save ${96 - 75}/year
                </p>
              )}
              {billing === "yearly" && isLaunchPromo && (
                <p className="text-sm text-muted-foreground mt-1">
                  ${perMonth}/mo
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                {features.map((f) => (
                  <li key={f.name} className="flex items-center gap-3 text-sm">
                    {f.pro ? (
                      <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    )}
                    <span className={!f.pro ? "text-muted-foreground/60" : ""}>
                      {f.name}
                      {typeof f.pro === "string" && ` (${f.pro})`}
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                className="w-full bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 shadow-md border-0"
                onClick={handleUpgrade}
                disabled={isLoading}
              >
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Upgrade to Pro
              </Button>
            </CardContent>
          </Card>

          {/* Team Plan */}
          <Card className="shadow-refined relative overflow-hidden">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl font-normal">Team</CardTitle>
              <div className="mt-2">
                <span className="text-4xl font-normal">$12</span>
                <span className="text-muted-foreground">/user/mo</span>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                Everything in Pro, plus collaboration
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-3">
                {features.map((f) => (
                  <li key={f.name} className="flex items-center gap-3 text-sm">
                    {f.team ? (
                      <Check className="h-4 w-4 text-emerald-500 shrink-0" />
                    ) : (
                      <X className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                    )}
                    <span className={!f.team ? "text-muted-foreground/60" : ""}>
                      {f.name}
                      {typeof f.team === "string" && ` (${f.team})`}
                    </span>
                  </li>
                ))}
              </ul>
              <Button
                variant="outline"
                className="w-full"
                disabled
              >
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
