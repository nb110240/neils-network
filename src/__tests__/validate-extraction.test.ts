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
})
