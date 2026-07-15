import { afterEach, beforeEach, describe, expect, it } from "vitest"
import {
  signCalendarOAuthState,
  verifyCalendarOAuthState,
} from "@/lib/calendar-oauth-state"

describe("calendar OAuth state", () => {
  const originalSecret = process.env.OAUTH_STATE_SECRET
  const originalCronSecret = process.env.CRON_SECRET

  beforeEach(() => {
    process.env.OAUTH_STATE_SECRET = "test-oauth-state-secret"
    delete process.env.CRON_SECRET
  })

  afterEach(() => {
    if (originalSecret === undefined) delete process.env.OAUTH_STATE_SECRET
    else process.env.OAUTH_STATE_SECRET = originalSecret

    if (originalCronSecret === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = originalCronSecret
  })

  it("round-trips a signed user ID", () => {
    const state = signCalendarOAuthState("user-123")

    expect(verifyCalendarOAuthState(state)).toBe("user-123")
  })

  it("rejects tampered and malformed state", () => {
    const state = signCalendarOAuthState("user-123")

    expect(verifyCalendarOAuthState(`${state}tampered`)).toBeNull()
    expect(verifyCalendarOAuthState("missing-signature")).toBeNull()
  })

  it("fails closed when no signing secret is configured", () => {
    delete process.env.OAUTH_STATE_SECRET
    delete process.env.CRON_SECRET

    expect(() => signCalendarOAuthState("user-123")).toThrow(/Missing OAUTH_STATE_SECRET/)
  })
})
