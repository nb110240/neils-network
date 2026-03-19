"use client"

import { useState, useEffect, useCallback } from "react"
import { WifiOff, Loader2, Check } from "lucide-react"

const QUEUE_KEY = "savvo-offline-queue"

function getQueue(): { raw_note: string; queued_at: string }[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]")
  } catch {
    return []
  }
}

function saveQueue(queue: { raw_note: string; queued_at: string }[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue))
}

export function OfflineIndicator() {
  const [isOffline, setIsOffline] = useState(false)
  const [queueCount, setQueueCount] = useState(0)
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncDone, setSyncDone] = useState(false)

  const updateQueueCount = useCallback(() => {
    setQueueCount(getQueue().length)
  }, [])

  useEffect(() => {
    setIsOffline(!navigator.onLine)
    updateQueueCount()

    const handleOnline = () => {
      setIsOffline(false)
      // Auto-sync queued contacts
      const queue = getQueue()
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
        const queue = getQueue()
        queue.push(event.data.data)
        saveQueue(queue)
        setQueueCount(queue.length)
      }
      if (event.data?.type === "OFFLINE_SYNC_COMPLETE") {
        saveQueue([])
        setQueueCount(0)
        setIsSyncing(false)
        setSyncDone(true)
        setTimeout(() => setSyncDone(false), 3000)
      }
    }

    navigator.serviceWorker?.addEventListener("message", handleMessage)

    return () => {
      window.removeEventListener("online", handleOnline)
      window.removeEventListener("offline", handleOffline)
      navigator.serviceWorker?.removeEventListener("message", handleMessage)
    }
  }, [updateQueueCount])

  async function syncOfflineQueue(queue: { raw_note: string; queued_at: string }[]) {
    setIsSyncing(true)

    // Try sending via service worker first
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.controller.postMessage({
        type: "SYNC_OFFLINE_QUEUE",
        queue,
      })
    } else {
      // Fallback: sync directly
      for (const item of queue) {
        try {
          await fetch("/api/contacts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ raw_note: item.raw_note }),
          })
        } catch {
          break
        }
      }
      saveQueue([])
      setQueueCount(0)
      setIsSyncing(false)
      setSyncDone(true)
      setTimeout(() => setSyncDone(false), 3000)
    }
  }

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
            <Loader2 className="h-4 w-4 text-[var(--copper)] animate-spin" />
            <span>Syncing {queueCount} contact{queueCount > 1 ? "s" : ""}...</span>
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
