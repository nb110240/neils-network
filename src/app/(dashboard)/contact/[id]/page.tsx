"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { Contact, ContactActivity } from "@/lib/types"
import { HealthBadge } from "@/components/health-badge"
import { calculateHealthScore } from "@/lib/health"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { ContactForm } from "@/components/contact-form"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/components/ui/toast"
import { formatDate, getInitials } from "@/lib/utils"
import { TagManager } from "@/components/tag-manager"
import { DraftMessageButton } from "@/components/draft-message-button"
import {
  ArrowLeft,
  Building2,
  Calendar,
  Check,
  Edit2,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  MessageSquarePlus,
  Phone,
  Trash2,
} from "lucide-react"

const ACTIVITY_TYPES = [
  { value: "meeting", label: "Meeting" },
  { value: "call", label: "Call" },
  { value: "email", label: "Email" },
  { value: "note", label: "Note" },
  { value: "other", label: "Other" },
] as const

const ACTIVITY_TYPE_STYLES: Record<string, string> = {
  meeting: "bg-[var(--copper)]/10 text-[var(--copper)] border-[var(--copper)]/30",
  note: "bg-stone-100 text-stone-600 border-stone-300 dark:bg-stone-800 dark:text-stone-400 dark:border-stone-600",
  call: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800",
  email: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800",
  other: "bg-stone-50 text-stone-500 border-stone-200 dark:bg-stone-900 dark:text-stone-500 dark:border-stone-700",
}

const ACTIVITY_DOT_STYLES: Record<string, string> = {
  meeting: "border-[var(--copper)] bg-[var(--copper)]/10",
  note: "border-stone-400 bg-stone-100 dark:bg-stone-800 dark:border-stone-600",
  call: "border-blue-500 bg-blue-50 dark:bg-blue-950 dark:border-blue-700",
  email: "border-emerald-500 bg-emerald-50 dark:bg-emerald-950 dark:border-emerald-700",
  other: "border-stone-300 bg-white dark:bg-stone-900 dark:border-stone-600",
}

