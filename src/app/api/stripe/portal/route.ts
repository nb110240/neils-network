import { NextResponse } from "next/server"
import { authenticateRequest, authFailed, notFoundResponse, errorResponse } from "@/lib/api-utils"
import { getStripe } from "@/lib/stripe"
import { getUserSubscription } from "@/lib/subscription"

export async function POST() {
  try {
    const auth = await authenticateRequest("auth")
    if (authFailed(auth)) return auth.error
    const { user } = auth

    const stripe = getStripe()
    const sub = await getUserSubscription(user.id)
    if (!sub?.stripe_customer_id) {
      return notFoundResponse("No subscription found")
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    })

    return NextResponse.json({ url: session.url })
  } catch (error) {
    console.error("Portal error:", error)
    return errorResponse("Failed to create portal session")
  }
}
