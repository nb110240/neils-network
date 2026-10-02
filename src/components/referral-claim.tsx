"use client"

import { useEffect } from "react"
import { createClient } from "@/lib/supabase/client"
import { claimReferralOnce } from "@/lib/referral-claim"

/**
 * Claims a pending referral on the first authenticated dashboard load. Covers
 * sign-ins that never pass through /auth/callback (native iOS, autoconfirm).
 */
export function ReferralClaim() {
  useEffect(() => {
    let cancelled = false
    void createClient()
      .auth.getSession()
      .then(({ data }) => {
        if (!cancelled) return claimReferralOnce(data.session?.user)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  return null
}
