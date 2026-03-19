const CACHE_NAME = "savvo-v2"
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
  if (url.pathname.startsWith("/api/")) return

  // Network-first for pages
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response.ok) {
          const clone = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        }
        return response
      })
      .catch(() => {
        return caches.match(event.request)
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

// Sync queued contacts when back online
self.addEventListener("message", (event) => {
  if (event.data?.type === "SYNC_OFFLINE_QUEUE") {
    syncQueue(event.data.queue)
  }
})

async function syncQueue(queue) {
  for (const item of queue) {
    try {
      await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raw_note: item.raw_note }),
      })
    } catch {
      // Still offline, stop trying
      break
    }
  }

  // Notify clients sync is done
  const clients = await self.clients.matchAll()
  for (const client of clients) {
    client.postMessage({ type: "OFFLINE_SYNC_COMPLETE" })
  }
}
