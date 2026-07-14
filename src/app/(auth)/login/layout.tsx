import type { Metadata } from "next"

// Metadata-only layout: the login page is a client component, so its
// title/description/canonical live here.
export const metadata: Metadata = {
  title: "Log in or sign up",
  description:
    "Log in to Savvo or create a free account. Track your investor pipeline and keep every relationship warm.",
  alternates: { canonical: "/login" },
  openGraph: {
    title: "Log in or sign up | Savvo",
    description:
      "Log in to Savvo or create a free account. Track your investor pipeline and keep every relationship warm.",
    url: "/login",
  },
}

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
