"use client"

import { useState, useEffect, useCallback } from "react"
import { WifiOff, Loader2, Check } from "lucide-react"
import {
  enqueue,
  isRetryableStatus,
  queueKey,
  readQueue,
  releaseSyncLock,
  removeDelivered,
  tryAcquireSyncLock,
  writeQueue,
  type QueuedContact,
} from "@/lib/offline-queue"

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false)
  const [queueCount, setQueueCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncDone, setSyncDone] = useState(false)

  const updateQueueCount = useCallback(() => {
    setQueueCount(readQueue().length)
  }, [])

  const finishSync = useCallback((delivered: string[]) => {
    // Re-read: another tab may have queued more while this sync ran.
    const remaining = removeDelivered(readQueue(), delivered)
    writeQueue(remaining)
    releaseSyncLock()
    setQueueCount(remaining.length)
    setIsSyncing(false)
    if (remaining.length === 0) {
      setSyncDone(true)
      setTimeout(() => setSyncDone(false), 3000)
    }
  }, [])

  const syncOfflineQueue = useCallback(async (queue: QueuedContact[]) => {
    // Another tab is already sending these; its result reaches this tab too.
    if (!tryAcquireSyncLock()) return
    setIsSyncing(true)

    // Try sending via service worker first
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "SYNC_OFFLINE_QUEUE",
        queue,
      })
    } else {
      // Fallback: sync directly
      const delivered: string[] = []
      for (const item of queue) {
        try {
          const response = await fetch("/api/contacts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            // Nobody is there to answer a name prompt during background sync.
            body: JSON.stringify({ raw_note: item.raw_note, allow_unnamed: true }),
          })
          if (isRetryableStatus(response.status)) break
          delivered.push(queueKey(item))
        } catch {
          break
        }
      }
      finishSync(delivered)
    }
  }, [finishSync])

  useEffect(() => {
    setIsOffline(!navigator.onLine)
    updateQueueCount()
    // Notes left from a sync that couldn't finish (or a closed tab): retry now.
    const pending = readQueue()
    if (navigator.onLine && pending.length > 0) {
      syncOfflineQueue(pending)
    }

    const handleOnline = () => {
      setIsOffline(false)
      // Auto-sync queued contacts
      const queue = readQueue()
      if (queue.length > 0) {
        syncOfflineQueue(queue)
      }
    }

    const handleOffline = () => setIsOffline(true)

    window.addEventListener("online", handleOnline)
    window.addEventListener("offline", handleOffline)

    // Listen for service worker messages
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === "OFFLINE_QUEUE_ADD") {
        // Every open tab hears this; enqueue skips a note another tab stored.
        const queue = enqueue(readQueue(), event.data.data)
        writeQueue(queue)
        setQueueCount(queue.length)
      }
      if (event.data?.type === "OFFLINE_SYNC_COMPLETE") {
        // A worker from before this release sends no list; it tried every note.
        const delivered: string[] = Array.isArray(event.data.delivered)
          ? event.data.delivered
          : readQueue().map(queueKey)
        finishSync(delivered)
      }
    }

    navigator.serviceWorker?.addEventListener("message", handleMessage)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      navigator.serviceWorker?.removeEventListener("message", handleMessage)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- listeners are stable, only mount once
  }, [])

  // Nothing to show
  if (!isOffline && queueCount === 0 && !isSyncing && !syncDone) {
    return null
  }

  return (
    <div className="fixed top-16 left-0 right-0 z-30 flex justify-center pointer-events-none">
      <div className="pointer-events-auto mx-4 mt-2 inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium shadow-lg border bg-background">
        {isOffline && (
          <>
            <WifiOff className="h-4 w-4 text-orange-500" />
            <span className="text-orange-700 dark:text-orange-300">
              Offline
              {queueCount > 0 && ` · ${queueCount} contact${queueCount > 1 ? "s" : ""} queued`}
            </span>
          </>
        )}
        {isSyncing && (
          <>
            <Loader2 className="h-4 w-4 text-[var(--copper-text)] animate-spin" />
            <span>Syncing {queueCount} contact{queueCount > 1 ? "s" : ""}...</span>
          </>
        )}
        {!isOffline && !isSyncing && !syncDone && queueCount > 0 && (
          <>
            <Loader2 className="h-4 w-4 text-[var(--copper-text)]" />
            <span>{queueCount} contact{queueCount > 1 ? "s" : ""} waiting to sync</span>
          </>
        )}
        {syncDone && (
          <>
            <Check className="h-4 w-4 text-green-500" />
            <span className="text-green-700 dark:text-green-300">All contacts synced</span>
          </>
        )}
      </div>
    </div>
  )
}
