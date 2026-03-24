"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { ArrowRight } from "lucide-react"

interface EmptyStateProps {
  icon: React.ReactNode
  title: string
  description: string
  actionLabel?: string
  actionHref?: string
  secondaryLabel?: string
  secondaryHref?: string
}

export function EmptyState({
  icon,
  title,
  description,
  actionLabel,
  actionHref,
  secondaryLabel,
  secondaryHref,
}: EmptyStateProps) {
  return (
    <Card className="shadow-refined">
      <CardContent className="flex flex-col items-center justify-center py-16 animate-fade-in">
        <div className="w-14 h-14 rounded-2xl bg-[var(--copper)]/10 flex items-center justify-center mb-4">
          {icon}
        </div>
        <h3 className="text-xl font-normal text-center">{title}</h3>
        <p className="text-muted-foreground text-center max-w-sm mt-2">{description}</p>
        {actionLabel && actionHref && (
          <Button
            className="mt-6 bg-gradient-to-r from-[var(--copper)] to-[var(--copper-light)] hover:opacity-90 shadow-md border-0"
            asChild
          >
            <Link href={actionHref}>
              {actionLabel}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        )}
        {secondaryLabel && secondaryHref && (
          <Button variant="ghost" size="sm" asChild className="mt-2 text-muted-foreground">
            <Link href={secondaryHref}>{secondaryLabel}</Link>
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
