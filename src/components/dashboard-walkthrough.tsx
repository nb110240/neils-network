"use client"

import { useState, useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { Walkthrough, type WalkthroughStep } from "@/components/walkthrough"
import { type NetworkingGoal, GOAL_CONFIGS } from "@/lib/personalization"

function buildTourSteps(goal: NetworkingGoal | null): WalkthroughStep[] {
  const config = goal ? GOAL_CONFIGS[goal] : null

  return [
    {
      target: "[data-tour='stats-reach-out']",
      title: "People who need attention",
      description: config?.reachOutExplanation ||
        "This shows contacts with pending follow-ups or relationships going cold. Savvo tracks this automatically based on when you last connected.",
      placement: "bottom",
    },
    {
      target: "[data-tour='stats-cold']",
      title: "Going cold warning",
      description: "When you haven't reached out in a while, contacts turn orange then red. This counter helps you catch drifting relationships before it's too late.",
      placement: "bottom",
    },
    {
      target: "[data-tour='reach-out-section']",
      title: "Your daily action list",
      description: config
        ? `Your prioritized reach-out list for ${config.label.toLowerCase()}. Follow-ups come first, then contacts going cold.`
        : "These are the people you should reach out to today, prioritized by urgency. Follow-ups come first, then cold contacts.",
      placement: "top",
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
