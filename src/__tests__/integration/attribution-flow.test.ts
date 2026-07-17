import { readFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"
import {
  attributionEventProperties,
  attributionFromCookieHeader,
  attributionFromUserMetadata,
  attributionUserMetadata,
  captureFirstTouchAttribution,
  parseAttribution,
  resolveAuthenticatedAttribution,
  restoreAuthenticatedAttribution,
  validateAttribution,
} from "@/lib/attribution"

describe("first-touch acquisition flow", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("captures the complete PeerPush campaign without storing referrer paths", () => {
    const attribution = parseAttribution(
      "https://savvo.app/?utm_source=peerpush&utm_medium=directory&utm_campaign=profile&email=private@example.com",
      "2026-07-17T12:00:00.000Z",
      "https://peerpush.com/p/savvo?private=value"
    )

    expect(attribution).toEqual({
      source: "peerpush",
      medium: "directory",
      campaign: "profile",
      term: undefined,
      content: undefined,
      landing_path:
        "/?utm_source=peerpush&utm_medium=directory&utm_campaign=profile",
      captured_at: "2026-07-17T12:00:00.000Z",
      referrer_origin: "https://peerpush.com",
    })
  })

  it("rejects malformed cookie data and sanitizes valid analytics-only values", () => {
    expect(attributionFromCookieHeader("savvo_first_touch=not-json")).toBeNull()
    expect(
      validateAttribution({
        source: "peerpush\u0000",
        landing_path: "https://attacker.example/path",
        captured_at: "2026-07-17T12:00:00.000Z",
      })
    ).toMatchObject({ source: "peerpush", landing_path: "/" })
  })

  it("uses the same immutable first-touch fields for events and auth metadata", () => {
    const attribution = parseAttribution(
      "/?utm_source=peerpush&utm_medium=directory&utm_campaign=profile",
      "2026-07-17T12:00:00.000Z"
    )

    expect(attributionUserMetadata(attribution)).toEqual(
      attributionEventProperties(attribution)
    )
    expect(attributionUserMetadata(attribution)).toMatchObject({
      first_touch_source: "peerpush",
      first_touch_medium: "directory",
      first_touch_campaign: "profile",
    })
    expect(
      attributionFromUserMetadata(attributionUserMetadata(attribution))
    ).toEqual(attribution)
  })

  it("does not overwrite the first campaign when a later campaign arrives", () => {
    const values = new Map<string, string>()
    vi.stubGlobal("window", {
      location: { protocol: "https:" },
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    })
    vi.stubGlobal("document", { cookie: "" })

    const first = captureFirstTouchAttribution(
      "/?utm_source=peerpush&utm_medium=directory&utm_campaign=profile"
    )
    const later = captureFirstTouchAttribution(
      "/?utm_source=google&utm_medium=organic&utm_campaign=brand"
    )

    expect(first.isNew).toBe(true)
    expect(later.isNew).toBe(false)
    expect(later.firstTouch).toMatchObject({
      source: "peerpush",
      medium: "directory",
      campaign: "profile",
    })
    expect(later.currentTouch).toMatchObject({ source: "google" })

    restoreAuthenticatedAttribution(later.currentTouch!)
    expect(
      captureFirstTouchAttribution("/?utm_source=linkedin").firstTouch
    ).toMatchObject({ source: "google" })
  })

  it("does not turn a campaign login by an existing user into acquisition", () => {
    const peerpush = parseAttribution(
      "/?utm_source=peerpush&utm_medium=directory&utm_campaign=profile",
      "2026-07-17T12:00:00.000Z"
    )
    const now = new Date("2026-07-17T12:10:00.000Z").getTime()

    expect(
      resolveAuthenticatedAttribution(
        null,
        peerpush,
        "2026-01-01T00:00:00.000Z",
        now
      )
    ).toEqual({ firstTouch: null, shouldClearBrowser: true })
    expect(
      resolveAuthenticatedAttribution(
        null,
        peerpush,
        "2026-07-17T12:09:00.000Z",
        now
      )
    ).toEqual({ firstTouch: peerpush, shouldClearBrowser: false })
    expect(
      resolveAuthenticatedAttribution(
        peerpush,
        null,
        "2026-01-01T00:00:00.000Z",
        now
      )
    ).toEqual({ firstTouch: peerpush, shouldClearBrowser: false })
  })

  it("wires tagged arrivals, email signup, OAuth signup, activation, and retention", () => {
    const provider = readFileSync(
      join(process.cwd(), "src/components/posthog-provider.tsx"),
      "utf8"
    )
    const login = readFileSync(
      join(process.cwd(), "src/app/(auth)/login/page.tsx"),
      "utf8"
    )
    const callback = readFileSync(
      join(process.cwd(), "src/app/auth/callback/route.ts"),
      "utf8"
    )
    const addContact = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/add/page.tsx"),
      "utf8"
    )

    expect(provider).toContain('captureEvent("peerpush_arrival"')
    expect(provider).toContain('captureEvent("returning_active_user"')
    expect(login).toContain("attributionUserMetadata")
    expect(callback).toContain("if (isNewUser)")
    expect(callback).toContain('track("signup_completed"')
    expect(addContact).toContain('captureEvent("first_contact_created")')
  })
})
