import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Contact } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { ContactCard } from "@/components/contact-card"
import { FollowUpList } from "@/components/follow-up-list"
import { Plus, Users, AlertCircle } from "lucide-react"

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Welcome back! Here&apos;s an overview of your network.
          </p>
        </div>
        <Button asChild>
          <Link href="/add">
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Link>
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Contacts</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalContacts || 0}</div>
            <p className="text-xs text-muted-foreground">
              People in your network
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Follow-ups Needed</CardTitle>
            <AlertCircle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{followUps?.length || 0}</div>
            <p className="text-xs text-muted-foreground">
              Contacts to follow up with
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href="/search">Search Contacts</Link>
            </Button>
            <Button variant="outline" size="sm" className="w-full" asChild>
              <Link href="/add">Add New Contact</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Follow-ups */}
      {followUps && followUps.length > 0 && (
        <FollowUpList contacts={followUps as Contact[]} />
      )}

      {/* Recent Contacts */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">Recent Contacts</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/contacts">View All</Link>
          </Button>
        </div>
        {recentContacts && recentContacts.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(recentContacts as Contact[]).map((contact) => (
              <ContactCard key={contact.id} contact={contact} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10">
              <Users className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold">No contacts yet</h3>
              <p className="text-muted-foreground text-center max-w-sm mt-2">
                Start building your network by adding your first contact.
              </p>
              <Button className="mt-4" asChild>
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
