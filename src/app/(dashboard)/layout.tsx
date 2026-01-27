import { NavHeader } from "@/components/nav-header"

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-background">
      <NavHeader />
      <main className="container mx-auto py-6">{children}</main>
    </div>
  )
}
