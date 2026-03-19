import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Email template tests ───

const mockSend = vi.fn().mockResolvedValue({ id: "test-email-id" })

vi.mock("resend", () => ({
  Resend: class MockResend {
    emails = { send: mockSend }
  },
}))

describe("sendDigestEmail", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "test-key"
    process.env.NEXT_PUBLIC_APP_URL = "https://savvo.app"
    mockSend.mockClear()
  })

  it("sends email with correct structure", async () => {
    const { sendDigestEmail } = await import("@/lib/email")

    const contacts = [
      {
        id: "abc-123",
        name: "Alice Smith",
        company: "Acme Corp",
        job_title: "CTO",
        how_we_met: "Met at TechCrunch",
        next_steps: "Send intro to Bob",
        last_contact_date: new Date(Date.now() - 45 * 24 * 60 * 60 * 1000).toISOString(),
        follow_up_needed: true,
        health: { score: 50, level: "yellow", label: "Cooling" },
        lastActivity: null,
      },
    ]

    await sendDigestEmail("test@example.com", "Neil", contacts, {
      totalContacts: 25,
      healthBreakdown: { green: 10, yellow: 8, orange: 4, red: 3 },
      followUpCount: 5,
      isPro: true,
      isWeekly: false,
    })

    expect(mockSend).toHaveBeenCalledTimes(1)
    const call = mockSend.mock.calls[0][0]
    expect(call.to).toBe("test@example.com")
    expect(call.subject).toContain("1 relationship")
    expect(call.html).toContain("Alice Smith")
    expect(call.html).toContain("Acme Corp")
    expect(call.html).toContain("Send intro to Bob")
    expect(call.html).toContain("Your Network: 25 contacts")
  })

  it("includes upgrade CTA for free users", async () => {
    const { sendDigestEmail } = await import("@/lib/email")

    await sendDigestEmail("test@example.com", "Neil", [
      {
        id: "abc",
        name: "Test",
        company: null,
        job_title: null,
        how_we_met: null,
        next_steps: null,
        last_contact_date: null,
        follow_up_needed: false,
        health: { score: 10, level: "red", label: "Cold" },
        lastActivity: null,
      },
    ], {
      totalContacts: 10,
      healthBreakdown: { red: 10 },
      followUpCount: 0,
      isPro: false,
      isWeekly: true,
    })

    expect(mockSend).toHaveBeenCalledTimes(1)
    const sentHtml = mockSend.mock.calls[0][0].html
    expect(sentHtml).toContain("Upgrade to Pro")
  })

  it("uses weekly subject line for weekly digest", async () => {
    const { sendDigestEmail } = await import("@/lib/email")

    await sendDigestEmail("test@example.com", "Neil", [
      {
        id: "abc",
        name: "Test",
        company: null,
        job_title: null,
        how_we_met: null,
        next_steps: null,
        last_contact_date: null,
        follow_up_needed: false,
        health: { score: 10, level: "red", label: "Cold" },
        lastActivity: null,
      },
    ], {
      totalContacts: 10,
      healthBreakdown: { red: 10 },
      followUpCount: 0,
      isPro: false,
      isWeekly: true,
    })

    const subject = mockSend.mock.calls[0][0].subject
    expect(subject).toContain("weekly")
  })

  it("does not include upgrade CTA for Pro users", async () => {
    const { sendDigestEmail } = await import("@/lib/email")

    await sendDigestEmail("test@example.com", "Neil", [
      {
        id: "abc",
        name: "Test",
        company: null,
        job_title: null,
        how_we_met: null,
        next_steps: null,
        last_contact_date: null,
        follow_up_needed: false,
        health: { score: 50, level: "yellow", label: "Cooling" },
        lastActivity: null,
      },
    ], {
      totalContacts: 50,
      healthBreakdown: { green: 20, yellow: 20, red: 10 },
      followUpCount: 3,
      isPro: true,
      isWeekly: false,
    })

    const sentHtml = mockSend.mock.calls[0][0].html
    expect(sentHtml).not.toContain("Upgrade to Pro")
  })

  it("includes last activity context when available", async () => {
    const { sendDigestEmail } = await import("@/lib/email")

    await sendDigestEmail("test@example.com", "Neil", [
      {
        id: "abc",
        name: "Alice",
        company: "Acme",
        job_title: null,
        how_we_met: null,
        next_steps: null,
        last_contact_date: null,
        follow_up_needed: false,
        health: { score: 25, level: "orange", label: "Going cold" },
        lastActivity: {
          type: "meeting",
          content: "Discussed partnership opportunities for Q2",
          occurred_at: new Date().toISOString(),
        },
      },
    ])

    const sentHtml = mockSend.mock.calls[0][0].html
    expect(sentHtml).toContain("Discussed partnership opportunities")
    expect(sentHtml).toContain("meeting")
  })
})
