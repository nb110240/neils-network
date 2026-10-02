// ─── Offline contact queue ───
// When /add is submitted offline, public/sw.js answers the POST itself and
// tells every open tab to store the note here. When the connection returns,
// the notes are sent to /api/contacts. public/sw.js keeps its own copy of
// isRetryableStatus (it can't import app code); keep the two in sync.

export const OFFLINE_QUEUE_KEY = "savvo-offline-queue"

export type QueuedContact = { raw_note: string; queued_at: string }

/** Identifies one queued note across tabs (each tab hears the same message). */
export function queueKey(item: QueuedContact): string {
  return `${item.queued_at}|${item.raw_note}`
}

export function readQueue(storage: Pick<Storage, "getItem"> = localStorage): QueuedContact[] {
  try {
    const parsed = JSON.parse(storage.getItem(OFFLINE_QUEUE_KEY) || "[]")
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function writeQueue(queue: QueuedContact[], storage: Pick<Storage, "setItem"> = localStorage) {
  try {
    storage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
  } catch {
    // Storage full or blocked: nothing more we can do offline.
  }
}

/** Adds a note unless another tab already stored it (tabs share localStorage). */
export function enqueue(queue: QueuedContact[], item: QueuedContact): QueuedContact[] {
  const key = queueKey(item)
  return queue.some((queued) => queueKey(queued) === key) ? queue : [...queue, item]
}

/** Drops the notes that were delivered; anything else stays for the next try. */
export function removeDelivered(queue: QueuedContact[], deliveredKeys: string[]): QueuedContact[] {
  const delivered = new Set(deliveredKeys)
  return queue.filter((item) => !delivered.has(queueKey(item)))
}

/**
 * Whether a note should stay queued after the server answered with `status`.
 * Signed out, rate limited, or a server error can succeed later; anything
 * else (saved, or a request that will never be accepted) is done.
 */
export function isRetryableStatus(status: number): boolean {
  return status === 401 || status === 408 || status === 429 || status >= 500
}

/** The service worker's stand-in reply to an offline POST /api/contacts. */
export function isOfflineQueuedResponse(data: unknown): boolean {
  return !!data && typeof data === "object" && (data as { offline?: unknown }).offline === true
}

// Every open tab hears "online" at the same moment. Only one may send the
// queue, or each note becomes a contact once per tab. The lock expires so a
// tab closed mid-sync can't block syncing forever.
export const SYNC_LOCK_KEY = "savvo-offline-sync-lock"
export const SYNC_LOCK_TTL_MS = 60_000

export function tryAcquireSyncLock(
  nowMs: number = Date.now(),
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage
): boolean {
  try {
    const held = Number(storage.getItem(SYNC_LOCK_KEY) || 0)
    if (held && nowMs - held < SYNC_LOCK_TTL_MS) return false
    storage.setItem(SYNC_LOCK_KEY, String(nowMs))
    return true
  } catch {
    // No storage: syncing from this tab beats never syncing.
    return true
  }
}

export function releaseSyncLock(storage: Pick<Storage, "removeItem"> = localStorage) {
  try {
    storage.removeItem(SYNC_LOCK_KEY)
  } catch {
    // ignore
  }
}
