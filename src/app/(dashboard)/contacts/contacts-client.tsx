"use client"

import { useState, useCallback } from "react"
import Link from "next/link"
import { Contact, HealthScore } from "@/lib/types"
import { ContactCard } from "@/components/contact-card"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ExportContactsButton } from "@/components/export-contacts-button"
import { DuplicatesBanner } from "@/components/duplicates-banner"
import { ArrowLeft, Plus, Users, Loader2, ArrowUpDown } from "lucide-react"

type SortOption = "recent" | "last-contacted" | "needs-attention" | "name" | "health"

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: "recent", label: "Recently added" },
  { value: "last-contacted", label: "Last contacted" },
  { value: "needs-attention", label: "Needs attention" },
  { value: "name", label: "Name A-Z" },
  { value: "health", label: "Health (worst first)" },
]

const HEALTH_ORDER: Record<string, number> = { red: 0, orange: 1, yellow: 2, green: 3 }

function sortContacts(contacts: ContactWithHealth[], sort: SortOption): ContactWithHealth[] {
  const sorted = [...contacts]
  switch (sort) {
    case "recent":
      return sorted.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    case "last-contacted":
      return sorted.sort((a, b) => {
        const aDate = a.last_contact_date || a.created_at
        const bDate = b.last_contact_date || b.created_at
        return new Date(bDate).getTime() - new Date(aDate).getTime()
      })
    case "needs-attention":
      return sorted.sort((a, b) => {
        const aDate = a.last_contact_date || a.created_at
        const bDate = b.last_contact_date || b.created_at
        return new Date(aDate).getTime() - new Date(bDate).getTime()
      })
    case "name":
      return sorted.sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    case "health":
      return sorted.sort((a, b) => (HEALTH_ORDER[a.health.level] ?? 3) - (HEALTH_ORDER[b.health.level] ?? 3))
    default:
      return sorted
  }
}

interface Tag {
  id: string
  name: string
  color: string
}

interface ContactWithHealth extends Contact {
  health: HealthScore
}

interface PaginationInfo {
  hasMore: boolean
  nextCursor: string | null
  total: number
}

interface ContactsClientProps {
  contacts: ContactWithHealth[]
  tags: Tag[]
  contactTagMap: Record<string, string[]> // contactId -> tagId[]
  pagination: PaginationInfo
}

export function ContactsClient({ contacts: initialContacts, tags, contactTagMap: initialTagMap, pagination: initialPagination }: ContactsClientProps) {
  const [contacts, setContacts] = useState<ContactWithHealth[]>(initialContacts)
  const [contactTagMap, setContactTagMap] = useState<Record<string, string[]>>(initialTagMap)
  const [pagination, setPagination] = useState<PaginationInfo>(initialPagination)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [activeTagId, setActiveTagId] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<SortOption>("recent")

  const filteredContacts = sortContacts(
    activeTagId
      ? contacts.filter((c) => (contactTagMap[c.id] || []).includes(activeTagId))
      : contacts,
    sortBy
  )

  const loadMore = useCallback(async () => {
    if (!pagination.nextCursor || isLoadingMore) return

    setIsLoadingMore(true)
    try {
      const params = new URLSearchParams({
        limit: "25",
        cursor: pagination.nextCursor,
        direction: "next",
      })

      const res = await fetch(`/api/contacts?${params}`)
      if (!res.ok) throw new Error("Failed to fetch")

      const data = await res.json()

      setContacts((prev) => [...prev, ...data.contacts])
      setPagination({
        hasMore: data.pagination.hasMore,
        nextCursor: data.pagination.nextCursor,
        total: data.pagination.total,
      })

      // Fetch tags for new contacts
      const newContactIds = data.contacts.map((c: ContactWithHealth) => c.id)
      if (newContactIds.length > 0) {
        const tagRes = await fetch(`/api/contact-tags?contactIds=${newContactIds.join(",")}`)
        if (tagRes.ok) {
          const tagData = await tagRes.json()
          if (tagData.contactTags) {
            setContactTagMap((prev) => {
              const updated = { ...prev }
              for (const ct of tagData.contactTags) {
                if (!updated[ct.contact_id]) updated[ct.contact_id] = []
                updated[ct.contact_id].push(ct.tag_id)
              }
              return updated
            })
          }
        }
      }
    } catch (error) {
      console.error("Error loading more contacts:", error)
    } finally {
      setIsLoadingMore(false)
    }
  }, [pagination.nextCursor, isLoadingMore])

  return (
    <div className="space-y-6">
      <DuplicatesBanner />
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
              {activeTagId
                ? `${filteredContacts.length} contact${filteredContacts.length !== 1 ? "s" : ""} matching filter`
                : `Showing ${contacts.length} of ${pagination.total} contact${pagination.total !== 1 ? "s" : ""}`}
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

      {/* Sort + Tag filters */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        {/* Sort dropdown */}
        <div className="flex items-center gap-2 shrink-0">
          <ArrowUpDown className="h-3.5 w-3.5 text-muted-foreground" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortOption)}
            className="h-8 rounded-lg border border-input bg-background px-2.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
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
      </div>

      {filteredContacts.length > 0 ? (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredContacts.map((contact) => (
              <ContactCard key={contact.id} contact={contact} />
            ))}
          </div>

          {/* Load More button — only shown when not filtering by tag */}
          {!activeTagId && pagination.hasMore && (
            <div className="flex flex-col items-center gap-2 pt-4 pb-2">
              <p className="text-sm text-muted-foreground">
                Showing {contacts.length} of {pagination.total} contacts
              </p>
              <Button
                variant="outline"
                onClick={loadMore}
                disabled={isLoadingMore}
                className="min-w-[200px] h-10 border-[var(--copper)]/30 text-[var(--copper)] hover:bg-[var(--copper)]/5"
              >
                {isLoadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  `Load More (${pagination.total - contacts.length} remaining)`
                )}
              </Button>
            </div>
          )}
        </>
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
