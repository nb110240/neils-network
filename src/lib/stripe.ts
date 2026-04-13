import Stripe from "stripe"

export function getStripe(): Stripe {
  return new Stripe(process.env.STRIPE_SECRET_KEY!, {
    maxNetworkRetries: 3,
    timeout: 20000,
    httpClient: Stripe.createFetchHttpClient(),
  })
}

export const STRIPE_PRICE_MONTHLY = process.env.STRIPE_LAUNCH_PRICE_ID || process.env.STRIPE_PRO_PRICE_ID!
export const STRIPE_PRICE_YEARLY = process.env.STRIPE_LAUNCH_YEARLY_PRICE_ID || process.env.STRIPE_PRO_YEARLY_PRICE_ID!
