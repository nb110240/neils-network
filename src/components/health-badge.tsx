import { type HealthScore } from "@/lib/types"
import { HEALTH_COLORS } from "@/lib/health"
import { cn } from "@/lib/utils"

interface HealthBadgeProps {
  health: HealthScore
  size?: "sm" | "md"
}

export function HealthBadge({ health, size = "sm" }: HealthBadgeProps) {
  const colors = HEALTH_COLORS[health.level]
  const isSmall = size === "sm"

  return (
    <span
      role="status"
      aria-label={`Relationship health: ${health.label}`}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap",
        colors.bg,
        colors.text,
        isSmall
          ? "px-2.5 py-0.5 text-xs leading-5"
          : "px-3 py-1 text-xs leading-5"
      )}
    >
      <span className={cn("rounded-full shrink-0", colors.dot, isSmall ? "h-1.5 w-1.5" : "h-2 w-2")} />
      {health.label}
    </span>
  )
}
