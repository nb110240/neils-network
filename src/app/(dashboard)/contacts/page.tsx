import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { Contact } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { ContactCard } from "@/components/contact-card"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowLeft, Plus, Users } from "lucide-react"

export default async function ContactsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: contacts } = await supabase
    .from("contacts")
    .select("*")
    .eq("created_by", user.id)
    .order("name", { ascending: true })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/dashboard">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">All Contacts</h1>
            <p className="text-muted-foreground">
              {contacts?.length || 0} contacts in your network
            </p>
          </div>
        </div>
        <Button asChild>
          <Link href="/add">
            <Plus className="mr-2 h-4 w-4" />
            Add Contact
          </Link>
        </Button>
      </div>

      {contacts && contacts.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(contacts as Contact[]).map((contact) => (
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
  )
}
