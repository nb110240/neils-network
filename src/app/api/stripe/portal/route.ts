import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getStripe } from "@/lib/stripe"
import { getUserSubscription } from "@/lib/subscription"
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    const rl = await rateLimit(user.id, "auth")
    if (!rl.success) {
      return NextResponse.json(
        { message: "Too many requests. Please slow down." },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    const stripe = getStripe()
    const sub = await getUserSubscription(user.id)
    if (!sub?.stripe_customer_id) {
      return NextResponse.json({ message: "No subscription found" }, { status: 404 })
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("Portal error:", error)
    return NextResponse.json(
      { message: "Failed to create portal session" },
      { status: 500 }
    )
  }
}
