"use client"

import Link from "next/link"
import { Contact, type HealthScore } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { HealthBadge } from "@/components/health-badge"
import { DraftMessageButton } from "@/components/draft-message-button"
import { getInitials } from "@/lib/utils"
import { HandHeart, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface ReachOutContact extends Contact {
  health: HealthScore
  reason: string
}

interface ReachOutListProps {
  contacts: ReachOutContact[]
  plan: string
  total: number
}

export function ReachOutList({ contacts, plan, total }: ReachOutListProps) {
  if (contacts.length === 0) return null

  return (
    <Card className="shadow-refined border-l-2 border-l-[var(--copper)]">
      <CardHeader>
        <CardTitle className="flex items-center gap-3 text-lg font-normal">
          <div className="h-8 w-8 rounded-lg bg-[var(--copper)]/10 flex items-center justify-center">
            <HandHeart className="h-4 w-4 text-[var(--copper)]" />
          </div>
          Reach Out Today
          <span className="inline-flex items-center rounded-full bg-[var(--copper)] px-2.5 py-0.5 text-xs font-semibold text-white">
            {total}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            className="flex items-center justify-between p-3 rounded-lg hover:bg-[var(--copper)]/5 transition-all group"
          >
            <Link
              href={`/contact/${contact.id}`}
              className="flex items-center gap-3 min-w-0 flex-1"
            >
              <Avatar className="h-9 w-9 shrink-0">
                <AvatarFallback className="bg-[var(--copper)]/8 text-[var(--copper)] text-xs font-medium">
                  {getInitials(contact.name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium group-hover:text-[var(--copper)] transition-colors truncate">
                    {contact.name || "Unknown Contact"}
                  </span>
                  {contact.company && (
                    <span className="text-sm text-muted-foreground truncate hidden sm:inline">
                      {contact.company}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <HealthBadge health={contact.health} />
                  <span className="text-xs text-muted-foreground">
                    {contact.reason}
                  </span>
                </div>
              </div>
            </Link>
            <div className="shrink-0 ml-2">
              <DraftMessageButton
                contactId={contact.id}
                contactName={contact.name || "Contact"}
                plan={plan}
                variant="icon"
              />
            </div>
          </div>
        ))}
        {total > contacts.length && (
          <div className="pt-2 text-center">
            <Button variant="ghost" size="sm" asChild className="text-muted-foreground">
              <Link href="/contacts">
                View all {total} contacts
                <ArrowRight className="ml-1 h-3.5 w-3.5" />
              </Link>
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
