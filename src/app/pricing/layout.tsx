import type { Metadata } from "next"

// The pricing page is a client component, so its metadata lives in this layout.
export const metadata: Metadata = {
  title: "Pricing",
  description:
    "Simple investor CRM pricing for founders. Start free with 50 contacts and health scores, or go Pro for $8/month with unlimited contacts, daily digests, and every AI feature.",
  alternates: { canonical: "/pricing" },
  openGraph: {
    title: "Pricing | Savvo",
    description:
      "Simple investor CRM pricing. Free plan with 50 contacts, Pro at $8/month with unlimited contacts and every AI feature.",
    url: "/pricing",
  },
}

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
