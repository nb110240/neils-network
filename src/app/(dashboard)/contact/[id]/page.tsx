"use client"

import { useEffect, useState, use } from "react"
import { useRouter } from "next/navigation"
import { Contact } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
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
import { useToast } from "@/components/ui/toast"
import { formatDate, getInitials } from "@/lib/utils"
import {
  ArrowLeft,
  Building2,
  Calendar,
  Edit2,
  ExternalLink,
  Globe,
  Loader2,
  Mail,
  Phone,
  Trash2,
} from "lucide-react"

export default function ContactDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const { addToast } = useToast()
  const [contact, setContact] = useState<Contact | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

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

    fetchContact()
  }, [id, router, addToast])

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
        title: "Contact deleted",
        description: "The contact has been removed from your network.",
      })
      router.push("/dashboard")
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

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <Skeleton className="h-8 w-32" />
        <Card>
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
        <Card>
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

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setIsEditing(true)}>
            <Edit2 className="mr-2 h-4 w-4" />
            Edit
          </Button>
          <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
            <DialogTrigger asChild>
              <Button variant="destructive">
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Delete Contact</DialogTitle>
                <DialogDescription>
                  Are you sure you want to delete {contact.name || "this contact"}?
                  This action cannot be undone.
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

      <Card>
        <CardContent className="p-6">
          <div className="flex items-start gap-4 mb-6">
            <Avatar className="h-16 w-16 text-lg">
              <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">
                  {contact.name || "Unknown Contact"}
                </h1>
                {contact.follow_up_needed && (
                  <Badge variant="warning">Follow-up Needed</Badge>
                )}
              </div>
              {contact.job_title && (
                <p className="text-lg text-muted-foreground">
                  {contact.job_title}
                </p>
              )}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {contact.company && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="h-4 w-4" />
                <span>{contact.company}</span>
              </div>
            )}
            {contact.email && (
              <a
                href={`mailto:${contact.email}`}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Mail className="h-4 w-4" />
                <span>{contact.email}</span>
              </a>
            )}
            {contact.phone && (
              <a
                href={`tel:${contact.phone}`}
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Phone className="h-4 w-4" />
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
                className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
              >
                <Globe className="h-4 w-4" />
                <span>{contact.website}</span>
                <ExternalLink className="h-3 w-3" />
              </a>
            )}
            {contact.last_contact_date && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Calendar className="h-4 w-4" />
                <span>Last contact: {formatDate(contact.last_contact_date)}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {contact.how_we_met && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">How We Met</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{contact.how_we_met}</p>
          </CardContent>
        </Card>
      )}

      {contact.next_steps && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Next Steps</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="whitespace-pre-wrap">{contact.next_steps}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Original Note</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap text-muted-foreground">
            {contact.raw_note}
          </p>
          <Separator className="my-4" />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Added: {formatDate(contact.created_at)}</span>
            <span>Updated: {formatDate(contact.updated_at)}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
