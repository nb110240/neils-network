import Link from "next/link"
import { Contact } from "@/lib/types"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { formatDate, getInitials } from "@/lib/utils"
import { Building2, Mail, Phone, ArrowUpRight } from "lucide-react"

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
      <Card className="glass shadow-refined card-glow transition-all hover:shadow-refined-lg hover:-translate-y-0.5 cursor-pointer group overflow-hidden">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <Avatar className="h-11 w-11 border-2 border-[var(--copper)]/20">
                <AvatarFallback className="bg-gradient-to-br from-[var(--copper)]/10 to-[var(--copper)]/5 text-[var(--copper)] font-medium">
                  {getInitials(contact.name)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h3 className="font-medium text-base group-hover:text-[var(--copper)] transition-colors flex items-center gap-1">
                  {contact.name || "Unknown Contact"}
                  <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
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
                <Badge variant="warning" className="text-xs">Follow-up</Badge>
              )}
              {showSimilarity && similarity !== undefined && (
                <Badge variant="secondary" className="text-xs font-medium">
                  {Math.round(similarity * 100)}% match
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-2.5">
          {contact.company && (
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Building2 className="h-4 w-4 text-[var(--copper)]/60" />
              <span>{contact.company}</span>
            </div>
          )}
          {contact.email && (
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Mail className="h-4 w-4 text-[var(--copper)]/60" />
              <span className="truncate">{contact.email}</span>
            </div>
          )}
          {contact.phone && (
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <Phone className="h-4 w-4 text-[var(--copper)]/60" />
              <span>{contact.phone}</span>
            </div>
          )}
          {contact.how_we_met && (
            <p className="text-sm text-muted-foreground line-clamp-2 mt-3 pt-3 border-t border-dashed">
              {contact.how_we_met}
            </p>
          )}
          <div className="flex items-center justify-between pt-3 text-xs text-muted-foreground border-t">
            <span>Added {formatDate(contact.created_at)}</span>
            {contact.last_contact_date && (
              <span>Last: {formatDate(contact.last_contact_date)}</span>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
