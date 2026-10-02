import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { sendPushToUser } from "@/lib/push/send"

function service(opts: { prefs?: { push_enabled: boolean } | null; tokens?: Array<{ token: string; platform: string }>; deleteError?: { message: string } | null }) {
  const deleted: string[][] = []
  const deleteFilters: Array<Record<string, unknown>> = []
  const client = {
    from: vi.fn((table: string) => {
      const builder: Record<string, unknown> = {}
      for (const m of ["select", "eq"]) builder[m] = vi.fn(() => builder)
      builder.maybeSingle = vi.fn(async () => ({ data: opts.prefs ?? null, error: null }))
      builder.delete = vi.fn(() => {
        const filters: Record<string, unknown> = {}
        const del = {
          eq: vi.fn((col: string, value: unknown) => {
            filters[col] = value
            return del
          }),
          in: vi.fn(async (_col: string, values: string[]) => {
            deleted.push(values)
            deleteFilters.push(filters)
            return { error: opts.deleteError ?? null }
          }),
        }
        return del
      })
      builder.then = (resolve: (v: unknown) => void) =>
        Promise.resolve(table === "push_tokens" ? { data: opts.tokens ?? [], error: null } : { data: null, error: null }).then(resolve)
      return builder
    }),
  }
  return { client, deleted, deleteFilters }
}

const message = { title: "t", body: "b" }
const env = { ...process.env }
beforeEach(() => {
  process.env.FCM_SERVICE_ACCOUNT = JSON.stringify({ project_id: "p", client_email: "e", private_key: "k" })
})
afterEach(() => {
  process.env = { ...env }
})

describe("sendPushToUser", () => {
  it("sends to each platform's devices and prunes dead tokens", async () => {
    const { client, deleted } = service({ tokens: [{ token: "ios1", platform: "ios" }, { token: "and1", platform: "android" }, { token: "and2", platform: "android" }] })
    const apns = vi.fn(async () => ({ sent: 1, failed: 0, deadTokens: [] }))
    const fcm = vi.fn(async () => ({ sent: 1, failed: 1, deadTokens: ["and2"] }))
    const result = await sendPushToUser(client as never, "u1", message, { apns, fcm })
    expect(apns).toHaveBeenCalledWith(["ios1"], message)
    expect(fcm).toHaveBeenCalledWith(["and1", "and2"], message)
    expect(result).toEqual({ sent: 2, removed: 1 })
    expect(deleted).toEqual([["and2"]])
  })

  it("prunes dead tokens only from this user's rows", async () => {
    // A token re-registered to another account between the read and the prune must survive.
    const { client, deleted, deleteFilters } = service({ tokens: [{ token: "ios1", platform: "ios" }] })
    const apns = vi.fn(async () => ({ sent: 0, failed: 1, deadTokens: ["ios1"] }))
    const fcm = vi.fn(async () => ({ sent: 0, failed: 0, deadTokens: [] }))
    await sendPushToUser(client as never, "u1", message, { apns, fcm })
    expect(deleted).toEqual([["ios1"]])
    expect(deleteFilters).toEqual([{ user_id: "u1" }])
  })

  it("respects the user's off switch", async () => {
    const { client } = service({ prefs: { push_enabled: false }, tokens: [{ token: "ios1", platform: "ios" }] })
    const apns = vi.fn()
    expect(await sendPushToUser(client as never, "u1", message, { apns, fcm: vi.fn() })).toMatchObject({ skipped: "disabled" })
    expect(apns).not.toHaveBeenCalled()
  })

  it("is a no-op for users without devices or when push isn't set up", async () => {
    expect(await sendPushToUser(service({}).client as never, "u1", message)).toMatchObject({ skipped: "no_devices" })
    delete process.env.FCM_SERVICE_ACCOUNT
    expect(await sendPushToUser(service({ tokens: [{ token: "x", platform: "ios" }] }).client as never, "u1", message)).toMatchObject({ skipped: "not_configured" })
  })

  it("never throws, even when a sender blows up", async () => {
    const { client } = service({ tokens: [{ token: "ios1", platform: "ios" }] })
    const apns = vi.fn(async () => { throw new Error("boom") })
    await expect(sendPushToUser(client as never, "u1", message, { apns, fcm: vi.fn(async () => ({ sent: 0, failed: 0, deadTokens: [] })) }))
      .resolves.toEqual({ sent: 0, removed: 0 })
  })
})
