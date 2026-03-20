import Link from "next/link"
import { Contact, type HealthScore } from "@/lib/types"
import { Card, CardContent } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { getInitials } from "@/lib/utils"
import { Sparkles } from "lucide-react"

interface NewRelationshipsProps {
  contacts: (Contact & { health: HealthScore })[]
}

export function NewRelationships({ contacts }: NewRelationshipsProps) {
  if (contacts.length === 0) return null

  return (
    <div className="space-y-3">
      <h2 className="flex items-center gap-2 text-lg font-normal">
        <div className="h-7 w-7 rounded-lg bg-[var(--copper)]/10 flex items-center justify-center">
          <Sparkles className="h-3.5 w-3.5 text-[var(--copper)]" />
        </div>
        New in Your Network
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {contacts.map((contact) => (
          <Link key={contact.id} href={`/contact/${contact.id}`} className="shrink-0">
            <Card className="shadow-refined hover:shadow-refined-lg hover:-translate-y-0.5 transition-all cursor-pointer w-[180px]">
              <CardContent className="p-4 flex flex-col items-center text-center">
                <Avatar className="h-11 w-11 mb-2">
                  <AvatarFallback className="bg-[var(--copper)]/8 text-[var(--copper)] text-sm font-medium">
                    {getInitials(contact.name)}
                  </AvatarFallback>
                </Avatar>
                <p className="font-medium text-sm truncate w-full">
                  {contact.name || "Unknown"}
                </p>
                {contact.company && (
                  <p className="text-xs text-muted-foreground truncate w-full mt-0.5">
                    {contact.company}
                  </p>
                )}
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
