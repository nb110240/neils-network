"use client"

import { useState, useEffect, useCallback } from "react"
import { Contact } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/components/ui/toast"
import {
  Trash2,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  Loader2,
  Archive,
} from "lucide-react"

function timeAgo(dateString: string): string {
  const now = new Date()
  const date = new Date(dateString)
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000)

  if (seconds < 60) return "just now"
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes !== 1 ? "s" : ""} ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} hour${hours !== 1 ? "s" : ""} ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} day${days !== 1 ? "s" : ""} ago`
  const months = Math.floor(days / 30)
  return `${months} month${months !== 1 ? "s" : ""} ago`
}

export function RecentlyDeleted() {
  const { addToast } = useToast()
  const [contacts, setContacts] = useState<Contact[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isExpanded, setIsExpanded] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  const fetchArchived = useCallback(async () => {
    setIsLoading(true)
    try {
      const res = await fetch("/api/contacts/archived")
      if (!res.ok) throw new Error("Failed to fetch")
      const data = await res.json()
      setContacts(data.contacts)
    } catch {
      // Silently fail on initial load
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchArchived()
  }, [fetchArchived])

  const handleRestore = async (contactId: string) => {
    setRestoringId(contactId)
    try {
      const res = await fetch("/api/contacts/archived", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId }),
      })
      if (!res.ok) throw new Error("Failed to restore")
      setContacts((prev) => prev.filter((c) => c.id !== contactId))
      addToast({
        title: "Contact restored",
        description: "The contact is back in your network.",
      })
    } catch {
      addToast({
        title: "Error",
        description: "Failed to restore contact",
        variant: "destructive",
      })
    } finally {
      setRestoringId(null)
    }
  }

  const handlePermanentDelete = async (contactId: string) => {
    setDeletingId(contactId)
    try {
      const res = await fetch("/api/contacts/archived", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ contactId }),
      })
      if (!res.ok) throw new Error("Failed to delete")
      setContacts((prev) => prev.filter((c) => c.id !== contactId))
      addToast({
        title: "Permanently deleted",
        description: "The contact has been permanently removed.",
      })
    } catch {
      addToast({
        title: "Error",
        description: "Failed to delete contact",
        variant: "destructive",
      })
    } finally {
      setDeletingId(null)
      setConfirmDeleteId(null)
    }
  }

  const contactToDelete = contacts.find((c) => c.id === confirmDeleteId)

  return (
    <>
      <Card className="shadow-refined">
        <CardHeader
          className="cursor-pointer select-none"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <CardTitle className="flex items-center gap-2 text-lg font-normal">
            <Archive className="h-4 w-4 text-muted-foreground" />
            <span className="flex-1">Recently Deleted</span>
            {contacts.length > 0 && (
              <span className="text-sm font-normal text-muted-foreground">
                {contacts.length} contact{contacts.length !== 1 ? "s" : ""}
              </span>
            )}
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            )}
          </CardTitle>
        </CardHeader>
        {isExpanded && (
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : contacts.length === 0 ? (
              <p className="text-sm text-muted-foreground py-2">
                No recently deleted contacts
              </p>
            ) : (
              <div className="space-y-2">
                {contacts.map((contact) => (
                  <div
                    key={contact.id}
                    className="flex items-center justify-between gap-3 rounded-lg border px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        {contact.name || "Unknown Contact"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {contact.company && (
                          <span>{contact.company} &middot; </span>
                        )}
                        Deleted {contact.archived_at ? timeAgo(contact.archived_at) : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleRestore(contact.id)}
                        disabled={restoringId === contact.id}
                        className="h-8 text-xs"
                      >
                        {restoringId === contact.id ? (
                          <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                        ) : (
                          <RotateCcw className="mr-1.5 h-3 w-3" />
                        )}
                        Restore
                      </Button>
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={() => setConfirmDeleteId(contact.id)}
                        disabled={deletingId === contact.id}
                        className="h-8 text-xs"
                      >
                        {deletingId === contact.id ? (
                          <Loader2 className="mr-1.5 h-3 w-3 animate-spin" />
                        ) : (
                          <Trash2 className="mr-1.5 h-3 w-3" />
                        )}
                        Delete Forever
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground pt-1">
              Deleted contacts are kept for 30 days before being permanently removed.
            </p>
          </CardContent>
        )}
      </Card>

      {/* Confirm permanent delete dialog */}
      <Dialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null)
        }}
      >
        <DialogContent className="max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle>Permanently Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to permanently delete{" "}
              {contactToDelete?.name || "this contact"}? This action cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDeleteId(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmDeleteId) handlePermanentDelete(confirmDeleteId)
              }}
              disabled={deletingId !== null}
            >
              {deletingId !== null && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Delete Forever
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
