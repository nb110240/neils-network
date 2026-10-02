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
  const fetchMock = vi.fn(async (): Promise<Response> => new Response("ok", { status: 200 }))
  const source = readFileSync(join(process.cwd(), "public/sw.js"), "utf8")
  new Function("self", "caches", "fetch", source)(scope, caches, fetchMock)

  function dispatchFetch(url: string, init?: RequestInit) {
    const respondWith = vi.fn()
    const waitUntil = vi.fn()
    listeners.fetch({ request: new Request(url, init), respondWith, waitUntil })
    return Object.assign(respondWith, { waitUntil })
  }
  function dispatchMessage(data: unknown) {
    const waitUntil = vi.fn()
    listeners.message({ data, waitUntil })
    return waitUntil
  }
  return { dispatchFetch, dispatchMessage, cachePut, fetchMock, caches, scope }
}

function redirectedTo(url: string): Response {
  const response = new Response("<html>login</html>", { status: 200 })
  Object.defineProperty(response, "redirected", { value: true })
  Object.defineProperty(response, "url", { value: url })
  return response
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

  it("answers an offline miss with a network error, never undefined", async () => {
    sw.fetchMock.mockRejectedValueOnce(new TypeError("offline"))
    sw.caches.match.mockResolvedValueOnce(undefined)
    const respondWith = sw.dispatchFetch("https://savvo.app/contacts")
    const response = await respondWith.mock.calls[0][0]
    expect(response).toBeInstanceOf(Response)
    expect(response.type).toBe("error")
  })
})

describe("service worker sign-out hygiene", () => {
  // Regression: cached /dashboard and /contacts outlived sign-out, so on a
  // shared device the offline fallback could show the previous user's data.
  let sw: ReturnType<typeof loadServiceWorker>
  beforeEach(() => {
    sw = loadServiceWorker()
    sw.caches.keys.mockResolvedValue(["savvo-v4", "savvo-v3"] as never)
  })

  it("deletes every cache when the page asks on sign-out", async () => {
    const waitUntil = sw.dispatchMessage({ type: "CLEAR_CACHES" })
    await waitUntil.mock.calls[0][0]
    expect(sw.caches.delete).toHaveBeenCalledWith("savvo-v4")
    expect(sw.caches.delete).toHaveBeenCalledWith("savvo-v3")
  })

  it("clears caches and does not cache when a protected page redirects to /login", async () => {
    sw.fetchMock.mockResolvedValueOnce(redirectedTo("https://savvo.app/login"))
    const respondWith = sw.dispatchFetch("https://savvo.app/dashboard")
    await respondWith.mock.calls[0][0]
    await respondWith.waitUntil.mock.calls[0][0]
    expect(sw.caches.delete).toHaveBeenCalledWith("savvo-v4")
    expect(sw.cachePut).not.toHaveBeenCalled()
  })

  it("does not cache a page whose request was in flight at sign-out", async () => {
    // Regression: a protected page fetched just before sign-out resolved
    // after the caches were cleared and recreated them with the previous
    // user's page.
    let resolveFetch: (response: Response) => void = () => {}
    sw.fetchMock.mockReturnValueOnce(new Promise<Response>((resolve) => { resolveFetch = resolve }))
    const respondWith = sw.dispatchFetch("https://savvo.app/contacts")
    sw.dispatchMessage({ type: "CLEAR_CACHES" })
    resolveFetch(new Response("previous user's contacts", { status: 200 }))
    await respondWith.mock.calls[0][0]
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(sw.cachePut).not.toHaveBeenCalled()

    // Pages fetched after sign-out (the next session) cache normally.
    const next = sw.dispatchFetch("https://savvo.app/contacts")
    await next.mock.calls[0][0]
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(sw.cachePut).toHaveBeenCalledOnce()
  })

  it("still caches a normal signed-in page", async () => {
    const respondWith = sw.dispatchFetch("https://savvo.app/contacts")
    await respondWith.mock.calls[0][0]
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(sw.cachePut).toHaveBeenCalledOnce()
    expect(sw.caches.delete).not.toHaveBeenCalled()
  })
})

