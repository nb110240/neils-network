import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, errorResponse } from "@/lib/api-utils"
import { getStripe, STRIPE_PRICE_MONTHLY, STRIPE_PRICE_YEARLY } from "@/lib/stripe"
import { getUserSubscription } from "@/lib/subscription"

export async function POST(request: Request) {
  try {
    const auth = await authenticateRequest("auth")
    if (authFailed(auth)) return auth.error
    const { user } = auth

    const body = await request.json().catch(() => ({}))
    const billing = body.billing === "yearly" ? "yearly" : "monthly"
    const priceId = billing === "yearly" ? STRIPE_PRICE_YEARLY : STRIPE_PRICE_MONTHLY

    const stripe = getStripe()

    // Validate the price exists and is active in Stripe
    const price = await stripe.prices.retrieve(priceId)
    if (!price || !price.active) {
      return errorResponse("Invalid or inactive price configuration")
    }

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
    return errorResponse("Failed to create checkout session")
  }
}
