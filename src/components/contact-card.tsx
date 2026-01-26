import Link from "next/link"
import { Contact } from "@/lib/types"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { formatDate, getInitials } from "@/lib/utils"
import { Building2, Mail, Phone } from "lucide-react"

interface ContactCardProps {
  contact: Contact
  showSimilarity?: boolean
  similarity?: number
}

export function ContactCard({
  contact,
  showSimilarity,
  similarity,
}: ContactCardProps) {
  return (
    <Link href={`/contact/${contact.id}`}>
      <Card className="transition-all hover:shadow-md hover:border-primary/20 cursor-pointer">
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar>
                <AvatarFallback>{getInitials(contact.name)}</AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-semibold">
                  {contact.name || "Unknown Contact"}
                </h3>
                {contact.job_title && (
                  <p className="text-sm text-muted-foreground">
                    {contact.job_title}
                  </p>
                )}
              </div>
            </div>
            <div className="flex gap-2">
              {contact.follow_up_needed && (
                <Badge variant="warning">Follow-up</Badge>
              )}
              {showSimilarity && similarity !== undefined && (
                <Badge variant="secondary">
                  {Math.round(similarity * 100)}% match
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {contact.company && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4" />
              <span>{contact.company}</span>
            </div>
          )}
          {contact.email && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Mail className="h-4 w-4" />
              <span>{contact.email}</span>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Phone className="h-4 w-4" />
              <span>{contact.phone}</span>
            </div>
          )}
          {contact.how_we_met && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-2">
              {contact.how_we_met}
            </p>
          )}
          <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
            <span>Added {formatDate(contact.created_at)}</span>
            {contact.last_contact_date && (
              <span>Last contact: {formatDate(contact.last_contact_date)}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
