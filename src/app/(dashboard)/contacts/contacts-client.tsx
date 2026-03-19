"use client"

import { useState } from "react"
import Link from "next/link"
import { Contact, HealthScore } from "@/lib/types"
import { ContactCard } from "@/components/contact-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ExportContactsButton } from "@/components/export-contacts-button"
import { ArrowLeft, Plus, Users } from "lucide-react"

interface Tag {
  id: string
  name: string
  color: string
}

interface ContactWithHealth extends Contact {
  health: HealthScore
}

interface ContactsClientProps {
  contacts: ContactWithHealth[]
  tags: Tag[]
  contactTagMap: Record<string, string[]> // contactId -> tagId[]
}

export function ContactsClient({ contacts, tags, contactTagMap }: ContactsClientProps) {
  const [activeTagId, setActiveTagId] = useState<string | null>(null)

  const filteredContacts = activeTagId
    ? contacts.filter((c) => (contactTagMap[c.id] || []).includes(activeTagId))
    : contacts

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
              {filteredContacts.length} contact{filteredContacts.length !== 1 ? "s" : ""}{activeTagId ? " matching filter" : " in your network"}
            </p>
          </div>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <ExportContactsButton />
          <Button asChild className="flex-1 sm:flex-none">
            <Link href="/add">
              <Plus className="mr-2 h-4 w-4" />
              Add Contact
            </Link>
          </Button>
        </div>
      </div>

      {/* Tag filters */}
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setActiveTagId(null)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
              activeTagId === null
                ? "bg-[var(--copper)]/10 text-[var(--copper)] border border-[var(--copper)]/30"
                : "border text-muted-foreground hover:text-foreground hover:bg-muted/50"
            }`}
          >
            All
          </button>
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => setActiveTagId(activeTagId === tag.id ? null : tag.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                activeTagId === tag.id
                  ? "text-white"
                  : "border text-muted-foreground hover:text-foreground hover:bg-muted/50"
              }`}
              style={activeTagId === tag.id ? { backgroundColor: tag.color } : undefined}
            >
              {tag.name}
            </button>
          ))}
        </div>
      )}

      {filteredContacts.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredContacts.map((contact) => (
            <ContactCard key={contact.id} contact={contact} />
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-10">
            <Users className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold">
              {activeTagId ? "No contacts with this tag" : "No contacts yet"}
            </h3>
            <p className="text-muted-foreground text-center max-w-sm mt-2">
              {activeTagId
                ? "Try selecting a different tag or add tags to your contacts."
                : "Start building your network by adding your first contact."}
            </p>
            {!activeTagId && (
              <Button className="mt-4" asChild>
                <Link href="/add">
                  <Plus className="mr-2 h-4 w-4" />
                  Add Your First Contact
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
