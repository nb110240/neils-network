import { NavHeader } from "@/components/nav-header"
import { MobileFab } from "@/components/mobile-fab"
import { OfflineIndicator } from "@/components/offline-indicator"
import { IdleLogout } from "@/components/idle-logout"
import { ReferralClaim } from "@/components/referral-claim"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <NavHeader />
      <OfflineIndicator />
      <IdleLogout />
      <ReferralClaim />
      <main className="container mx-auto px-4 py-6 pb-20 sm:pb-6">
        {children}
      </main>
      <MobileFab />
    </div>
  )
}
