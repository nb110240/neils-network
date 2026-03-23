import type { Metadata, Viewport } from "next"
import { DM_Sans, DM_Serif_Display, Geist_Mono } from "next/font/google"
import { ToastProvider } from "@/components/ui/toast"
import { Analytics } from "@vercel/analytics/next"
import { SpeedInsights } from "@vercel/speed-insights/next"
import { ServiceWorkerRegistrar } from "@/components/sw-registrar"
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
  title: "Savvo — AI Relationship Manager",
  description: "Keep every connection alive. Type what you remember, get structured contacts, health scores, and daily nudges to stay connected.",
  manifest: "/manifest.json",
  metadataBase: new URL("https://savvo.app"),
  openGraph: {
    title: "Savvo — Never Let a Relationship Drift",
    description: "AI-powered relationship manager. Type what you remember about someone — Savvo extracts the details, tracks relationship health, and nudges you before connections go cold.",
    url: "https://savvo.app",
    siteName: "Savvo",
    type: "website",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Savvo — AI Relationship Manager",
    description: "Keep every connection alive. Health scores, daily digests, and AI-powered follow-ups.",
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Savvo",
  },
  icons: {
    icon: "/favicon.png",
    apple: "/icons/apple-touch-icon.png",
  },
}

export const viewport: Viewport = {
  themeColor: "#c2410c",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body
        className={`${dmSans.variable} ${dmSerif.variable} ${geistMono.variable} antialiased`}
      >
        <ToastProvider>{children}</ToastProvider>
        <Analytics />
        <SpeedInsights />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
