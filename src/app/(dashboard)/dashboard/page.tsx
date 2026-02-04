import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Contact } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ContactCard } from "@/components/contact-card"
import { FollowUpList } from "@/components/follow-up-list"
import { Plus, Users, AlertCircle, ArrowRight, Sparkles } from "lucide-react"

export default async function DashboardPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Fetch stats
  const { count: totalContacts } = await supabase
    .from("contacts")
    .select("*", { count: "exact", head: true })
    .eq("created_by", user.id)

  const { data: followUps } = await supabase
    .from("contacts")
    .select("*")
    .eq("created_by", user.id)
    .eq("follow_up_needed", true)
    .order("created_at", { ascending: false })
    .limit(5)

  const { data: recentContacts } = await supabase
    .from("contacts")
    .select("*")
    .eq("created_by", user.id)
    .order("created_at", { ascending: false })
    .limit(6)

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between animate-fade-in">
        <div>
          <h1 className="text-4xl font-normal tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1 text-lg">
            Welcome back. Here&apos;s your network overview.
          </p>
        </div>
        <Button asChild className="bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 shadow-md hover:shadow-lg border-0">
          <Link href="/add">
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className="glass shadow-refined card-glow animate-fade-in stagger-1 opacity-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Contacts</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-[var(--copper)]/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-[var(--copper)]" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-normal">{totalContacts || 0}</div>
            <p className="text-sm text-muted-foreground mt-1">
              People in your network
            </p>
          </CardContent>
        </Card>

        <Card className="glass shadow-refined card-glow animate-fade-in stagger-2 opacity-0">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Follow-ups Needed</CardTitle>
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-normal">{followUps?.length || 0}</div>
            <p className="text-sm text-muted-foreground mt-1">
              Connections to follow up with
            </p>
          </CardContent>
        </Card>

        <Card className="glass shadow-refined card-glow animate-fade-in stagger-3 opacity-0 overflow-hidden relative">
          <div className="absolute inset-0 bg-gradient-to-br from-[var(--copper)]/5 via-transparent to-transparent" />
          <CardHeader className="relative">
            <CardTitle className="text-sm font-medium text-muted-foreground">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 relative">
            <Button variant="outline" size="sm" className="w-full justify-between group" asChild>
              <Link href="/search">
                Search Contacts
                <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </Link>
            </Button>
            <Button variant="outline" size="sm" className="w-full justify-between group" asChild>
              <Link href="/add">
                Add New Contact
                <ArrowRight className="h-4 w-4 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Follow-ups */}
      {followUps && followUps.length > 0 && (
        <div className="animate-fade-in stagger-4 opacity-0">
          <FollowUpList contacts={followUps as Contact[]} />
        </div>
      )}

      {/* Recent Contacts */}
      <div className="space-y-4 animate-fade-in stagger-5 opacity-0">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-normal">Recent Contacts</h2>
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-[var(--copper)]" asChild>
            <Link href="/contacts" className="flex items-center gap-2">
              View All
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
        {recentContacts && recentContacts.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(recentContacts as Contact[]).map((contact, index) => (
              <div key={contact.id} className={`animate-fade-in stagger-${index + 1} opacity-0`}>
                <ContactCard contact={contact} />
              </div>
            ))}
          </div>
        ) : (
          <Card className="glass shadow-refined">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--copper)] to-[var(--copper-light)] flex items-center justify-center shadow-lg mb-6">
                <Sparkles className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-normal">No contacts yet</h3>
              <p className="text-muted-foreground text-center max-w-sm mt-2">
                Start building your network by adding your first contact.
              </p>
              <Button className="mt-6 bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 shadow-md border-0" asChild>
                <Link href="/add">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Contact
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
