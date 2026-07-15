import type { Metadata, Viewport } from "next"
import { Suspense } from "react"
import { DM_Sans, DM_Serif_Display, Geist_Mono } from "next/font/google"
import { ToastProvider } from "@/components/ui/toast"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { ServiceWorkerRegistrar } from "@/components/sw-registrar"
import { PostHogProvider } from "@/components/posthog-provider"
import { NativeBootstrap } from "@/components/native-bootstrap"
import "./globals.css"

const dmSans = DM_Sans({
  variable: "--font-dm-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
})

const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: ["400"],
})

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
})

export const metadata: Metadata = {
  title: {
    default: "Savvo | The investor CRM for founders raising a round",
    template: "%s | Savvo",
  },
  description: "Type what you remember after every pitch. Savvo tracks who you met, who is going cold, and who is waiting on a follow-up, so nothing slips. Works as a personal CRM for your broader network too.",
  manifest: "/manifest.json",
  metadataBase: new URL("https://savvo.app"),
  openGraph: {
    title: "Savvo | Run your raise without a spreadsheet",
    description: "The investor CRM for founders running a fundraise. Type what you remember after every pitch and Savvo tracks who you met, who is going cold, and who is waiting on a follow-up.",
    url: "https://savvo.app",
    siteName: "Savvo",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Savvo | Run your raise without a spreadsheet",
    description: "The investor CRM for founders. Type what you remember after each pitch, track who you met, who is going cold, and who needs a follow-up.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Savvo",
  },
  icons: {
    icon: [
      { url: "/favicon.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon.svg", type: "image/svg+xml" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#c2410c",
  width: "device-width",
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": "https://savvo.app/#organization",
        name: "Savvo",
        url: "https://savvo.app",
        logo: "https://savvo.app/logo.svg",
        description: "The investor CRM for founders raising a round. Tracks investor relationships, follow-ups, and intros. Also works as a personal CRM for VCs and professional networkers.",
        founder: {
          "@type": "Person",
          name: "Neil Bajaj",
          email: "neil@savvo.app",
          sameAs: ["https://x.com/neilbajaj"],
        },
        contactPoint: {
          "@type": "ContactPoint",
          email: "neil@savvo.app",
          contactType: "customer support",
        },
      },
      {
        "@type": "SoftwareApplication",
        "@id": "https://savvo.app/#app",
        name: "Savvo",
        applicationCategory: "BusinessApplication",
        operatingSystem: "Web",
        description: "The investor CRM for founders raising a round. Type what you remember after every pitch and Savvo tracks investor relationships, follow-ups, and context. Health scores, semantic search, and daily digest reminders keep the raise moving.",
        url: "https://savvo.app",
        provider: { "@id": "https://savvo.app/#organization" },
        offers: [
          {
            "@type": "Offer",
            name: "Free",
            price: "0",
            priceCurrency: "USD",
            description: "50 contacts, health scores, weekly digest, 5 semantic searches/month",
          },
          {
            "@type": "Offer",
            name: "Pro",
            price: "8",
            priceCurrency: "USD",
            billingIncrement: "month" as string,
            description: "Unlimited contacts, daily digest, unlimited search, all AI features",
          },
        ],
        featureList: [
          "Natural language contact capture",
          "Relationship health scores",
          "Semantic search",
          "Daily digest emails",
          "AI follow-up drafts",
          "LinkedIn QR code import",
          "CSV and Google Contacts import",
          "Google Calendar sync",
          "Relationship graph",
          "AI intro suggestions",
        ],
      },
      {
        "@type": "WebSite",
        "@id": "https://savvo.app/#website",
        url: "https://savvo.app",
        name: "Savvo",
        publisher: { "@id": "https://savvo.app/#organization" },
      },
      {
        "@type": "FAQPage",
        "@id": "https://savvo.app/#faq",
        mainEntity: [
          { "@type": "Question", name: "What is Savvo?", acceptedAnswer: { "@type": "Answer", text: "Savvo is an AI-powered personal CRM built for founders, VCs, and professional networkers. You add contacts by typing what you remember about someone and Savvo automatically extracts their name, company, role, and follow-up actions. Every contact gets a health score that tracks how fresh the relationship is." } },
          { "@type": "Question", name: "How does the health score work?", acceptedAnswer: { "@type": "Answer", text: "Every contact gets a color-coded health score based on when you last interacted. Green means active (within 30 days), yellow means cooling (31-90 days), orange means going cold (91-180 days), and red means at risk (180+ days)." } },
          { "@type": "Question", name: "Is my data private and secure?", acceptedAnswer: { "@type": "Answer", text: "Yes. Savvo uses Supabase with PostgreSQL and row-level security. All data is encrypted in transit and at rest. We never sell your data or share contacts with other users. AI providers process data only for features you choose, and you can export or delete everything at any time." } },
          { "@type": "Question", name: "How is Savvo different from a spreadsheet?", acceptedAnswer: { "@type": "Answer", text: "Spreadsheets require manual data entry and structure. Savvo lets you type naturally and AI handles the structure. Plus you get automatic health scores, follow-up reminders, and semantic search to find people by context, not just names." } },
          { "@type": "Question", name: "Can I import my existing contacts?", acceptedAnswer: { "@type": "Answer", text: "Yes. Pro users can import via CSV upload (works with any spreadsheet export) or connect Google Contacts for a one-click import. Savvo automatically deduplicates during import." } },
          { "@type": "Question", name: "How much does Savvo cost?", acceptedAnswer: { "@type": "Answer", text: "Free plan includes 50 contacts, health scores, and weekly digest. Pro is $8/month (or $75/year) with unlimited contacts, daily digests, unlimited search, all AI features, and import capabilities." } },
          { "@type": "Question", name: "Who is Savvo built for?", acceptedAnswer: { "@type": "Answer", text: "Savvo is built for people whose network is their most valuable professional asset: startup founders, VCs, community builders, and sales professionals who meet many people and struggle to keep every connection warm." } },
        ],
      },
    ],
  }

  return (
    <html lang="en" translate="no" suppressHydrationWarning>
      <head>
        <meta name="google" content="notranslate" />
        {/* Theme bootstrap: apply the stored theme before first paint so dark
            mode survives full page loads (ThemeSelector only runs on the
            settings page). Mirrors ThemeSelector's semantics exactly:
            "savvo-theme" = "dark" | "light", absent = follow system. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("savvo-theme");var d=t==="dark"||(t!=="light"&&window.matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d)}catch(e){}})()`,
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </head>
      <body
        className={`${dmSans.variable} ${dmSerif.variable} ${geistMono.variable} antialiased notranslate`}
      >
        <Suspense fallback={null}>
          <PostHogProvider />
        </Suspense>
        <ToastProvider>{children}</ToastProvider>
        <Analytics />
        <SpeedInsights />
        <ServiceWorkerRegistrar />
        <NativeBootstrap />
      </body>
    </html>
  )
}
