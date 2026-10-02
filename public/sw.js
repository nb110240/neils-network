// v3: purges v2 caches, which stored cross-origin Supabase responses
// (auth and REST payloads with user data).
// v4: purges v3 caches, which could hold a signed-out user's pages and
// cached the /login redirect under protected URLs.
const CACHE_NAME = "savvo-v4"
const OFFLINE_QUEUE_KEY = "savvo-offline-queue"

// Cache essential pages on install
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(["/dashboard", "/login", "/add", "/contacts", "/search"])
    })
  )
  self.skipWaiting()
})

// Clean up old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    })
  )
  self.clients.claim()
})

// Network-first for pages, queue POST requests when offline
self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url)

  // Handle offline contact creation — queue it
  if (event.request.method === "POST" && url.pathname === "/api/contacts") {
    event.respondWith(handleContactPost(event.request))
    return
  }

  // Skip other non-GET requests
  if (event.request.method !== "GET") return
  // Only same-origin pages are cached. Cross-origin calls (Supabase auth and
  // REST, analytics) carry user data and must never land in Cache Storage.
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith("/api/")) return

  // Network-first for pages
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // A protected page redirected to /login means nobody is signed in:
        // drop every cached page so the previous user's data cannot be
        // served offline on a shared device.
        if (response.redirected && new URL(response.url).pathname === "/login") {
          event.waitUntil(clearAllCaches())
          return response
        }
        if (response.ok && !response.redirected) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(async () => {
        // respondWith() must get a Response: fall back to a network error
        // when nothing is cached, rather than undefined.
        return (await caches.match(event.request)) || Response.error()
      })
  )
})

// Queue contact creation when offline, send when back online
async function handleContactPost(request) {
  try {
    const response = await fetch(request.clone())
    return response
  } catch {
    // Offline — save to queue
    const body = await request.json()

    // Store in IndexedDB via message to clients
    const clients = await self.clients.matchAll()
    for (const client of clients) {
      client.postMessage({
        type: "OFFLINE_QUEUE_ADD",
        data: { raw_note: body.raw_note, queued_at: new Date().toISOString() },
      })
    }

    return new Response(
      JSON.stringify({
        success: true,
        offline: true,
        message: "Saved offline. Will sync when back online.",
        contact: { name: "Pending...", raw_note: body.raw_note },
      }),
      {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }
    )
  }
}

async function clearAllCaches() {
  const keys = await caches.keys()
  await Promise.all(keys.map((key) => caches.delete(key)))
}

// Sync queued contacts when back online; clear cached pages on sign-out.
self.addEventListener("message", (event) => {
  if (event.data?.type === "SYNC_OFFLINE_QUEUE") {
    syncQueue(event.data.queue)
  }
  if (event.data?.type === "CLEAR_CACHES") {
    const done = clearAllCaches()
    if (event.waitUntil) event.waitUntil(done)
  }
})

// Mirrors isRetryableStatus in src/lib/offline-queue.ts: signed out, rate
// limited, or a server error can succeed later, so those notes stay queued.
function isRetryableStatus(status) {
  return status === 401 || status === 408 || status === 429 || status >= 500
}

async function syncQueue(queue) {
  // Report exactly which notes were delivered so the page removes only
  // those. Clearing the whole queue lost notes when a send failed.
  const delivered = []
  for (const item of queue) {
    try {
      const response = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // Nobody is there to answer a name prompt during background sync.
        body: JSON.stringify({ raw_note: item.raw_note, allow_unnamed: true }),
      })
      if (isRetryableStatus(response.status)) break
      delivered.push(`${item.queued_at}|${item.raw_note}`)
    } catch {
      // Still offline, stop trying
      break
    }
  }

  // Notify clients sync is done
  const clients = await self.clients.matchAll()
  for (const client of clients) {
    client.postMessage({ type: "OFFLINE_SYNC_COMPLETE", delivered })
  }
}
