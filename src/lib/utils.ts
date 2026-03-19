import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(date: Date | string | null | undefined): string {
  if (!date) return "N/A"
  let d: Date
  if (typeof date === "string") {
    // Date-only strings (YYYY-MM-DD) must be parsed as local time, not UTC,
    // otherwise timezone offset shifts the date to the previous day.
    d = date.length === 10 ? new Date(date + "T12:00:00") : new Date(date)
  } else {
    d = date
  }
  return d.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

export function getInitials(name: string | null | undefined): string {
  if (!name) return "?"
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}
