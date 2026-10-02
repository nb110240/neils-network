// The service worker (public/sw.js) caches authenticated pages such as
// /dashboard and /contacts for offline use, and /add queues notes in
// localStorage while offline. On a shared device the next person to sign in
// could see the previous user's cached pages offline, or sync their queued
// notes into the wrong account. Call this on every sign-out.

const OFFLINE_QUEUE_KEY = "savvo-offline-queue"

/** Clears Cache Storage and the offline note queue. Never throws. */
export async function clearOfflineData(): Promise<void> {
  try {
    localStorage.removeItem(OFFLINE_QUEUE_KEY)
  } catch {
    /* storage blocked */
  }

  try {
    navigator.serviceWorker?.controller?.postMessage({ type: "CLEAR_CACHES" })
  } catch {
    /* no service worker */
  }

  // Also delete from the page: the worker may be stopped, missing, or not
  // yet controlling this tab, and a postMessage is not awaited.
  try {
    if (typeof caches !== "undefined") {
      const keys = await caches.keys()
      await Promise.all(keys.map((key) => caches.delete(key)))
    }
  } catch {
    /* Cache Storage unavailable (private mode, insecure context) */
  }
}
