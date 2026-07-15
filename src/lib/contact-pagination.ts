export interface ContactPaginationWindow {
  hasMore: boolean
  nextCursor: string | null
  total: number
}

interface ContactPage<T> {
  contacts: T[]
  pagination: ContactPaginationWindow
}

export async function refreshLoadedContactWindow<T extends { id: string }>(
  refreshedFirstPage: T[],
  refreshedPagination: ContactPaginationWindow,
  desiredCount: number,
  fetchPage: (cursor: string, limit: number) => Promise<ContactPage<T>>
): Promise<ContactPage<T>> {
  const contacts = [...refreshedFirstPage]
  const seen = new Set(contacts.map((contact) => contact.id))
  let hasMore = refreshedPagination.hasMore
  let nextCursor = refreshedPagination.nextCursor

  while (contacts.length < desiredCount && hasMore && nextCursor) {
    const previousCursor = nextCursor
    const page = await fetchPage(nextCursor, Math.min(desiredCount - contacts.length, 100))
    for (const contact of page.contacts) {
      if (!seen.has(contact.id)) {
        seen.add(contact.id)
        contacts.push(contact)
      }
    }
    hasMore = page.pagination.hasMore
    nextCursor = page.pagination.nextCursor

    if (page.contacts.length === 0 || nextCursor === previousCursor) break
  }

  return {
    contacts,
    pagination: {
      total: refreshedPagination.total,
      hasMore: contacts.length < refreshedPagination.total && hasMore,
      nextCursor:
        contacts.length < refreshedPagination.total && hasMore ? nextCursor : null,
    },
  }
}
