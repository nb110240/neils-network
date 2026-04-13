import { describe, it, expect } from "vitest"
import { validateExtraction } from "@/lib/validate-extraction"

describe("validateExtraction", () => {
  it("passes through valid fields unchanged", () => {
    const input = {
      name: "John Doe",
      email: "john@example.com",
      phone: "+1 555-123-4567",
      website: "https://example.com",
      company: "Acme Inc",
      last_contact_date: "2026-03-15",
    }
    const result = validateExtraction(input)
    expect(result.email).toBe("john@example.com")
    expect(result.phone).toBe("+1 555-123-4567")
    expect(result.website).toBe("https://example.com")
    expect(result.last_contact_date).toBe("2026-03-15")
  })

  it("strips invalid email (hallucinated)", () => {
    const input = { email: "not-an-email", name: "John" }
    const result = validateExtraction(input)
    expect(result.email).toBeNull()
    expect(result.name).toBe("John") // other fields untouched
  })

  it("strips email without domain", () => {
    const result = validateExtraction({ email: "john@" })
    expect(result.email).toBeNull()
  })

  it("strips email with spaces", () => {
    const result = validateExtraction({ email: "john doe@example.com" })
    expect(result.email).toBeNull()
  })

  it("strips invalid phone (too short)", () => {
    const result = validateExtraction({ phone: "123" })
    expect(result.phone).toBeNull()
  })

  it("strips invalid phone (letters)", () => {
    const result = validateExtraction({ phone: "call me maybe" })
    expect(result.phone).toBeNull()
  })

  it("accepts international phone formats", () => {
    expect(validateExtraction({ phone: "+44 20 7946 0958" }).phone).toBe("+44 20 7946 0958")
    expect(validateExtraction({ phone: "(555) 123-4567" }).phone).toBe("(555) 123-4567")
    expect(validateExtraction({ phone: "555.123.4567" }).phone).toBe("555.123.4567")
  })

  it("strips invalid website URL", () => {
    const result = validateExtraction({ website: "not a url" })
    expect(result.website).toBeNull()
  })

  it("accepts LinkedIn URLs", () => {
    const result = validateExtraction({ website: "linkedin.com/in/johndoe" })
    expect(result.website).toBe("linkedin.com/in/johndoe")
  })

  it("accepts https URLs", () => {
    const result = validateExtraction({ website: "https://example.com/about" })
    expect(result.website).toBe("https://example.com/about")
  })

  it("strips invalid date", () => {
    const result = validateExtraction({ last_contact_date: "not-a-date" })
    expect(result.last_contact_date).toBeNull()
  })

  it("accepts valid ISO date", () => {
    const result = validateExtraction({ last_contact_date: "2026-01-15" })
    expect(result.last_contact_date).toBe("2026-01-15")
  })

  it("handles all fields invalid — returns cleaned object", () => {
    const input = {
      name: "John Doe",
      email: "fake",
      phone: "abc",
      website: "nope",
      last_contact_date: "yesterday",
      company: "Acme",
    }
    const result = validateExtraction(input)
    expect(result.name).toBe("John Doe")
    expect(result.email).toBeNull()
    expect(result.phone).toBeNull()
    expect(result.website).toBeNull()
    expect(result.last_contact_date).toBeNull()
    expect(result.company).toBe("Acme")
  })

  it("handles null/undefined fields gracefully", () => {
    const input = { email: null, phone: undefined, name: "Test" }
    const result = validateExtraction(input)
    expect(result.email).toBeNull()
    expect(result.name).toBe("Test")
  })

  it("handles empty string email (falsy, not validated)", () => {
    const result = validateExtraction({ email: "" })
    // Empty string is falsy, so the validation block is skipped
    expect(result.email).toBe("")
  })

  it("handles very long email that is valid", () => {
    const longEmail = "a".repeat(50) + "@example.com"
    const result = validateExtraction({ email: longEmail })
    expect(result.email).toBe(longEmail)
  })

  it("handles special characters in name (passes through)", () => {
    const result = validateExtraction({ name: "O'Brien-Smith" })
    expect(result.name).toBe("O'Brien-Smith")
  })

  it("handles unicode characters in name", () => {
    const result = validateExtraction({ name: "Jose Garcia" })
    expect(result.name).toBe("Jose Garcia")
  })

  it("strips phone with only letters", () => {
    const result = validateExtraction({ phone: "ABCDEFGH" })
    expect(result.phone).toBeNull()
  })

  it("accepts http URL for website", () => {
    const result = validateExtraction({ website: "http://example.com" })
    expect(result.website).toBe("http://example.com")
  })

  it("strips website that is just a word", () => {
    const result = validateExtraction({ website: "google" })
    expect(result.website).toBeNull()
  })

  it("accepts full ISO datetime for last_contact_date", () => {
    const result = validateExtraction({ last_contact_date: "2026-03-15T10:30:00.000Z" })
    expect(result.last_contact_date).toBe("2026-03-15T10:30:00.000Z")
  })

  it("does not modify unrelated fields", () => {
    const result = validateExtraction({
      name: "Test",
      company: "Acme",
      how_we_met: "Conference",
      next_steps: "Follow up",
      follow_up_needed: true,
    })
    expect(result.name).toBe("Test")
    expect(result.company).toBe("Acme")
    expect(result.how_we_met).toBe("Conference")
    expect(result.next_steps).toBe("Follow up")
    expect(result.follow_up_needed).toBe(true)
  })
})
