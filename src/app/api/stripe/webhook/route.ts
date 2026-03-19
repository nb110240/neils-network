import { NextResponse } from "next/server"
import { getStripe } from "@/lib/stripe"
import { createServiceClient } from "@/lib/supabase/server"
import Stripe from "stripe"
import { log } from "@/lib/logger"

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
    log("error", "Webhook signature verification failed", { action: "stripe.webhook", route: "/api/stripe/webhook", error: String(err) })
    return NextResponse.json({ message: "Invalid signature" }, { status: 400 })
  }

  const supabase = await createServiceClient()

  log("info", "Stripe webhook received", {
    action: "stripe.webhook",
    route: "/api/stripe/webhook",
    eventType: event.type,
  })

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
      log("info", "Checkout completed, subscription activated", {
        action: "stripe.checkout_completed",
        route: "/api/stripe/webhook",
        userId,
        customerId: session.customer as string,
        subscriptionId: subscription.id,
      })
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
      log("info", "Subscription deleted", {
        action: "stripe.subscription_deleted",
        route: "/api/stripe/webhook",
        subscriptionId: subscription.id,
      })
      break
    }
  }

  return NextResponse.json({ received: true })
}
