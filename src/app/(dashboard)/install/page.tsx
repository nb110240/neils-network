import type { Metadata } from "next"
import { InstallGuide } from "@/components/install-guide"

export const metadata: Metadata = {
  title: "Install the app",
  description:
    "Add Savvo to your home screen on iPhone or Android for one-tap access to your investor pipeline and network.",
  alternates: { canonical: "/install" },
  openGraph: {
    title: "Install the app | Savvo",
    description:
      "Add Savvo to your home screen on iPhone or Android for one-tap access to your investor pipeline and network.",
    url: "/install",
  },
}

export default function InstallPage() {
  return (
    <div className="max-w-xl mx-auto py-8">
      <h1 className="sr-only">Install Savvo on your device</h1>
      <InstallGuide />
    </div>
  )
}
