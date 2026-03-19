import Stripe from "stripe"

let _stripe: Stripe | null = null

export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY!)
  }
  return _stripe
}

export const STRIPE_PRICE_MONTHLY = process.env.STRIPE_LAUNCH_PRICE_ID || process.env.STRIPE_PRO_PRICE_ID!
export const STRIPE_PRICE_YEARLY = process.env.STRIPE_LAUNCH_YEARLY_PRICE_ID || process.env.STRIPE_PRO_YEARLY_PRICE_ID!
