"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Contact, ContactFormData } from "@/lib/types"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { useToast } from "@/components/ui/toast"
import { Loader2 } from "lucide-react"

interface ContactFormProps {
  contact: Contact
  onCancel: () => void
}

export function ContactForm({ contact, onCancel }: ContactFormProps) {
  const router = useRouter()
  const { addToast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [formData, setFormData] = useState<ContactFormData>({
    name: contact.name || "",
    email: contact.email || "",
    phone: contact.phone || "",
    company: contact.company || "",
    job_title: contact.job_title || "",
    website: contact.website || "",
    how_we_met: contact.how_we_met || "",
    next_steps: contact.next_steps || "",
    follow_up_needed: contact.follow_up_needed,
    last_contact_date: contact.last_contact_date || "",
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const response = await fetch(`/api/contacts/${contact.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => ({}))
        throw new Error(data.error || "Failed to update contact")
      }

      addToast({
        title: "Success",
        description: "Contact updated successfully",
      })
      router.refresh()
      onCancel()
    } catch (err) {
      addToast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update contact",
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="name">Name</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, name: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            type="email"
            value={formData.email}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, email: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="phone">Phone</Label>
          <Input
            id="phone"
            value={formData.phone}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, phone: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="company">Company</Label>
          <Input
            id="company"
            value={formData.company}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, company: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="job_title">Job Title</Label>
          <Input
            id="job_title"
            value={formData.job_title}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, job_title: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="website">Website</Label>
          <Input
            id="website"
            value={formData.website}
            onChange={(e) =>
              setFormData((prev) => ({ ...prev, website: e.target.value }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="last_contact_date">Last Contact Date</Label>
          <Input
            id="last_contact_date"
            type="date"
            value={formData.last_contact_date}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                last_contact_date: e.target.value,
              }))
            }
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="follow_up_needed">Follow-up Needed</Label>
          <div className="flex items-center pt-2">
            <Switch
              checked={formData.follow_up_needed}
              onCheckedChange={(checked) =>
                setFormData((prev) => ({ ...prev, follow_up_needed: checked }))
              }
            />
          </div>
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="how_we_met">How We Met</Label>
        <Textarea
          id="how_we_met"
          value={formData.how_we_met}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, how_we_met: e.target.value }))
          }
          rows={3}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="next_steps">Next Steps</Label>
        <Textarea
          id="next_steps"
          value={formData.next_steps}
          onChange={(e) =>
            setFormData((prev) => ({ ...prev, next_steps: e.target.value }))
          }
          rows={3}
        />
      </div>
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isLoading}>
          {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </div>
    </form>
  )
}
