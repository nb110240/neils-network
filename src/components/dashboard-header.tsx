"use client"

import { useEffect, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { type NetworkingGoal, GOAL_CONFIGS, getTimeGreeting } from "@/lib/personalization"

interface DashboardHeaderProps {
  /** Fallback name from server */
  userName: string | null
}

export function DashboardHeader({ userName }: DashboardHeaderProps) {
  const [greeting, setGreeting] = useState("Welcome back")
  const [subtitle, setSubtitle] = useState("Here's your network overview.")

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return

      const name = user.user_metadata?.full_name || userName
      const goal = user.user_metadata?.networking_goal as NetworkingGoal | undefined
      const firstName = name?.split(" ")[0]

      // Time-of-day + name greeting
      const timeGreet = getTimeGreeting()
      setGreeting(firstName ? `${timeGreet}, ${firstName}` : timeGreet)

      // Goal-aware subtitle
      if (goal && GOAL_CONFIGS[goal]) {
        setSubtitle(GOAL_CONFIGS[goal].dashboardContext + ".")
      }
    })
  }, [userName])

  return (
    <div>
      <h1 className="text-4xl font-normal tracking-tight">{greeting}</h1>
      <p className="text-muted-foreground mt-1 text-lg">{subtitle}</p>
    </div>
  )
}
