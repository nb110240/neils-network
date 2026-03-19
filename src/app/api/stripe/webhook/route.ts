import { NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe"
import { createServiceClient } from "@/lib/supabase/server"
import Stripe from "stripe"

export async function POST(request: Request) {
  const body = await request.text()
  const sig = request.headers.get("stripe-signature")

  if (!sig) {
    return NextResponse.json({ message: "Missing signature" }, { status: 400 })
  }

  const stripe = getStripe()

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET!
    )
  } catch (err) {
    console.error("Webhook signature verification failed:", err)
    return NextResponse.json({ message: "Invalid signature" }, { status: 400 })
  }

  const supabase = await createServiceClient()

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session
      const userId = session.metadata?.user_id
      if (!userId) break

      const subscription = await stripe.subscriptions.retrieve(
        session.subscription as string
      ) as unknown as { id: string; current_period_end: number; status: string }

      await supabase.from("subscriptions").upsert(
        {
          user_id: userId,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscription.id,
          plan: "pro",
          status: "active",
          current_period_end: new Date(
            subscription.current_period_end * 1000
          ).toISOString(),
        },
        { onConflict: "user_id" }
      )
      break
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as unknown as { id: string; current_period_end: number; status: string }
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("stripe_subscription_id", subscription.id)
        .single()

      if (sub) {
        const isActive = ["active", "trialing"].includes(subscription.status)
        await supabase
          .from("subscriptions")
          .update({
            status: isActive ? "active" : "canceled",
            plan: isActive ? "pro" : "free",
            current_period_end: new Date(
              subscription.current_period_end * 1000
            ).toISOString(),
          })
          .eq("id", sub.id)
      }
      break
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as unknown as { id: string }
      await supabase
        .from("subscriptions")
        .update({ status: "canceled", plan: "free" })
        .eq("stripe_subscription_id", subscription.id)
      break
    }
  }

  return NextResponse.json({ received: true })
}
