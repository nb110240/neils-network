import { describe, it, expect } from "vitest"

// Test with real-world LinkedIn URLs that users actually paste
describe("LinkedIn URL handling", () => {
  // Simulates the URL cleaning logic from the API route
  function cleanLinkedInUrl(url: string): { valid: boolean; cleanUrl: string | null } {
    try {
      const parsed = new URL(url)
      if (!parsed.hostname.match(/^(www\.)?linkedin\.com$/i)) {
        return { valid: false, cleanUrl: null }
      }
      const cleanUrl = `${parsed.origin}${parsed.pathname}`.replace(/\/+$/, "")
      const regex = /^https?:\/\/(www\.)?linkedin\.com\/in\/[\w-]+$/i
      return { valid: regex.test(cleanUrl), cleanUrl }
    } catch {
      return { valid: false, cleanUrl: null }
    }
  }

  it("accepts clean LinkedIn URL", () => {
    const result = cleanLinkedInUrl("https://linkedin.com/in/johndoe")
    expect(result.valid).toBe(true)
    expect(result.cleanUrl).toBe("https://linkedin.com/in/johndoe")
  })

  it("strips ?trk= tracking parameter (Share Profile button)", () => {
    const result = cleanLinkedInUrl("https://linkedin.com/in/johndoe?trk=public_profile_share")
    expect(result.valid).toBe(true)
    expect(result.cleanUrl).toBe("https://linkedin.com/in/johndoe")
  })

  it("strips ?refId= and ?lipi= parameters", () => {
    const result = cleanLinkedInUrl("https://www.linkedin.com/in/jane-smith?refId=abc123&lipi=xyz")
    expect(result.valid).toBe(true)
    expect(result.cleanUrl).toBe("https://www.linkedin.com/in/jane-smith")
  })

  it("handles trailing slash", () => {
    const result = cleanLinkedInUrl("https://linkedin.com/in/john-doe-123/")
    expect(result.valid).toBe(true)
    expect(result.cleanUrl).toBe("https://linkedin.com/in/john-doe-123")
  })

  it("rejects non-LinkedIn URLs", () => {
    expect(cleanLinkedInUrl("https://notlinkedin.com/in/johndoe").valid).toBe(false)
  })

  it("rejects malformed URLs", () => {
    expect(cleanLinkedInUrl("not-a-url").valid).toBe(false)
  })

  it("rejects LinkedIn company pages", () => {
    expect(cleanLinkedInUrl("https://linkedin.com/company/google").valid).toBe(false)
  })
})

// Real-world slugs from "Share Profile" URLs.
describe("nameFromLinkedInSlug", () => {
  it.each([
    // Regression: hex ID suffixes leaked into the name ("Priya Raman 4b7a1b2c3").
    ["priya-raman-4b7a1b2c3", "Priya Raman"],
    ["john-doe-123", "John Doe"],
    ["jane-smith", "Jane Smith"],
    ["mary-jane-watson-a1b2c3d4", "Mary Jane Watson"],
    ["jos%C3%A9-garc%C3%ADa-12ab34cd", "José García"],
    ["elonmusk", "Elonmusk"],
    ["bad%E0%A4escape-1a2b", "Bad%E0%A4escape"],
  ])("%s → %s", async (slug, expected) => {
    const { nameFromLinkedInSlug } = await import("@/lib/linkedin")
    expect(nameFromLinkedInSlug(slug)).toBe(expected)
  })
})
