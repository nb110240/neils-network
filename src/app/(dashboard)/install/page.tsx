import type { Metadata } from "next"
import { InstallGuide } from "@/components/install-guide"

export const metadata: Metadata = {
  title: "Install Savvo — Add to home screen",
}

export default function InstallPage() {
  return (
    <div className="max-w-xl mx-auto py-8">
      <InstallGuide />
    </div>
  )
}
