import Link from "next/link"
import { Contact, type HealthScore } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { HealthBadge } from "@/components/health-badge"
import { formatDate, getInitials } from "@/lib/utils"

interface ContactCardProps {
  contact: Contact & { health?: HealthScore }
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
      <Card className="shadow-refined transition-all hover:shadow-refined-lg hover:-translate-y-0.5 cursor-pointer group h-full">
        <CardContent className="p-5 flex flex-col h-full">
          {/* Top: Avatar + Name + Health */}
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-10 w-10 shrink-0">
              <AvatarFallback className="bg-[var(--copper)]/8 text-[var(--copper)] text-sm font-medium">
                {getInitials(contact.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <h3 className="font-semibold text-base group-hover:text-[var(--copper)] transition-colors truncate min-h-[1.5rem]">
                {contact.name || "Unknown Contact"}
              </h3>
              {(contact.job_title || contact.company) && (
                <p className="text-sm text-muted-foreground truncate">
                  {[contact.job_title, contact.company].filter(Boolean).join(", ")}
                </p>
              )}
            </div>
          </div>

          {/* Middle: How we met */}
          {contact.how_we_met && (
            <p className="text-sm text-muted-foreground line-clamp-2 mb-3 flex-1">
              {contact.how_we_met}
            </p>
          )}
          {!contact.how_we_met && <div className="flex-1" />}

          {/* Bottom: Tags + Dates */}
          <div className="pt-3 border-t space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              {contact.health && <HealthBadge health={contact.health} />}
              {contact.follow_up_needed && (
                <Badge variant="warning" className="text-xs">Follow-up</Badge>
              )}
              {showSimilarity && similarity !== undefined && (
                <Badge variant="secondary" className="text-xs">
                  {Math.round(similarity * 100)}% match
                </Badge>
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatDate(contact.created_at)}</span>
              {contact.last_contact_date && (
                <span>Last: {formatDate(contact.last_contact_date)}</span>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