describe("service worker offline queue", () => {
  // Regression: a name the user confirmed at the prompt was dropped from the
  // offline queue, so sync re-guessed it from the note.
  it("keeps the confirmed name when queueing and syncing", async () => {
    const sw = loadServiceWorker()
    const postMessage = vi.fn()
    sw.scope.clients.matchAll.mockResolvedValue([{ postMessage }] as never)
    sw.fetchMock.mockRejectedValueOnce(new TypeError("offline"))
    const respondWith = sw.dispatchFetch("https://savvo.app/api/contacts", {
      method: "POST",
      body: JSON.stringify({ raw_note: "great chat about seed rounds", name: "Sam Lee" }),
    })
    await respondWith.mock.calls[0][0]
    const queued = postMessage.mock.calls[0][0]
    expect(queued.type).toBe("OFFLINE_QUEUE_ADD")
    expect(queued.data).toMatchObject({ raw_note: "great chat about seed rounds", name: "Sam Lee" })

    sw.fetchMock.mockClear()
    sw.dispatchMessage({ type: "SYNC_OFFLINE_QUEUE", queue: [queued.data] })
    await vi.waitFor(() => expect(sw.fetchMock).toHaveBeenCalledOnce())
    const init = (sw.fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1]
    expect(JSON.parse(init.body as string)).toEqual({
      raw_note: "great chat about seed rounds",
      name: "Sam Lee",
      allow_unnamed: true,
    })
  })

  it("the page-side sync fallback also sends the confirmed name", () => {
    const source = readFileSync(join(process.cwd(), "src/components/offline-indicator.tsx"), "utf8")
    expect(source).toMatch(/raw_note: item\.raw_note, name: item\.name, allow_unnamed: true/)
  })
})

describe("clearOfflineData", () => {
  it("clears Cache Storage, the offline queue, and tells the worker", async () => {
    const removeItem = vi.fn()
    const postMessage = vi.fn()
    const del = vi.fn(async () => true)
    vi.stubGlobal("localStorage", { removeItem })
    vi.stubGlobal("navigator", { serviceWorker: { controller: { postMessage } } })
    vi.stubGlobal("caches", { keys: vi.fn(async () => ["savvo-v4"]), delete: del })
    const { clearOfflineData } = await import("@/lib/clear-offline-cache")
    await clearOfflineData()
    expect(removeItem).toHaveBeenCalledWith("savvo-offline-queue")
    expect(postMessage).toHaveBeenCalledWith({ type: "CLEAR_CACHES" })
    expect(del).toHaveBeenCalledWith("savvo-v4")
    vi.unstubAllGlobals()
  })

  it("never throws when storage and Cache Storage are unavailable", async () => {
    vi.stubGlobal("localStorage", { removeItem: () => { throw new Error("blocked") } })
    vi.stubGlobal("navigator", {})
    vi.stubGlobal("caches", { keys: async () => { throw new Error("insecure") } })
    const { clearOfflineData } = await import("@/lib/clear-offline-cache")
    await expect(clearOfflineData()).resolves.toBeUndefined()
    vi.unstubAllGlobals()
  })

  it("runs on every client sign-out path", () => {
    for (const file of [
      "src/components/nav-header.tsx",
      "src/components/idle-logout.tsx",
      "src/app/(dashboard)/settings/page.tsx",
      "src/app/(auth)/login/page.tsx",
    ]) {
      const source = readFileSync(join(process.cwd(), file), "utf8")
      const signOuts = source.match(/auth\.signOut\(\)/g)?.length ?? 0
      const clears = source.match(/clearOfflineData\(\)/g)?.length ?? 0
      expect({ file, clears }).toEqual({ file, clears: signOuts })
    }
  })
})
