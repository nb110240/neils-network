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

function paidPlan(sub: Subscription | null): PlanType | null {
  if (!sub) return null
  if (sub.status !== "active") return null
  if (sub.current_period_end && new Date(sub.current_period_end) < new Date()) return null
  return sub.plan === "free" ? null : (sub.plan as PlanType)
}

/** Pro time earned through referrals, independent of billing. */
export async function getProCreditUntil(userId: string): Promise<Date | null> {
  const supabase = await createServiceClient()
  const { data } = await supabase
    .from("pro_credits")
    .select("pro_until")
    .eq("user_id", userId)
    .maybeSingle()
  return data?.pro_until ? new Date(data.pro_until) : null
}

export interface PlanDetails {
  plan: PlanType
  /**
   * A live Stripe subscription (active or past_due) exists: billing changes
   * belong in the portal, even while referral credit is what grants Pro.
   */
  hasBillingAccount: boolean
  /** "subscription" = Stripe/RevenueCat; "credit" = referral Pro credit. */
  source: "subscription" | "credit" | null
  proCreditUntil: Date | null
}

export async function getPlanDetails(userId: string): Promise<PlanDetails> {
  const [sub, creditUntil] = await Promise.all([
    getUserSubscription(userId),
    getProCreditUntil(userId),
  ])
  const activeCredit = creditUntil && creditUntil > new Date() ? creditUntil : null
  const hasBillingAccount =
    !!sub?.stripe_subscription_id && (sub.status === "active" || sub.status === "past_due")
  const paid = paidPlan(sub)
  if (paid) return { plan: paid, source: "subscription", proCreditUntil: activeCredit, hasBillingAccount }
  if (activeCredit) return { plan: "pro", source: "credit", proCreditUntil: activeCredit, hasBillingAccount }
  return { plan: "free", source: null, proCreditUntil: null, hasBillingAccount }
}

export async function getUserPlan(userId: string): Promise<PlanType> {
  return (await getPlanDetails(userId)).plan
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
    .is("archived_at", null)

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
