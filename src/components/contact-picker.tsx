"use client"

import { useEffect, useMemo, useState } from "react"
import { Input } from "@/components/ui/input"
import type { ContactOption } from "@/lib/contact-picker"

export function contactLabel(contact: ContactOption): string {
  return `${contact.name || contact.email || "Unnamed contact"}${contact.company ? ` at ${contact.company}` : ""}`
}

function matches(contact: ContactOption, query: string): boolean {
  const q = query.toLowerCase()
  return [contact.name, contact.email, contact.company].some((field) => field?.toLowerCase().includes(q))
}

/**
 * Contact <select> with a search box. Filters the preloaded contacts locally;
 * when the preload was truncated, also asks the server so every contact can
 * be found. The selected contact always stays in the list.
 */
export function ContactPicker({
  id,
  contacts,
  truncated = false,
  value,
  onChange,
  emptyLabel,
  className,
}: {
  id: string
  contacts: ContactOption[]
  truncated?: boolean
  value: string
  onChange: (id: string, contact: ContactOption | null) => void
  emptyLabel: string
  className?: string
}) {
  const [query, setQuery] = useState("")
  const [remote, setRemote] = useState<ContactOption[]>([])
  // Every contact the server has returned, so a remote pick keeps its label
  // after the search box is cleared.
  const [seen, setSeen] = useState<Map<string, ContactOption>>(() => new Map())
  const q = query.trim()
  const searchingServer = truncated && q.length >= 2

  useEffect(() => {
    if (!searchingServer) return
    const controller = new AbortController()
    const timer = setTimeout(() => {
      fetch(`/api/contacts/lookup?q=${encodeURIComponent(q)}`, { signal: controller.signal })
        .then((res) => (res.ok ? res.json() : { contacts: [] }))
        .then((data: { contacts?: ContactOption[] }) => {
          const found = data.contacts || []
          setRemote(found)
          setSeen((current) => {
            const next = new Map(current)
            for (const contact of found) next.set(contact.id, contact)
            return next
          })
        })
        .catch(() => {})
    }, 250)
    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [q, searchingServer])

  const lookup = useMemo(() => {
    const map = new Map(seen)
    for (const contact of contacts) map.set(contact.id, contact)
    return map
  }, [contacts, seen])

  const options = useMemo(() => {
    const byId = new Map<string, ContactOption>()
    for (const contact of contacts) if (!q || matches(contact, q)) byId.set(contact.id, contact)
    if (searchingServer) for (const contact of remote) byId.set(contact.id, contact)
    const selected = value ? lookup.get(value) : undefined
    if (selected) byId.set(selected.id, selected)
    return [...byId.values()]
  }, [contacts, remote, lookup, q, value, searchingServer])

  const showSearch = truncated || contacts.length > 12

  return (
    <div className="space-y-2">
      {showSearch && (
        <Input
          type="search"
          aria-label="Search contacts"
          placeholder={truncated ? "Search all contacts by name, email or company" : "Filter contacts"}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-10"
        />
      )}
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value, lookup.get(event.target.value) ?? null)}
        className={
          className ??
          "flex h-11 w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        }
      >
        <option value="">{emptyLabel}</option>
        {options.map((contact) => (
          <option key={contact.id} value={contact.id}>
            {contactLabel(contact)}
          </option>
        ))}
      </select>
    </div>
  )
}
