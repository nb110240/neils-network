import { describe, it, expect, vi, beforeEach } from "vitest"

// ─── Contact extraction integration tests ───
// Tests the full extraction pipeline: AI call → normalize → validate

describe("extractContactInfo", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("returns basic structure when both AI providers fail", async () => {
    // Mock both fetch calls to fail
    global.fetch = vi.fn()
      .mockRejectedValueOnce(new Error("OpenAI down"))
      .mockRejectedValueOnce(new Error("Gemini down"))

    process.env.OPENAI_API_KEY = "test"
    process.env.GOOGLE_AI_API_KEY = "test"

    const { extractContactInfo } = await import("@/lib/extract-contact")
    const result = await extractContactInfo("Met John at a conference")

    expect(result.name).toBeNull()
    expect(result.email).toBeNull()
    expect(result.follow_up_needed).toBe(false)
  })

  it("normalizes empty strings and N/A to null", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              name: "John",
              email: "N/A",
              phone: "",
              company: "unknown",
              job_title: "null",
              website: null,
              how_we_met: "Conference",
              next_steps: undefined,
              follow_up_needed: true,
              last_contact_date: null,
            })
          }
        }]
      })
    })

    process.env.OPENAI_API_KEY = "test"

    const { extractContactInfo } = await import("@/lib/extract-contact")
    const result = await extractContactInfo("Met John at a conference")

    expect(result.name).toBe("John")
    expect(result.email).toBeNull()
    expect(result.phone).toBeNull()
    expect(result.company).toBeNull()
    expect(result.job_title).toBeNull()
    expect(result.how_we_met).toBe("Conference")
    expect(result.follow_up_needed).toBe(true)
  })

  it("infers follow_up_needed from next_steps when not boolean", async () => {
    global.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        choices: [{
          message: {
            content: JSON.stringify({
              name: "Alice",
              email: null,
              phone: null,
              company: null,
              job_title: null,
              website: null,
              how_we_met: null,
              next_steps: "Send resume",
              follow_up_needed: "yes", // Not a boolean
              last_contact_date: null,
            })
          }
        }]
      })
    })

    process.env.OPENAI_API_KEY = "test"

    const { extractContactInfo } = await import("@/lib/extract-contact")
    const result = await extractContactInfo("Met Alice, should send resume")

    // Should be true because next_steps is truthy
    expect(result.follow_up_needed).toBe(true)
  })

  it("falls back to Gemini when OpenAI fails", async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 500 }) // OpenAI fails
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{
            content: {
              parts: [{
                text: JSON.stringify({
                  name: "Bob",
                  email: null,
                  phone: null,
                  company: "Google",
                  job_title: "Engineer",
                  website: null,
                  how_we_met: "Hackathon",
                  next_steps: null,
                  follow_up_needed: false,
                  last_contact_date: null,
                })
              }]
            }
          }]
        })
      })

    process.env.OPENAI_API_KEY = "test"
    process.env.GOOGLE_AI_API_KEY = "test"

    const { extractContactInfo } = await import("@/lib/extract-contact")
    const result = await extractContactInfo("Met Bob from Google at hackathon")

    expect(result.name).toBe("Bob")
    expect(result.company).toBe("Google")
  })
})
