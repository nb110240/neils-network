import { beforeEach, describe, expect, it, vi } from "vitest"
import type { SupabaseClient } from "@supabase/supabase-js"

// Regression: /capture and /inbox preloaded only the first 500 contacts by
// name, so /capture?contact=<id> silently dropped a contact outside them and
// the picker could not find it.

type Row = { id: string; name: string | null; company: string | null; email: string | null }
type Call = { method: string; args: unknown[] }

function makeClient(results: Array<{ data: Row[] | null; error: null | { message: string } }>, user = { id: "u1" }) {
  const queries: Call[][] = []
  const from = vi.fn(() => {
    const calls: Call[] = []
    queries.push(calls)
    const result = results[Math.min(queries.length - 1, results.length - 1)]
    const builder: Record<string, unknown> = {}
    for (const method of ["select", "eq", "is", "in", "or", "order", "limit"]) {
      builder[method] = (...args: unknown[]) => {
        calls.push({ method, args })
        return builder
      }
    }
    builder.then = (resolve: (v: unknown) => void) => Promise.resolve(result).then(resolve)
    return builder
  })
  return {
    from,
    queries,
    auth: { getUser: vi.fn(async () => ({ data: { user } })) },
  }
}

const h = vi.hoisted(() => ({ client: null as unknown, rateLimitOk: true }))
vi.mock("@/lib/supabase/server", () => ({ createClient: vi.fn(async () => h.client) }))
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ success: h.rateLimitOk, limit: 30, remaining: 29, reset: 0 })),
  rateLimitHeaders: vi.fn(() => ({})),
}))
vi.mock("@/lib/subscription", () => ({ getUserPlan: vi.fn(async () => "pro") }))

import { loadPickerContacts, PICKER_PRELOAD_LIMIT } from "@/lib/contact-picker"
import CapturePage from "@/app/(dashboard)/capture/page"
import { GET as lookup } from "@/app/api/contacts/lookup/route"

const FAR_ID = "99999999-9999-4999-8999-999999999999"
const first500: Row[] = Array.from({ length: PICKER_PRELOAD_LIMIT }, (_, i) => ({
  id: `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`,
  name: `Aaron ${i}`,
  company: null,
  email: null,
}))
const far: Row = { id: FAR_ID, name: "Zoe Zhang", company: "Zeta Ventures", email: "zoe@zeta.vc" }

beforeEach(() => {
  h.rateLimitOk = true
})

describe("loadPickerContacts", () => {
  it("fetches a preselected contact outside the first 500 explicitly", async () => {
    const client = makeClient([{ data: first500, error: null }, { data: [far], error: null }])
    const { contacts, truncated } = await loadPickerContacts(client as unknown as SupabaseClient, "u1", [FAR_ID])
    expect(truncated).toBe(true)
    expect(contacts.map((c) => c.id)).toContain(FAR_ID)
    const second = client.queries[1]
    expect(second).toContainEqual({ method: "in", args: ["id", [FAR_ID]] })
    expect(second).toContainEqual({ method: "is", args: ["archived_at", null] })
    expect(second).toContainEqual({ method: "eq", args: ["created_by", "u1"] })
  })

  it("skips the extra query when the contact is already loaded or the id is junk", async () => {
    const client = makeClient([{ data: [far], error: null }])
    const { contacts, truncated } = await loadPickerContacts(client as unknown as SupabaseClient, "u1", [FAR_ID, "not-a-uuid", null])
    expect(truncated).toBe(false)
    expect(contacts).toHaveLength(1)
    expect(client.queries).toHaveLength(1)
  })
})

describe("/capture?contact=<id>", () => {
  it("preselects a contact outside the first 500", async () => {
    h.client = makeClient([{ data: first500, error: null }, { data: [far], error: null }])
    const element = (await CapturePage({ searchParams: Promise.resolve({ contact: FAR_ID }) })) as unknown as {
      props: { initialContactId: string; truncated: boolean; contacts: Row[] }
    }
    expect(element.props.initialContactId).toBe(FAR_ID)
    expect(element.props.truncated).toBe(true)
    expect(element.props.contacts.some((c) => c.id === FAR_ID)).toBe(true)
  })

  it("ignores an id that is not the user's active contact", async () => {
    h.client = makeClient([{ data: first500, error: null }, { data: [], error: null }])
    const element = (await CapturePage({ searchParams: Promise.resolve({ contact: FAR_ID }) })) as unknown as {
      props: { initialContactId: string }
    }
    expect(element.props.initialContactId).toBe("")
  })
})

describe("GET /api/contacts/lookup", () => {
  it("searches name, email and company among active contacts", async () => {
    const client = makeClient([{ data: [far], error: null }])
    h.client = client
    const res = await lookup(new Request("https://savvo.app/api/contacts/lookup?q=zeta"))
    expect(res.status).toBe(200)
    expect((await res.json()).contacts).toEqual([far])
    const calls = client.queries[0]
    expect(calls).toContainEqual({ method: "is", args: ["archived_at", null] })
    expect(calls).toContainEqual({ method: "eq", args: ["created_by", "u1"] })
    expect(calls).toContainEqual({ method: "or", args: ['name.ilike."%zeta%",email.ilike."%zeta%",company.ilike."%zeta%"'] })
  })

  it("quotes the query so commas and dots can't break the filter", async () => {
    const client = makeClient([{ data: [], error: null }])
    h.client = client
    await lookup(new Request("https://savvo.app/api/contacts/lookup?q=" + encodeURIComponent("a,b.c")))
    const or = client.queries[0].find((c) => c.method === "or")!
    expect(or.args[0]).toBe('name.ilike."%a,b.c%",email.ilike."%a,b.c%",company.ilike."%a,b.c%"')
  })

  it("returns nothing for a one-character query without hitting the database", async () => {
    const client = makeClient([{ data: [far], error: null }])
    h.client = client
    const res = await lookup(new Request("https://savvo.app/api/contacts/lookup?q=z"))
    expect((await res.json()).contacts).toEqual([])
    expect(client.from).not.toHaveBeenCalled()
  })
})
