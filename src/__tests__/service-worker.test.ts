import { readFileSync } from "node:fs"
import { join } from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

// Loads public/sw.js into a fake ServiceWorkerGlobalScope and drives its
// fetch handler directly.
function loadServiceWorker() {
  const listeners: Record<string, (event: unknown) => void> = {}
  const cachePut = vi.fn()
  const scope = {
    location: { origin: "https://savvo.app" },
    addEventListener: (type: string, fn: (event: unknown) => void) => { listeners[type] = fn },
    skipWaiting: vi.fn(),
    clients: { claim: vi.fn(), matchAll: vi.fn(async () => []) },
  }
  const caches = {
    open: vi.fn(async () => ({ put: cachePut, addAll: vi.fn() })),
    match: vi.fn(),
    keys: vi.fn(async () => []),
    delete: vi.fn(),
  }
  const fetchMock = vi.fn(async () => new Response("ok", { status: 200 }))
  const source = readFileSync(join(process.cwd(), "public/sw.js"), "utf8")
  new Function("self", "caches", "fetch", source)(scope, caches, fetchMock)

  function dispatchFetch(url: string) {
    const respondWith = vi.fn()
    listeners.fetch({ request: new Request(url), respondWith })
    return respondWith
  }
  return { dispatchFetch, cachePut }
}

describe("service worker caching", () => {
  let sw: ReturnType<typeof loadServiceWorker>
  beforeEach(() => { sw = loadServiceWorker() })

  it("never intercepts or caches cross-origin Supabase responses", () => {
    // Regression: /auth/v1/user and /rest/v1/* payloads with user data were
    // written to Cache Storage.
    expect(sw.dispatchFetch("https://abc.supabase.co/auth/v1/user")).not.toHaveBeenCalled()
    expect(sw.dispatchFetch("https://abc.supabase.co/rest/v1/contacts?select=*")).not.toHaveBeenCalled()
    expect(sw.cachePut).not.toHaveBeenCalled()
  })

  it("leaves same-origin API calls to the network", () => {
    expect(sw.dispatchFetch("https://savvo.app/api/contacts")).not.toHaveBeenCalled()
  })

  it("still serves same-origin pages network-first for offline support", () => {
    expect(sw.dispatchFetch("https://savvo.app/dashboard")).toHaveBeenCalledOnce()
  })
})
