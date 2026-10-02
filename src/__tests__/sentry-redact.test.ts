import { beforeEach, describe, expect, it, vi } from "vitest"

const init = vi.fn()
const replayIntegration = vi.fn((opts: unknown) => ({ name: "Replay", opts }))
vi.mock("@sentry/nextjs", () => ({
  init: (opts: unknown) => init(opts),
  replayIntegration: (opts: unknown) => replayIntegration(opts),
  captureRouterTransitionStart: vi.fn(),
}))

import {
  isShareTokenPath,
  redactSentryPayload,
} from "@/lib/sentry-redact"

const TOKEN = "Zk3pQ9vX2mN8aB4cD7eF1gH5"

type Opts = {
  beforeSend: (e: unknown) => unknown
  beforeSendTransaction: (e: unknown) => unknown
  beforeBreadcrumb: (b: unknown) => unknown
  integrations?: Array<{ opts: { beforeAddRecordingEvent: (e: unknown) => unknown } }>
}

describe("redactSentryPayload", () => {
  it("redacts request url, transaction and breadcrumbs in an error event", () => {
    const event = {
      transaction: `/i/${TOKEN}`,
      request: { url: `https://savvo.app/i/${TOKEN}?x=1`, headers: { Referer: `https://savvo.app/s/${TOKEN}` } },
      breadcrumbs: [
        { category: "navigation", data: { from: `/s/${TOKEN}`, to: `/i/${TOKEN}` } },
        { category: "fetch", data: { url: `/api/intro/${TOKEN}`, method: "POST" } },
        { category: "xhr", data: { url: `https://savvo.app/i/${TOKEN}/respond` } },
      ],
    }
    redactSentryPayload(event)
    expect(event.transaction).toBe("/i/[token]")
    expect(event.request.headers.Referer).toBe("https://savvo.app/s/[token]")
    expect(event.breadcrumbs[0].data.from).toBe("/s/[token]")
    expect(event.breadcrumbs[2].data.url).toBe("https://savvo.app/i/[token]/respond")
    expect(event.request.url).toBe("https://savvo.app/i/[token]?x=1")
    expect(event.breadcrumbs[0].data.to).toBe("/i/[token]")
    // Non-share paths are untouched.
    expect(event.breadcrumbs[1].data.url).toBe(`/api/intro/${TOKEN}`)
  })

  it("survives cycles and leaves non-strings alone", () => {
    const a: Record<string, unknown> = { n: 1, ok: true, url: `/s/${TOKEN}` }
    a.self = a
    expect(() => redactSentryPayload(a)).not.toThrow()
    expect(a.url).toBe("/s/[token]")
    expect(a.n).toBe(1)
  })

  it("detects share pages", () => {
    expect(isShareTokenPath(`/i/${TOKEN}`)).toBe(true)
    expect(isShareTokenPath(`/s/${TOKEN}`)).toBe(true)
    expect(isShareTokenPath("/dashboard")).toBe(false)
    expect(isShareTokenPath("/settings")).toBe(false)
  })
})

describe("Sentry config wiring", () => {
  beforeEach(() => {
    init.mockClear()
    replayIntegration.mockClear()
    vi.resetModules()
  })

  function assertRedacts(opts: Opts) {
    const ev = opts.beforeSend({ request: { url: `https://savvo.app/i/${TOKEN}` } }) as { request: { url: string } }
    expect(ev.request.url).toBe("https://savvo.app/i/[token]")
    const tx = opts.beforeSendTransaction({ transaction: `/s/${TOKEN}` }) as { transaction: string }
    expect(tx.transaction).toBe("/s/[token]")
    const crumb = opts.beforeBreadcrumb({ data: { to: `/i/${TOKEN}` } }) as { data: { to: string } }
    expect(crumb.data.to).toBe("/i/[token]")
  }

  it("server config", async () => {
    await import("../../sentry.server.config")
    assertRedacts(init.mock.calls[0][0] as Opts)
  })

  it("edge config", async () => {
    await import("../../sentry.edge.config")
    assertRedacts(init.mock.calls[0][0] as Opts)
  })

  it("client config, including replay frames", async () => {
    await import("../../instrumentation-client")
    const opts = init.mock.calls[0][0] as Opts
    assertRedacts(opts)
    const replay = opts.integrations?.[0]
    expect(replay).toBeDefined()
    const frame = replay!.opts.beforeAddRecordingEvent({
      type: 5,
      data: { tag: "performanceSpan", payload: { op: "navigation.push", description: `https://savvo.app/s/${TOKEN}` } },
    }) as { data: { payload: { description: string } } }
    expect(frame.data.payload.description).toBe("https://savvo.app/s/[token]")
  })
})
