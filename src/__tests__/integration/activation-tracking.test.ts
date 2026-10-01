import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({ track: vi.fn() }))

vi.mock("@vercel/analytics", () => ({ track: h.track }))
vi.mock("posthog-js", () => ({ default: { capture: vi.fn(), register: vi.fn() } }))
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }))
vi.mock("next/navigation", () => ({ usePathname: vi.fn(), useSearchParams: vi.fn() }))

import { trackContactsCreated } from "@/components/posthog-provider"
import { campaignArrivalEvents, parseAttribution } from "@/lib/attribution"

function memoryStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  }
}

const eventNames = () => h.track.mock.calls.map(([name]) => name)

describe("activation tracking", () => {
  beforeEach(() => {
    h.track.mockClear()
    vi.stubGlobal("localStorage", memoryStorage())
  })

  it("fires first_contact_created once for a CSV import, not only for manual adds", () => {
    // Regression: only /add fired first_contact_created, so users who
    // activated by importing their investor list were never counted.
    trackContactsCreated("csv_import", 30)
    trackContactsCreated("linkedin")

    expect(eventNames()).toEqual(["contact_created", "first_contact_created", "contact_created"])
    expect(h.track).toHaveBeenCalledWith(
      "first_contact_created",
      expect.objectContaining({ method: "csv_import", count: 30 })
    )
  })

  it("does not re-fire for users who already saw the first-contact celebration", () => {
    localStorage.setItem("savvo-first-contact-celebrated", "true")
    trackContactsCreated("meeting_review")
    expect(eventNames()).toEqual(["contact_created"])
  })

  it("ignores imports that created nothing", () => {
    trackContactsCreated("google_import", 0)
    expect(h.track).not.toHaveBeenCalled()
  })
})

describe("campaign arrival events", () => {
  it("fires campaign_arrival for any UTM source", () => {
    const touch = parseAttribution("https://savvo.app/?utm_source=producthunt&utm_campaign=launch")
    expect(campaignArrivalEvents(touch)).toEqual(["campaign_arrival"])
  })

  it("keeps peerpush_arrival for the existing PeerPush funnel", () => {
    const touch = parseAttribution("https://savvo.app/?utm_source=PeerPush")
    expect(campaignArrivalEvents(touch)).toEqual(["campaign_arrival", "peerpush_arrival"])
  })

  it("fires nothing without UTM parameters", () => {
    expect(campaignArrivalEvents(parseAttribution("https://savvo.app/pricing"))).toEqual([])
  })
})
