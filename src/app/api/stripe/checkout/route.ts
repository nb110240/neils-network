import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getStripe, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY } from "@/lib/stripe"
import { getUserSubscription } from "@/lib/subscription"
import { rateLimit, rateLimitHeaders } from "@/lib/rate-limit"

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 })
    }

    // Rate limit: 10 checkout attempts per minute
    const rl = await rateLimit(user.id, "auth")
    if (!rl.success) {
      return NextResponse.json(
        { message: "Too many requests. Please slow down." },
        { status: 429, headers: rateLimitHeaders(rl) }
      )
    }

    const body = await request.json().catch(() => ({}))
    const billing = body.billing === "yearly" ? "yearly" : "monthly"
    const priceId = billing === "yearly" ? STRIPE_PRICE_YEARLY : STRIPE_PRICE_MONTHLY

    const stripe = getStripe()
    const sub = await getUserSubscription(user.id)

    // If user already has a Stripe customer, reuse it
    let customerId = sub?.stripe_customer_id

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      })
      customerId = customer.id
    }

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true`,
      cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
      metadata: { user_id: user.id },
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("Checkout error:", error)
    return NextResponse.json(
      { message: "Failed to create checkout session" },
      { status: 500 }
    )
  }
}
