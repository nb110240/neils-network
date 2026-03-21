import { describe, it, expect } from "vitest"
import { z } from "zod/v4"

// Mirror the exact Zod schema from the API route
const emptyToNull = z.union([
  z.null(),
  z.string().transform((v) => (v.trim() === "" ? null : v)),
])

const UpdateContactSchema = z.object({
  name: emptyToNull.pipe(z.string().max(255).nullable()).optional(),
  email: emptyToNull.pipe(z.string().email().max(320).nullable()).optional(),
  phone: emptyToNull.pipe(z.string().max(50).nullable()).optional(),
  company: emptyToNull.pipe(z.string().max(255).nullable()).optional(),
  job_title: emptyToNull.pipe(z.string().max(255).nullable()).optional(),
  website: emptyToNull.pipe(z.string().max(500).nullable()).optional(),
  how_we_met: emptyToNull.pipe(z.string().max(5000).nullable()).optional(),
  next_steps: emptyToNull.pipe(z.string().max(5000).nullable()).optional(),
  follow_up_needed: z.boolean().optional(),
  last_contact_date: emptyToNull.pipe(z.string().nullable()).optional(),
  raw_note: emptyToNull.pipe(z.string().max(10000).nullable()).optional(),
})

describe("Contact update validation", () => {
  it("accepts empty string email (clears the field)", () => {
    const result = UpdateContactSchema.safeParse({ email: "" })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBeNull()
  })

  it("accepts null email (clears the field)", () => {
    const result = UpdateContactSchema.safeParse({ email: null })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBeNull()
  })

  it("accepts valid email", () => {
    const result = UpdateContactSchema.safeParse({ email: "test@example.com" })
    expect(result.success).toBe(true)
    if (result.success) expect(result.data.email).toBe("test@example.com")
  })

  it("rejects invalid email format", () => {
    const result = UpdateContactSchema.safeParse({ email: "not-an-email" })
    expect(result.success).toBe(false)
  })

  it("handles all fields as empty strings (user clears entire form)", () => {
    const result = UpdateContactSchema.safeParse({
      name: "",
      email: "",
      phone: "",
      company: "",
      job_title: "",
      website: "",
      how_we_met: "",
      next_steps: "",
      last_contact_date: "",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBeNull()
      expect(result.data.email).toBeNull()
      expect(result.data.phone).toBeNull()
    }
  })

  it("handles mixed values and empty fields", () => {
    const result = UpdateContactSchema.safeParse({
      name: "John",
      email: "",
      company: "Acme",
      last_contact_date: "",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe("John")
      expect(result.data.email).toBeNull()
      expect(result.data.company).toBe("Acme")
      expect(result.data.last_contact_date).toBeNull()
    }
  })

  it("handles whitespace-only strings as empty", () => {
    const result = UpdateContactSchema.safeParse({ name: "   ", email: "  " })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBeNull()
      expect(result.data.email).toBeNull()
    }
  })
})
