import Link from "next/link"
import { Contact } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"
import { AlertCircle, ArrowUpRight } from "lucide-react"

interface FollowUpListProps {
  contacts: Contact[]
}

export function FollowUpList({ contacts }: FollowUpListProps) {
  if (contacts.length === 0) {
    return (
      <Card className="glass shadow-refined">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg font-normal">
            <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <AlertCircle className="h-4 w-4 text-amber-600" />
            </div>
            Follow-ups Needed
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No follow-ups needed at the moment. Great job staying connected!
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="glass shadow-refined">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg font-normal">
          <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <AlertCircle className="h-4 w-4 text-amber-600" />
          </div>
          Follow-ups Needed
          <Badge variant="warning" className="text-xs">
            {contacts.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {contacts.map((contact) => (
          <Link
            key={contact.id}
            href={`/contact/${contact.id}`}
            className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--copper)]/5 transition-all group"
          >
            <div className="min-w-0 flex-1">
              <p className="font-medium group-hover:text-[var(--copper)] transition-colors flex items-center gap-1">
                {contact.name || "Unknown Contact"}
                <ArrowUpRight className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
              </p>
              <p className="text-sm text-muted-foreground truncate">
                {contact.next_steps || "No next steps defined"}
              </p>
              {contact.last_contact_date && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last contact: {formatDate(contact.last_contact_date)}
                </p>
              )}
            </div>
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