export default function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { addToast } = useToast()
  const [contact, setContact] = useState<Contact | null>(null)
  const [activities, setActivities] = useState<ContactActivity[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingActivities, setIsLoadingActivities] = useState(true)
  const [isFixing, setIsFixing] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [isMarkingFollowedUp, setIsMarkingFollowedUp] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showMeetingDialog, setShowMeetingDialog] = useState(false)
  const [meetingNote, setMeetingNote] = useState("")
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().split("T")[0])
  const [meetingFollowUp, setMeetingFollowUp] = useState(false)
  const [meetingType, setMeetingType] = useState<ContactActivity["type"]>("meeting")
  const [isAddingMeeting, setIsAddingMeeting] = useState(false)
  const [isRetryingEmbed, setIsRetryingEmbed] = useState(false)
  const [deletingActivityId, setDeletingActivityId] = useState<string | null>(null)

  useEffect(() => {
    const fetchContact = async () => {
      try {
        const response = await fetch(`/api/contacts/${id}`)
        if (!response.ok) {
          throw new Error("Contact not found")
        }
        const data = await response.json()
        setContact(data.contact)
      } catch {
        addToast({
          title: "Error",
          description: "Failed to load contact",
          variant: "destructive",
        })
        router.push("/dashboard")
      } finally {
        setIsLoading(false)
      }
    }

    const fetchActivities = async () => {
      try {
        const response = await fetch(`/api/contacts/${id}/activities`)
        if (response.ok) {
          const data = await response.json()
          setActivities(data.activities)
        }
      } catch {
        // Activities failing shouldn't block the page
      } finally {
        setIsLoadingActivities(false)
      }
    }

    fetchContact()
    fetchActivities()
  }, [id, router, addToast])

  const handleMarkFollowedUp = async () => {
    setIsMarkingFollowedUp(true)
    try {
      const today = new Date().toISOString().split("T")[0]
      const response = await fetch(`/api/contacts/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          follow_up_needed: false,
          last_contact_date: today,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to update contact")
      }

      const data = await response.json()
      setContact(data.contact)
      addToast({
        title: "Followed up!",
        description: "Contact marked as followed up.",
      })
    } catch {
      addToast({
        title: "Error",
        description: "Failed to update contact",
        variant: "destructive",
      })
    } finally {
      setIsMarkingFollowedUp(false)
    }
  }

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const response = await fetch(`/api/contacts/${id}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Failed to delete contact")
      }

      addToast({
        title: "Contact archived",
        description: "Contact archived. You can restore it from Settings.",
      })
      router.push("/contacts")
    } catch {
      addToast({
        title: "Error",
        description: "Failed to delete contact",
        variant: "destructive",
      })
    } finally {
      setIsDeleting(false)
      setShowDeleteDialog(false)
    }
  }

  const handleFix = async () => {
    setIsFixing(true)
    try {
      const response = await fetch(`/api/contacts/${id}/fix`, { method: "POST" })
      if (!response.ok) throw new Error("Fix failed")
      const data = await response.json()
      setContact(data.contact)
      addToast({ title: "Contact fixed!", description: "Fields have been extracted from your note." })
    } catch {
      addToast({ title: "Error", description: "Failed to fix contact", variant: "destructive" })
    } finally {
      setIsFixing(false)
    }
  }

  const handleRetryEmbed = async () => {
    setIsRetryingEmbed(true)
    try {
      const response = await fetch(`/api/contacts/${id}/embed`, { method: "POST" })
      if (!response.ok) throw new Error("Retry failed")
      const data = await response.json()
      if (data.status === "complete" && contact) {
        setContact({ ...contact, embedding_status: "complete" })
        addToast({ title: "Search enabled", description: "This contact can now be found via smart search." })
      } else {
        addToast({ title: "Still failing", description: "Embedding generation failed again. Try later.", variant: "destructive" })
      }
    } catch {
      addToast({ title: "Error", description: "Failed to retry embedding", variant: "destructive" })
    } finally {
      setIsRetryingEmbed(false)
    }
  }

  const handleAddActivity = async () => {
    if (!meetingNote.trim() || !contact) return
    setIsAddingMeeting(true)
    try {
      const response = await fetch(`/api/contacts/${id}/activities`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: meetingType,
          content: meetingNote.trim(),
          occurred_at: meetingDate + "T12:00:00",
          follow_up_needed: meetingFollowUp,
        }),
      })

      if (!response.ok) throw new Error("Failed to save activity")

      const data = await response.json()

      // Add to local state (newest first)
      setActivities((prev) => [data.activity, ...prev])

      // Update contact's local state
      const activityDate = new Date(meetingDate + "T12:00:00")
      const currentLastContact = contact.last_contact_date
        ? new Date(contact.last_contact_date)
        : null

      setContact((prev) => {
        if (!prev) return prev
        const updated = { ...prev, follow_up_needed: meetingFollowUp }
        if (!currentLastContact || activityDate > currentLastContact) {
          updated.last_contact_date = meetingDate
        }
        return updated
      })

      // Reset form
      setMeetingNote("")
      setMeetingDate(new Date().toISOString().split("T")[0])
      setMeetingFollowUp(false)
      setMeetingType("meeting")
      setShowMeetingDialog(false)
      addToast({ title: "Activity added", description: "Your notes have been saved." })
    } catch {
      addToast({ title: "Error", description: "Failed to save activity", variant: "destructive" })
    } finally {
      setIsAddingMeeting(false)
    }
  }

  const handleDeleteActivity = async (activityId: string) => {
    setDeletingActivityId(activityId)
    try {
      const response = await fetch(
        `/api/contacts/${id}/activities?activityId=${activityId}`,
        { method: "DELETE" }
      )

      if (!response.ok) throw new Error("Failed to delete activity")

      setActivities((prev) => prev.filter((a) => a.id !== activityId))
      addToast({ title: "Activity deleted" })
    } catch {
      addToast({ title: "Error", description: "Failed to delete activity", variant: "destructive" })
    } finally {
      setDeletingActivityId(null)
    }
  }

  // Extract the original note (before any --- separator)
  const getOriginalNote = (rawNote: string): string => {
    const firstSeparator = rawNote.indexOf("\n\n---\n\n")
    if (firstSeparator === -1) return rawNote.trim()
    return rawNote.substring(0, firstSeparator).trim()
  }

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-32" />
        <Card className="shadow-refined">
          <CardContent className="p-6">
            <div className="flex items-center gap-4 mb-6">
              <Skeleton className="h-16 w-16 rounded-full" />
              <div className="space-y-2">
                <Skeleton className="h-6 w-48" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
            <div className="space-y-4">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!contact) {
    return null
  }

  if (isEditing) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => setIsEditing(false)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Cancel Edit
        </Button>
        <Card className="shadow-refined">
          <CardHeader>
            <CardTitle>Edit Contact</CardTitle>
          </CardHeader>
          <CardContent>
            <ContactForm
              contact={contact}
              onCancel={() => setIsEditing(false)}
            />
          </CardContent>
        </Card>
      </div>
    )
  }

  const health = (contact as Contact & { health?: import("@/lib/types").HealthScore }).health
    ?? calculateHealthScore(contact.last_contact_date, contact.created_at)

  const originalNote = getOriginalNote(contact.raw_note)

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top bar */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <Button variant="ghost" onClick={() => router.back()} className="self-start">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => setIsEditing(true)}>
            <Edit2 className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowMeetingDialog(true)}>
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            Add Activity
          </Button>
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogTrigger asChild>
              <Button variant="destructive" size="sm">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Contact</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete {contact.name || "this contact"}?
                  You can restore it from Settings within 30 days.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteDialog(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={isDeleting}
                >
                  {isDeleting && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Delete
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Embedding failed banner */}
      {contact.embedding_status === "failed" && (
        <div className="flex items-center justify-between rounded-lg border border-orange-500/40 bg-orange-500/10 px-4 py-3">
          <p className="text-sm text-orange-700 dark:text-orange-400">
            This contact can&apos;t be found via smart search.
          </p>
          <Button size="sm" variant="outline" onClick={handleRetryEmbed} disabled={isRetryingEmbed}>
            {isRetryingEmbed ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Retry
          </Button>
        </div>
      )}

      {/* Fix banner */}
      {!contact.name && (
        <div className="flex items-center justify-between rounded-lg border border-yellow-500/40 bg-yellow-500/10 px-4 py-3">
          <p className="text-sm text-yellow-700 dark:text-yellow-400">
            Contact info couldn&apos;t be extracted automatically. Click &quot;Fix Contact&quot; to try again.
          </p>
          <Button size="sm" onClick={handleFix} disabled={isFixing}>
            {isFixing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            Fix Contact
          </Button>
        </div>
      )}

      {/* Header card */}
      <Card className="shadow-refined">
        <CardContent className="p-6">
          <div className="flex items-center gap-4 mb-6">
            <Avatar className="h-14 w-14 text-lg">
              <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-2xl font-semibold tracking-tight">
                  {contact.name || "Unknown Contact"}
                </h1>
                <HealthBadge health={health} />
                {contact.follow_up_needed && (
                  <>
                    <Badge variant="warning">Follow-up Needed</Badge>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleMarkFollowedUp}
                      disabled={isMarkingFollowedUp}
                      className="h-6 text-xs"
                    >
                      {isMarkingFollowedUp ? (
                        <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      ) : (
                        <Check className="mr-1 h-3 w-3" />
                      )}
                      Mark Followed Up
                    </Button>
                  </>
                )}
              </div>
              {(contact.job_title || contact.company) && (
                <p className="text-base text-muted-foreground mt-0.5">
                  {contact.job_title}
                  {contact.job_title && contact.company && " at "}
                  {contact.company}
                </p>
              )}
            </div>
          </div>

          {/* Contact info grid */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail className="h-4 w-4 shrink-0" />
                <span className="truncate">{contact.email}</span>
              </a>
            )}
            {contact.phone && (
              <a
                href={`tel:${contact.phone}`}
                className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Phone className="h-4 w-4 shrink-0" />
                <span>{contact.phone}</span>
              </a>
            )}
            {contact.website && (
              <a
                href={
                  contact.website.startsWith("http")
                    ? contact.website
                    : `https://${contact.website}`
                }
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Globe className="h-4 w-4 shrink-0" />
                <span className="truncate">{contact.website}</span>
                <ExternalLink className="h-3 w-3 shrink-0" />
              </a>
            )}
            {contact.company && !contact.job_title && (
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4 shrink-0" />
                <span>{contact.company}</span>
              </div>
            )}
            {contact.last_contact_date && (
              <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
                <Calendar className="h-4 w-4 shrink-0" />
                <span>Last contact: {formatDate(contact.last_contact_date)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Tags */}
      <Card className="shadow-refined">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium">Tags</CardTitle>
        </CardHeader>
        <CardContent>
          <TagManager contactId={id} />
        </CardContent>
      </Card>

      {/* How We Met */}
      {contact.how_we_met && (
        <Card className="shadow-refined">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">How We Met</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{contact.how_we_met}</p>
          </CardContent>
        </Card>
      )}

      {/* Next Steps */}
      {contact.next_steps && (
        <Card className="shadow-refined">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">Next Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">{contact.next_steps}</p>
          </CardContent>
        </Card>
      )}

      {/* Original Note */}
      {originalNote && (
        <Card className="shadow-refined">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-medium">How we met / Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
              {originalNote}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Activity Timeline */}
      <Card className="shadow-refined">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-medium">Activity Timeline</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMeetingDialog(true)}
              className="h-7 text-xs"
            >
              <MessageSquarePlus className="mr-1.5 h-3.5 w-3.5" />
              Add
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingActivities ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4">
                  <Skeleton className="h-4 w-4 rounded-full shrink-0 mt-1" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : activities.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">No activities yet.</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowMeetingDialog(true)}
                className="mt-3"
              >
                <MessageSquarePlus className="mr-2 h-4 w-4" />
                Log your first interaction
              </Button>
            </div>
          ) : (
            <div className="relative">
              {/* Vertical timeline line */}
              {activities.length > 1 && (
                <div className="absolute left-[7px] top-2 bottom-2 w-px bg-border" />
              )}

              <div className="space-y-0">
                {activities.map((activity, index) => {
                  const isLast = index === activities.length - 1

                  return (
                    <div
                      key={activity.id}
                      className="group relative flex gap-4 pb-6 last:pb-0"
                    >
                      {/* Timeline dot */}
                      <div className="relative z-10 mt-1.5 shrink-0">
                        <div
                          className={`h-[15px] w-[15px] rounded-full border-2 ${
                            ACTIVITY_DOT_STYLES[activity.type] || ACTIVITY_DOT_STYLES.other
                          }`}
                        />
                      </div>

                      {/* Content */}
                      <div className={`flex-1 min-w-0 ${!isLast ? "pb-2" : ""}`}>
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 h-5 font-medium capitalize ${
                              ACTIVITY_TYPE_STYLES[activity.type] || ACTIVITY_TYPE_STYLES.other
                            }`}
                          >
                            {activity.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(activity.occurred_at)}
                          </span>
                          {activity.follow_up_needed && (
                            <Badge variant="warning" className="text-[10px] px-1.5 py-0 h-5">
                              Follow-up
                            </Badge>
                          )}
                          {/* Delete button - visible on hover */}
                          <button
                            onClick={() => handleDeleteActivity(activity.id)}
                            disabled={deletingActivityId === activity.id}
                            className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
                            title="Delete activity"
                          >
                            {deletingActivityId === activity.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                        <p className="text-sm whitespace-pre-wrap leading-relaxed">
                          {activity.content}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Activity Dialog */}
      <Dialog open={showMeetingDialog} onOpenChange={setShowMeetingDialog}>
        <DialogContent className="sm:max-w-lg max-w-[calc(100vw-2rem)]">
          <DialogHeader>
            <DialogTitle>Add Activity</DialogTitle>
            <DialogDescription>
              Log an interaction with {contact.name || "this contact"}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Activity type selector */}
            <div className="space-y-1">
              <label className="text-sm font-medium">Type</label>
              <div className="flex flex-wrap gap-2">
                {ACTIVITY_TYPES.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMeetingType(value)}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors ${
                      meetingType === value
                        ? ACTIVITY_TYPE_STYLES[value] + " ring-1 ring-offset-1 ring-current"
                        : "border-input bg-background text-muted-foreground hover:bg-accent"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1">
              <label htmlFor="meeting-date" className="text-sm font-medium">Date</label>
              <input
                id="meeting-date"
                type="date"
                value={meetingDate}
                onChange={(e) => setMeetingDate(e.target.value)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
            <div className="space-y-1">
              <label htmlFor="meeting-notes" className="text-sm font-medium">Notes</label>
              <Textarea
                id="meeting-notes"
                placeholder="What did you talk about? Any follow-ups?"
                value={meetingNote}
                onChange={(e) => setMeetingNote(e.target.value)}
                rows={5}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border px-3 py-2">
              <div>
                <p className="text-sm font-medium">Follow-up needed</p>
                <p className="text-xs text-muted-foreground">Remind yourself to follow up</p>
              </div>
              <Switch
                checked={meetingFollowUp}
                onCheckedChange={setMeetingFollowUp}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowMeetingDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleAddActivity} disabled={isAddingMeeting || !meetingNote.trim()}>
              {isAddingMeeting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Activity
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
