import { afterEach, describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"
import {
  ARCHIVED_ID_PAGE_SIZE,
  fetchArchivedContactIds,
  fetchArchivedContactIdsForPage,
} from "@/lib/archived-contacts"

type Page = { data: { id: string }[] | null; error: { message: string } | null }

/** Fake client whose contacts query returns one queued page per .range() call. */
function fakeSupabase(pages: Page[]) {
  const ranges: [number, number][] = []
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    not: vi.fn(() => builder),
    order: vi.fn(() => builder),
    range: vi.fn((from: number, to: number) => {
      ranges.push([from, to])
      return Promise.resolve(pages.shift() ?? { data: [], error: null })
    }),
  }
  const client = { from: vi.fn(() => builder) } as unknown as SupabaseClient
  return { client, builder, ranges }
}

const ids = (prefix: string, count: number) =>
  Array.from({ length: count }, (_, i) => ({ id: `${prefix}-${i}` }))

afterEach(() => vi.restoreAllMocks())

describe("fetchArchivedContactIds", () => {
  it("pages past the API row cap instead of stopping at the first 1,000 archived contacts", async () => {
    const { client, builder, ranges } = fakeSupabase([
      { data: ids("a", ARCHIVED_ID_PAGE_SIZE), error: null },
      { data: ids("b", 3), error: null },
    ])

    const result = await fetchArchivedContactIds(client, "user-1")

    expect(result).toHaveLength(ARCHIVED_ID_PAGE_SIZE + 3)
    expect(result).toContain("b-2")
    expect(ranges).toEqual([[0, ARCHIVED_ID_PAGE_SIZE - 1], [ARCHIVED_ID_PAGE_SIZE, 2 * ARCHIVED_ID_PAGE_SIZE - 1]])
    expect(builder.order).toHaveBeenCalledWith("id")
    expect(builder.eq).toHaveBeenCalledWith("created_by", "user-1")
    expect(builder.not).toHaveBeenCalledWith("archived_at", "is", null)
  })

  it("throws on a query error instead of returning an empty list that re-shows archived people", async () => {
    const { client } = fakeSupabase([{ data: null, error: { message: "boom" } }])

    await expect(fetchArchivedContactIds(client, "user-1")).rejects.toThrow("Failed to load archived contacts: boom")
  })
})

describe("fetchArchivedContactIdsForPage", () => {
  it("logs the failure and degrades to no filter so the page still renders", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {})
    const { client } = fakeSupabase([{ data: null, error: { message: "boom" } }])

    await expect(fetchArchivedContactIdsForPage(client, "user-1")).resolves.toEqual([])
    expect(consoleError).toHaveBeenCalledTimes(1)
    expect(String(consoleError.mock.calls[0][0])).toContain("boom")
  })
})
