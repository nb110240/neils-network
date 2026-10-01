import { describe, it, expect, vi, beforeEach } from "vitest"
import { escapeHtml, emailLayout } from "@/lib/email"

// ─── escapeHtml ───

describe("escapeHtml", () => {
  it("escapes ampersand", () => {
    expect(escapeHtml("Tom & Jerry")).toBe("Tom &amp; Jerry")
  })

  it("escapes less than", () => {
    expect(escapeHtml("a < b")).toBe("a &lt; b")
  })

  it("escapes greater than", () => {
    expect(escapeHtml("a > b")).toBe("a &gt; b")
  })

  it("escapes double quotes", () => {
    expect(escapeHtml('say "hello"')).toBe("say &quot;hello&quot;")
  })

  it("escapes single quotes", () => {
    expect(escapeHtml("it's")).toBe("it&#039;s")
  })

  it("escapes all special characters together", () => {
    expect(escapeHtml(`<script>"alert('xss')"&</script>`)).toBe(
      "&lt;script&gt;&quot;alert(&#039;xss&#039;)&quot;&amp;&lt;/script&gt;"
    )
  })

  it("returns empty string unchanged", () => {
    expect(escapeHtml("")).toBe("")
  })

  it("returns plain text unchanged", () => {
    expect(escapeHtml("Hello World")).toBe("Hello World")
  })
})

// ─── emailLayout ───

describe("emailLayout", () => {
  it("returns valid HTML document", () => {
    const html = emailLayout({ body: "<p>Test</p>" })
    expect(html).toContain("<!DOCTYPE html>")
    expect(html).toContain("<html")
    expect(html).toContain("</html>")
    expect(html).toContain("</body>")
  })

  it("includes body content", () => {
    const html = emailLayout({ body: "<p>Hello World</p>" })
    expect(html).toContain("<p>Hello World</p>")
  })

  it("includes subtitle when provided", () => {
    const html = emailLayout({ body: "<p>Test</p>", subtitle: "Daily digest" })
    expect(html).toContain("Daily digest")
  })

  it("includes Savvo branding", () => {
    const html = emailLayout({ body: "<p>Test</p>" })
    expect(html).toContain("Savvo")
  })

  it("includes Open Savvo link with appUrl", () => {
    const html = emailLayout({ body: "<p>Test</p>", appUrl: "https://savvo.app" })
    expect(html).toContain("https://savvo.app/dashboard")
  })

  it("includes email preferences link by default", () => {
    const html = emailLayout({ body: "<p>Test</p>", appUrl: "https://savvo.app" })
    expect(html).toContain("Email preferences")
    expect(html).toContain("https://savvo.app/settings")
  })

  it("hides unsubscribe link when showUnsubscribe is false", () => {
    const html = emailLayout({ body: "<p>Test</p>", showUnsubscribe: false })
    expect(html).not.toContain("Email preferences")
  })

  it("uses default appUrl when not provided", () => {
    const html = emailLayout({ body: "<p>Test</p>" })
    expect(html).toContain("/dashboard")
  })
})

// ─── sendDigestEmail ───

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

// ─── sendNewUserNudgeEmail ───

describe("sendNewUserNudgeEmail", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "test-key"
    process.env.NEXT_PUBLIC_APP_URL = "https://savvo.app"
    mockSend.mockClear()
  })

  const oneContact = [
    { id: "c1", name: "Alice Smith", company: "Acme Corp", job_title: "CTO" },
  ]
  const threeContacts = [
    { id: "c1", name: "Alice Smith", company: "Acme Corp", job_title: "CTO" },
    { id: "c2", name: "Bob Jones", company: null, job_title: null },
    { id: "c3", name: "Carol Lee", company: "Globex", job_title: "Founder" },
  ]

  it("sends to the correct address with new-user subject", async () => {
    const { sendNewUserNudgeEmail } = await import("@/lib/email")
    await sendNewUserNudgeEmail("new@example.com", "Neil", oneContact)

    expect(mockSend).toHaveBeenCalledTimes(1)
    const call = mockSend.mock.calls[0][0]
    expect(call.to).toBe("new@example.com")
    expect(call.subject).toBe(
      "You've started your network on Savvo. Add a few more"
    )
  })

  it("uses a different subject when the user has multiple contacts", async () => {
    const { sendNewUserNudgeEmail } = await import("@/lib/email")
    await sendNewUserNudgeEmail("new@example.com", "Neil", threeContacts)

    expect(mockSend.mock.calls[0][0].subject).toBe(
      "Who else have you met recently?"
    )
  })

  it("shows how many contacts remain until the first digest", async () => {
    const { sendNewUserNudgeEmail } = await import("@/lib/email")
    await sendNewUserNudgeEmail("new@example.com", "Neil", threeContacts)

    // 5 - 3 = 2 contacts away
    expect(mockSend.mock.calls[0][0].html).toContain("2 contacts away")
  })

  it("lists the user's existing contacts and links to add more", async () => {
    const { sendNewUserNudgeEmail } = await import("@/lib/email")
    await sendNewUserNudgeEmail("new@example.com", "Neil", threeContacts)

    const html = mockSend.mock.calls[0][0].html
    expect(html).toContain("Alice Smith")
    expect(html).toContain("Carol Lee")
    expect(html).toContain("https://savvo.app/add")
    expect(html).toContain("https://savvo.app/contact/c1")
  })

  it("escapes HTML in contact names", async () => {
    const { sendNewUserNudgeEmail } = await import("@/lib/email")
    await sendNewUserNudgeEmail("new@example.com", "Neil", [
      { id: "x", name: "<script>alert(1)</script>", company: null, job_title: null },
    ])

    const html = mockSend.mock.calls[0][0].html
    expect(html).not.toContain("<script>alert(1)</script>")
    expect(html).toContain("&lt;script&gt;")
  })
})

describe("sendEmail", () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = "test-key"
    mockSend.mockClear()
  })

  it("throws when Resend reports an error instead of resolving as sent", async () => {
    // Regression: the SDK returns { error } rather than throwing, so failed
    // digests were counted as sent and their contacts hidden for 14 days.
    mockSend.mockResolvedValueOnce({ data: null, error: { message: "domain not verified", name: "validation_error" } })
    const { sendEmail } = await import("@/lib/email")
    await expect(
      sendEmail({ from: "a@savvo.app", to: "b@example.com", subject: "x", html: "<p>x</p>" })
    ).rejects.toThrow("domain not verified")
  })

  it("resolves when Resend accepts the message", async () => {
    mockSend.mockResolvedValueOnce({ data: { id: "email-1" }, error: null })
    const { sendEmail } = await import("@/lib/email")
    await expect(
      sendEmail({ from: "a@savvo.app", to: "b@example.com", subject: "x", html: "<p>x</p>" })
    ).resolves.toBeUndefined()
  })
})
