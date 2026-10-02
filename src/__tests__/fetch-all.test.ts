import { describe, expect, it, vi } from "vitest"
import { fetchAllRows } from "@/lib/fetch-all"

const table = (n: number) => Array.from({ length: n }, (_, i) => ({ id: i }))

function api(rows: Array<{ id: number }>, cap = 1000) {
  return vi.fn(async (from: number, to: number) => ({ data: rows.slice(from, Math.min(to + 1, from + cap)), error: null }))
}

describe("fetchAllRows", () => {
  it("reads past the 1,000-row API cap", async () => {
    const page = api(table(2500))
    const { data } = await fetchAllRows(page)
    expect(data).toHaveLength(2500)
    expect(data[2499]).toEqual({ id: 2499 })
    expect(page.mock.calls).toEqual([[0, 999], [1000, 1999], [2000, 2999]])
  })

  it("stops after an exactly full last page without a wasted extra request beyond one empty read", async () => {
    const page = api(table(2000))
    expect((await fetchAllRows(page)).data).toHaveLength(2000)
    expect(page).toHaveBeenCalledTimes(3)
  })

  it("makes one request for small networks", async () => {
    const page = api(table(12))
    expect((await fetchAllRows(page)).data).toHaveLength(12)
    expect(page).toHaveBeenCalledTimes(1)
  })

  it("returns what it has plus the error when a page fails", async () => {
    let n = 0
    const page = vi.fn(async () => (n++ === 0 ? { data: table(1000), error: null } : { data: null, error: { message: "timeout" } }))
    const res = await fetchAllRows(page)
    expect(res.error).toEqual({ message: "timeout" })
    expect(res.data).toHaveLength(1000)
  })

  it("never reads more than the safety cap", async () => {
    const page = api(table(5000))
    expect((await fetchAllRows(page, { maxRows: 2500 })).data).toHaveLength(2500)
  })
})
