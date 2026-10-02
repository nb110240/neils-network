import { describe, expect, it } from "vitest"
import fs from "node:fs"
import path from "node:path"
import {
  OFFLINE_QUEUE_KEY,
  SYNC_LOCK_TTL_MS,
  enqueue,
  isOfflineQueuedResponse,
  isRetryableStatus,
  queueKey,
  readQueue,
  releaseSyncLock,
  removeDelivered,
  tryAcquireSyncLock,
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
    expect(tryAcquireSyncLock(1_000, storage)).toBe(true)
    expect(tryAcquireSyncLock(2_000, storage)).toBe(false)
    expect(tryAcquireSyncLock(1_000 + SYNC_LOCK_TTL_MS, storage)).toBe(true)
    releaseSyncLock(storage)
    expect(tryAcquireSyncLock(1_000 + SYNC_LOCK_TTL_MS + 1, storage)).toBe(true)
  })
})
