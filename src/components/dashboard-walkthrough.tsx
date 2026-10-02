"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Walkthrough, type WalkthroughStep } from "@/components/walkthrough"
import { type NetworkingGoal, GOAL_CONFIGS } from "@/lib/personalization"

function buildTourSteps(goal: NetworkingGoal | null): WalkthroughStep[] {
  const config = goal ? GOAL_CONFIGS[goal] : null

  return [
    {
      target: "[data-tour='next-moves']",
      title: "Your next moves",
      description: config
        ? `Promises first, then follow-ups, then people drifting. ${config.reachOutExplanation}`
        : "One prioritized list: promises you made come first, then follow-ups, then people drifting. When it's empty, you're caught up.",
      placement: "bottom",
    },
    {
      target: "[data-tour='stats-cold']",
      title: "Going cold, caught early",
      description: "Contacts who slip past their check-in rhythm land here and in your next moves. Zero means everyone is warm. Savvo keeps watching so you don't have to.",
      placement: "bottom",
    },
    {
      target: "[data-tour='add-contact-btn']",
      title: "Add contacts anytime",
      description: "After a meeting, just describe who you met in plain English. AI extracts name, company, role, and next steps automatically.",
      placement: "bottom",
      actionLabel: "Got it!",
    },
  ]
}

interface DashboardWalkthroughProps {
  contactCount: number
}

export function DashboardWalkthrough({ contactCount }: DashboardWalkthroughProps) {
  const [goal, setGoal] = useState<NetworkingGoal | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      const g = user?.user_metadata?.networking_goal as NetworkingGoal | undefined
      if (g) setGoal(g)
      setReady(true)
    })
  }, [])

  // Only show for users with 1-4 contacts who haven't seen the tour
  if (!ready || contactCount < 1 || contactCount >= 5) return null

  return (
    <Walkthrough
      steps={buildTourSteps(goal)}
      storageKey="savvo-dashboard-tour-complete"
      delay={800}
    />
  )
}
