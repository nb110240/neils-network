import { createServiceClient } from "@/lib/supabase/server"
import { PLAN_LIMITS, type PlanType, type Subscription } from "@/lib/types"

// All subscription reads use service role since the subscriptions table
// has NO user-facing RLS policies (users cannot read/write their own sub).

export async function getUserSubscription(userId: string): Promise<Subscription | null> {
  const supabase = await createServiceClient()
  const { data } = await supabase
    .from("subscriptions")
    .select("*")
    .eq("user_id", userId)
    .single()
  return data
}

export async function getUserPlan(userId: string): Promise<PlanType> {
  const sub = await getUserSubscription(userId)
  if (!sub) return "free"
  if (sub.status !== "active") return "free"
  if (sub.current_period_end && new Date(sub.current_period_end) < new Date()) return "free"
  return sub.plan as PlanType
}

export function getPlanLimits(plan: PlanType) {
  return PLAN_LIMITS[plan]
}

export async function checkContactLimit(userId: string): Promise<{ allowed: boolean; plan: PlanType; count: number; limit: number }> {
  const plan = await getUserPlan(userId)
  const limits = getPlanLimits(plan)

  // Use service role to get accurate count (bypasses any RLS caching)
  const supabase = await createServiceClient()
  const { count } = await supabase
    .from("contacts")
    .select("*", { count: "exact", head: true })
    .eq("created_by", userId)

  const currentCount = count || 0
  return {
    allowed: currentCount < limits.maxContacts,
    plan,
    count: currentCount,
    limit: limits.maxContacts,
  }
}

export async function checkSemanticSearchLimit(userId: string): Promise<{ allowed: boolean; used: number; limit: number; plan: PlanType }> {
  const plan = await getUserPlan(userId)
  const limits = getPlanLimits(plan)

  if (limits.semanticSearchLimit === Infinity) {
    return { allowed: true, used: 0, limit: Infinity, plan }
  }

  // Count semantic searches this month using Upstash (or allow if no Redis)
  // We track via a simple counter in the search_usage table
  const supabase = await createServiceClient()
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const { count } = await supabase
    .from("search_usage")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("searched_at", startOfMonth.toISOString())

  const used = count || 0
  return {
    allowed: used < limits.semanticSearchLimit,
    used,
    limit: limits.semanticSearchLimit,
    plan,
  }
}

export async function recordSemanticSearch(userId: string): Promise<void> {
  const supabase = await createServiceClient()
  await supabase.from("search_usage").insert({ user_id: userId })
}
