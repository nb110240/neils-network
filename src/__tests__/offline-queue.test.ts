import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"
import {
  OFFLINE_QUEUE_KEY,
  SYNC_LOCK_TTL_MS,
  enqueue,
  isOfflineQueuedResponse,
  isRetryableStatus,
  persistQueuedNote,
  queueKey,
  queuedNoteFrom,
  readQueue,
  releaseSyncLock,
  removeDelivered,
  tryAcquireSyncLock,
  withSyncLock,
  writeQueue,
} from "@/lib/offline-queue"

function memoryStorage(initial: Record<string, string> = {}) {
  const map = new Map(Object.entries(initial))
  return {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  }
}

const a = { raw_note: "Met Priya at the YC dinner", queued_at: "2026-10-02T10:00:00.000Z" }
const b = { raw_note: "Coffee with Sam from Index", queued_at: "2026-10-02T10:05:00.000Z" }

describe("offline contact queue", () => {
  it("recognises the service worker's stand-in reply, which has no contact id (regression: /contact/undefined)", () => {
    const swReply = { success: true, offline: true, message: "Saved offline.", contact: { name: "Pending...", raw_note: "x" } }
    expect(isOfflineQueuedResponse(swReply)).toBe(true)
    expect(isOfflineQueuedResponse({ success: true, contact: { id: "c-1" } })).toBe(false)
    expect(isOfflineQueuedResponse(null)).toBe(false)
  })

  it("stores a note once even though every open tab hears the same message", () => {
    let queue = enqueue([], a)
    queue = enqueue(queue, { ...a })
    queue = enqueue(queue, b)
    expect(queue).toEqual([a, b])
  })

  it("keeps notes that weren't delivered (regression: a failed sync cleared the queue)", () => {
    expect(removeDelivered([a, b], [queueKey(a)])).toEqual([b])
    expect(removeDelivered([a, b], [])).toEqual([a, b])
  })

  it("retries only answers that can succeed later", () => {
    for (const status of [401, 408, 429, 500, 503]) expect(isRetryableStatus(status)).toBe(true)
    for (const status of [200, 201, 400, 403, 409, 422]) expect(isRetryableStatus(status)).toBe(false)
  })

  it("matches the service worker's copy of the retry rule and queue key", () => {
    const sw = fs.readFileSync(path.join(process.cwd(), "public/sw.js"), "utf8")
    expect(sw).toContain("return status === 401 || status === 408 || status === 429 || status >= 500")
    expect(sw).toContain("delivered.push(`${item.queued_at}|${item.raw_note}`)")
    expect(queueKey(a)).toBe(`${a.queued_at}|${a.raw_note}`)
  })

  it("survives corrupt storage", () => {
    expect(readQueue(memoryStorage({ [OFFLINE_QUEUE_KEY]: "{not json" }))).toEqual([])
    expect(readQueue(memoryStorage({ [OFFLINE_QUEUE_KEY]: '{"a":1}' }))).toEqual([])
    const storage = memoryStorage()
    writeQueue([a], storage)
    expect(readQueue(storage)).toEqual([a])
  })

  it("lets only one tab sync at a time, and a stale lock can't block forever", () => {
    const storage = memoryStorage()
    expect(tryAcquireSyncLock(1_000, storage, "tab-a")).toBe("tab-a")
    expect(tryAcquireSyncLock(2_000, storage, "tab-b")).toBeNull()
    expect(tryAcquireSyncLock(1_000 + SYNC_LOCK_TTL_MS, storage, "tab-c")).toBe("tab-c")
    // tab-a's lock expired and was taken over: its release must not free tab-c's.
    releaseSyncLock("tab-a", storage)
    expect(tryAcquireSyncLock(1_000 + SYNC_LOCK_TTL_MS + 1, storage, "tab-d")).toBeNull()
    releaseSyncLock("tab-c", storage)
    expect(tryAcquireSyncLock(1_000 + SYNC_LOCK_TTL_MS + 2, storage, "tab-d")).toBe("tab-d")
  })

  it("reports a queue write that storage refused", () => {
    const full = { ...memoryStorage(), setItem: () => { throw new Error("QuotaExceededError") } }
    expect(writeQueue([a], full)).toBe(false)
    expect(writeQueue([a], memoryStorage())).toBe(true)
    expect(persistQueuedNote(a, full)).toBe(false)
  })

  it("stores the note from the service worker's reply once, whichever side writes first", () => {
    const storage = memoryStorage()
    const reply = { success: true, offline: true, queued: { ...a, name: "Priya" } }
    const note = queuedNoteFrom(reply)
    expect(note).toEqual({ ...a, name: "Priya" })
    expect(persistQueuedNote(note!, storage)).toBe(true)
    // The tab's OFFLINE_QUEUE_ADD handler stores the same note: no duplicate.
    writeQueue(enqueue(readQueue(storage), { ...a, name: "Priya" }), storage)
    expect(persistQueuedNote(note!, storage)).toBe(true)
    expect(readQueue(storage)).toHaveLength(1)
    // A reply from an older worker carries no note.
    expect(queuedNoteFrom({ offline: true })).toBeNull()
  })

  it("gives exactly one tab the Web Lock while it syncs", async () => {
    const held = new Set<string>()
    const locks = {
      request: async (name: string, _opts: { ifAvailable: boolean }, cb: (lock: unknown) => Promise<boolean>) => {
        if (held.has(name)) return cb(null)
        held.add(name)
        try {
          return await cb({ name })
        } finally {
          held.delete(name)
        }
      },
    }
    let finish!: () => void
    const sends: string[] = []
    const first = withSyncLock(() => new Promise<void>((resolve) => { sends.push("tab-1"); finish = resolve }), locks)
    const second = await withSyncLock(async () => { sends.push("tab-2") }, locks)
    expect(second).toBe(false)
    finish()
    expect(await first).toBe(true)
    expect(sends).toEqual(["tab-1"])
    // Free again once the first tab finished.
    expect(await withSyncLock(async () => { sends.push("tab-3") }, locks)).toBe(true)
  })

  it("falls back to the storage lock without Web Locks", async () => {
    const storage = memoryStorage()
    let finish!: () => void
    const first = withSyncLock(() => new Promise<void>((resolve) => { finish = resolve }), undefined, storage)
    expect(await withSyncLock(async () => {}, undefined, storage)).toBe(false)
    finish()
    expect(await first).toBe(true)
    expect(await withSyncLock(async () => {}, undefined, storage)).toBe(true)
  })
})
