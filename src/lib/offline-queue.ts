// ─── Offline contact queue ───
// When /add is submitted offline, public/sw.js answers the POST itself and
// tells every open tab to store the note here. When the connection returns,
// the notes are sent to /api/contacts. public/sw.js keeps its own copy of
// isRetryableStatus (it can't import app code); keep the two in sync.

export const OFFLINE_QUEUE_KEY = "savvo-offline-queue"

/** `name` is set when the person confirmed one before going offline. */
export type QueuedContact = { raw_note: string; name?: string; queued_at: string }

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

/** Returns false when storage is full or blocked and the queue wasn't saved. */
export function writeQueue(queue: QueuedContact[], storage: Pick<Storage, "setItem"> = localStorage): boolean {
  try {
    storage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
    return true
  } catch {
    return false
  }
}

/**
 * Makes sure an offline note is stored before /add reports it saved. The
 * service worker's reply carries the note it queued; storing it here is a
 * no-op when a tab already did (same key). False: the note was not saved.
 */
export function persistQueuedNote(
  item: QueuedContact,
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage
): boolean {
  const queue = readQueue(storage)
  if (queue.some((queued) => queueKey(queued) === queueKey(item))) return true
  return writeQueue(enqueue(queue, item), storage)
}

/** The note a service worker reply says it queued, when it says so. */
export function queuedNoteFrom(data: unknown): QueuedContact | null {
  const queued = (data as { queued?: unknown } | null)?.queued as Partial<QueuedContact> | undefined
  if (!queued || typeof queued.raw_note !== "string" || typeof queued.queued_at !== "string") return null
  return {
    raw_note: queued.raw_note,
    queued_at: queued.queued_at,
    ...(typeof queued.name === "string" ? { name: queued.name } : {}),
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
// queue, or each note becomes a contact once per tab. The Web Locks API gives
// one tab exclusive ownership; browsers without it fall back to a
// localStorage lock, which expires so a tab closed mid-sync can't block
// syncing forever (the browser frees a Web Lock when its tab closes).
export const SYNC_LOCK_KEY = "savvo-offline-sync-lock"
export const SYNC_LOCK_TTL_MS = 60_000

type LockManagerLike = {
  request: (
    name: string,
    options: { ifAvailable: boolean },
    callback: (lock: unknown) => Promise<boolean>
  ) => Promise<boolean>
}

/**
 * Fallback lock: returns this tab's token when it took the lock, or null
 * while another tab holds an unexpired one.
 */
export function tryAcquireSyncLock(
  nowMs: number = Date.now(),
  storage: Pick<Storage, "getItem" | "setItem"> = localStorage,
  token: string = `${nowMs}-${Math.random().toString(36).slice(2)}`
): string | null {
  try {
    const held = Number((storage.getItem(SYNC_LOCK_KEY) || "").split("|")[0] || 0)
    if (held && nowMs - held < SYNC_LOCK_TTL_MS) return null
    storage.setItem(SYNC_LOCK_KEY, `${nowMs}|${token}`)
    return token
  } catch {
    // Storage blocked or full: no lock can be shared, and a queue that can't
    // be rewritten would resend its notes anyway. Wait for storage instead.
    return null
  }
}

/** Releases the fallback lock only if this tab still holds it. */
export function releaseSyncLock(token: string, storage: Pick<Storage, "getItem" | "removeItem"> = localStorage) {
  try {
    const value = storage.getItem(SYNC_LOCK_KEY) || ""
    if (value.slice(value.indexOf("|") + 1) === token) storage.removeItem(SYNC_LOCK_KEY)
  } catch {
    // ignore
  }
}

/**
 * Runs `sync` only if no other tab is syncing, holding the lock until it
 * settles. Resolves false when another tab holds the lock; its result
 * reaches this tab too.
 */
export async function withSyncLock(
  sync: () => Promise<void>,
  locks: LockManagerLike | undefined = typeof navigator !== "undefined"
    ? (navigator as unknown as { locks?: LockManagerLike }).locks
    : undefined,
  storage?: Pick<Storage, "getItem" | "setItem" | "removeItem">
): Promise<boolean> {
  if (locks?.request) {
    return locks.request(SYNC_LOCK_KEY, { ifAvailable: true }, async (lock) => {
      if (!lock) return false
      await sync().catch(() => {})
      return true
    })
  }
  const store = storage ?? localStorage
  const token = tryAcquireSyncLock(Date.now(), store)
  if (!token) return false
  try {
    await sync().catch(() => {})
    return true
  } finally {
    releaseSyncLock(token, store)
  }
}
