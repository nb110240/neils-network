import { describe, expect, it } from "vitest"
import { activationStep } from "@/lib/activation"

const DAY = 24 * 60 * 60 * 1000
const NOW = Date.parse("2026-10-05T14:00:00Z")
const user = (ageDays: number, meta: Record<string, unknown> = {}, confirmed = true) => ({
  created_at: new Date(NOW - ageDays * DAY).toISOString(),
  email_confirmed_at: confirmed ? new Date(NOW - ageDays * DAY).toISOString() : undefined,
  app_metadata: meta,
})

describe("activationStep", () => {
  it("waits a day, then sends step 1 once", () => {
    expect(activationStep(user(0.5), NOW)).toBeNull()
    expect(activationStep(user(1.2), NOW)).toBe(1)
    expect(activationStep(user(2, { activation_emails_sent: 1, activation_email_last_at: new Date(NOW - DAY).toISOString() }), NOW)).toBeNull()
  })

  it("sends step 2 from day 3, at least two days after step 1", () => {
    const sentAt = (daysAgo: number) => new Date(NOW - daysAgo * DAY).toISOString()
    expect(activationStep(user(3.5, { activation_emails_sent: 1, activation_email_last_at: sentAt(2.5) }), NOW)).toBe(2)
    // Step 1 slipped to day 3 (weekend): step 2 must not follow the next day.
    expect(activationStep(user(4, { activation_emails_sent: 1, activation_email_last_at: sentAt(1) }), NOW)).toBeNull()
    expect(activationStep(user(5, { activation_emails_sent: 2, activation_email_last_at: sentAt(2) }), NOW)).toBeNull()
  })

  it("never emails unconfirmed accounts or accounts older than two weeks", () => {
    expect(activationStep(user(2, {}, false), NOW)).toBeNull()
    expect(activationStep(user(15), NOW)).toBeNull()
  })
})
