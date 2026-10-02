import { NavHeader } from "@/components/nav-header"
import { MobileFab } from "@/components/mobile-fab"
import { OfflineIndicator } from "@/components/offline-indicator"
import { IdleLogout } from "@/components/idle-logout"
import { PendingImportRedirect } from "@/components/pending-import-redirect"

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
      <PendingImportRedirect />
      <main className="container mx-auto px-4 py-6 pb-20 sm:pb-6">
        {children}
      </main>
      <MobileFab />
    </div>
  )
}
