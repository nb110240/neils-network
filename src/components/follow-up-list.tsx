import Link from "next/link"
import { Contact } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatDate } from "@/lib/utils"
import { AlertCircle, ChevronRight } from "lucide-react"

interface FollowUpListProps {
  contacts: Contact[]
}

export function FollowUpList({ contacts }: FollowUpListProps) {
  if (contacts.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <AlertCircle className="h-5 w-5 text-yellow-500" />
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
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-lg">
          <AlertCircle className="h-5 w-5 text-yellow-500" />
          Follow-ups Needed
          <Badge variant="warning" className="ml-2">
            {contacts.length}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {contacts.map((contact) => (
          <Link
            key={contact.id}
            href={`/contact/${contact.id}`}
            className="flex items-center justify-between p-3 rounded-lg hover:bg-muted transition-colors"
          >
            <div>
              <p className="font-medium">{contact.name || "Unknown Contact"}</p>
              <p className="text-sm text-muted-foreground">
                {contact.next_steps || "No next steps defined"}
              </p>
              {contact.last_contact_date && (
                <p className="text-xs text-muted-foreground mt-1">
                  Last contact: {formatDate(contact.last_contact_date)}
                </p>
              )}
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Link>
        ))}
      </CardContent>
    </Card>
  )
}
