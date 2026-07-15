"use client"

import Link from "next/link"
import { Contact, type HealthScore } from "@/lib/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { HealthBadge } from "@/components/health-badge"
import { getInitials } from "@/lib/utils"
import { Clock, ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export interface FollowUpContact extends Contact {
  health: HealthScore
  /** When the follow-up was triggered (activity date or contact updated_at) */
  followUpTriggeredAt: string
  /** What the follow-up context is (from next_steps or activity content) */
  followUpContext: string | null
}

interface FollowUpListProps {
  contacts: FollowUpContact[]
  /** Server-provided reference time so age labels are stable across hydration. */
  nowMs: number
}

function formatFollowUpAge(
  triggeredAt: string,
  nowMs: number
): { label: string; urgent: boolean } {
  const days = Math.floor((nowMs - new Date(triggeredAt).getTime()) / (1000 * 60 * 60 * 24))
  if (days <= 0) return { label: "Today", urgent: false }
  if (days === 1) return { label: "1 day ago", urgent: false }
  if (days < 7) return { label: `${days} days ago`, urgent: false }
  if (days < 14) return { label: `${Math.floor(days / 7)} week ago`, urgent: true }
  if (days < 30) return { label: `${Math.floor(days / 7)} weeks ago`, urgent: true }
  return { label: `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? "s" : ""} ago`, urgent: true }
}

export function FollowUpList({ contacts, nowMs }: FollowUpListProps) {
  if (contacts.length === 0) return null

  return (
    <Card className="shadow-refined border-l-2 border-l-amber-500">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-3 text-lg font-normal">
          <div className="h-8 w-8 rounded-lg bg-amber-100 dark:bg-amber-950/30 flex items-center justify-center">
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          Follow-ups Pending
          <span className="inline-flex items-center rounded-full bg-amber-700 px-2.5 py-0.5 text-xs font-semibold text-white">
            {contacts.length}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {contacts.map((contact) => {
          const age = formatFollowUpAge(contact.followUpTriggeredAt, nowMs)
          return (
            <Link
              key={contact.id}
              href={`/contact/${contact.id}`}
              className="flex items-center justify-between p-3 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-950/20 transition-all group"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarFallback className="bg-amber-100 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 text-xs font-medium">
                    {getInitials(contact.name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium group-hover:text-amber-700 dark:group-hover:text-amber-400 transition-colors truncate">
                      {contact.name || "Unknown Contact"}
                    </span>
                    {contact.company && (
                      <span className="text-sm text-muted-foreground truncate hidden sm:inline">
                        {contact.company}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge
                      variant="outline"
                      className={`text-[10px] px-1.5 py-0 h-5 font-medium ${
                        age.urgent
                          ? "bg-red-50 text-red-800 border-red-200 dark:bg-red-950 dark:text-red-300 dark:border-red-800"
                          : "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
                      }`}
                    >
                      {age.label}
                    </Badge>
                    {contact.followUpContext && (
                      <span className="text-xs text-muted-foreground truncate max-w-[200px]">
                        {contact.followUpContext}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="shrink-0 ml-2">
                <HealthBadge health={contact.health} />
              </div>
            </Link>
          )
        })}
      </CardContent>
    </Card>
  )
}
