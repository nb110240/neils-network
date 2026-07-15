import { describe, expect, it, vi } from "vitest"
import { refreshLoadedContactWindow } from "@/lib/contact-pagination"

const contacts = (...ids: string[]) => ids.map((id) => ({ id, name: id }))

describe("refreshLoadedContactWindow", () => {
  it("refetches later pages instead of retaining a deleted contact", async () => {
    const fetchPage = vi.fn(async () => ({
      contacts: contacts("c", "d"),
      pagination: { hasMore: false, nextCursor: null, total: 4 },
    }))

    const result = await refreshLoadedContactWindow(
      contacts("a", "b"),
      { hasMore: true, nextCursor: "cursor-b", total: 4 },
      5,
      fetchPage
    )

    expect(fetchPage).toHaveBeenCalledWith("cursor-b", 3)
    expect(result.contacts).toEqual(contacts("a", "b", "c", "d"))
    expect(result.contacts.some((contact) => contact.id === "deleted")).toBe(false)
    expect(result.pagination).toEqual({ hasMore: false, nextCursor: null, total: 4 })
  })

  it("preserves the next cursor when the refreshed window still has older rows", async () => {
    const result = await refreshLoadedContactWindow(
      contacts("a", "b"),
      { hasMore: true, nextCursor: "cursor-b", total: 5 },
      4,
      async () => ({
        contacts: contacts("c", "d"),
        pagination: { hasMore: true, nextCursor: "cursor-d", total: 5 },
      })
    )

    expect(result.contacts).toEqual(contacts("a", "b", "c", "d"))
    expect(result.pagination).toEqual({ hasMore: true, nextCursor: "cursor-d", total: 5 })
  })

  it("deduplicates overlapping cursor pages", async () => {
    const result = await refreshLoadedContactWindow(
      contacts("a", "b"),
      { hasMore: true, nextCursor: "cursor-b", total: 3 },
      3,
      async () => ({
        contacts: contacts("b", "c"),
        pagination: { hasMore: false, nextCursor: null, total: 3 },
      })
    )

    expect(result.contacts).toEqual(contacts("a", "b", "c"))
  })
})
