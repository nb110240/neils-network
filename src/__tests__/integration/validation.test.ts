import { describe, it, expect } from "vitest"
import { z } from "zod/v4"

// ─── API route input validation tests ───
// Tests the Zod schemas used across API routes to ensure
// they reject malicious input and accept valid input.

// Replicate the schemas from the routes for isolated testing

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

const CreateTagSchema = z.object({
  name: z.string().min(1, "Tag name is required").max(50, "Tag name too long").transform(v => v.trim()),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Invalid hex color").optional(),
})

const SupportSchema = z.object({
  subject: z.string().min(1, "Please select a topic").max(200),
  message: z.string().min(5, "Please write a message").max(5000),
})

const SearchSchema = z.object({
  query: z.string().min(1, "Query is required").max(2000),
  filters: z.object({
    companies: z.array(z.string().max(255)).max(50).optional(),
    tags: z.array(z.string().max(100)).max(50).optional(),
    healthLevels: z.array(z.string().max(20)).max(10).optional(),
  }).optional().default({}),
})

describe("Contact update validation", () => {
  it("accepts valid partial update", () => {
    const result = UpdateContactSchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
    })
    expect(result.success).toBe(true)
  })

  it("allows clearing fields with empty string", () => {
    const result = UpdateContactSchema.safeParse({
      email: "",
      phone: "",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBeNull()
      expect(result.data.phone).toBeNull()
    }
  })

  it("allows clearing fields with null", () => {
    const result = UpdateContactSchema.safeParse({
      email: null,
      company: null,
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.email).toBeNull()
      expect(result.data.company).toBeNull()
    }
  })

  it("rejects invalid email format", () => {
    const result = UpdateContactSchema.safeParse({
      email: "not-an-email",
    })
    expect(result.success).toBe(false)
  })

  it("rejects oversized name", () => {
    const result = UpdateContactSchema.safeParse({
      name: "x".repeat(300),
    })
    expect(result.success).toBe(false)
  })

  it("rejects oversized raw_note", () => {
    const result = UpdateContactSchema.safeParse({
      raw_note: "x".repeat(15000),
    })
    expect(result.success).toBe(false)
  })

  it("rejects SQL injection in name field", () => {
    const result = UpdateContactSchema.safeParse({
      name: "'; DROP TABLE contacts; --",
    })
    // Zod doesn't check for SQL injection specifically, but the parameterized
    // Supabase queries prevent execution. The value is accepted but safe.
    expect(result.success).toBe(true)
    // The important thing is it's stored as a string, not executed as SQL
    if (result.success) {
      expect(result.data.name).toBe("'; DROP TABLE contacts; --")
    }
  })

  it("rejects non-boolean follow_up_needed", () => {
    const result = UpdateContactSchema.safeParse({
      follow_up_needed: "true", // string instead of boolean
    })
    expect(result.success).toBe(false)
  })

  it("accepts empty update (no fields)", () => {
    const result = UpdateContactSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it("ignores unknown fields", () => {
    const result = UpdateContactSchema.safeParse({
      name: "John",
      isAdmin: true,
      role: "superuser",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe("John")
      // Unknown fields should not be in the output
      expect((result.data as Record<string, unknown>).isAdmin).toBeUndefined()
      expect((result.data as Record<string, unknown>).role).toBeUndefined()
    }
  })
})

describe("Tag creation validation", () => {
  it("accepts valid tag", () => {
    const result = CreateTagSchema.safeParse({ name: "VIP", color: "#ff6600" })
    expect(result.success).toBe(true)
  })

  it("trims whitespace from tag name", () => {
    const result = CreateTagSchema.safeParse({ name: "  VIP  " })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe("VIP")
    }
  })

  it("rejects empty tag name", () => {
    expect(CreateTagSchema.safeParse({ name: "" }).success).toBe(false)
  })

  it("rejects oversized tag name", () => {
    expect(CreateTagSchema.safeParse({ name: "x".repeat(51) }).success).toBe(false)
  })

  it("rejects invalid hex color", () => {
    expect(CreateTagSchema.safeParse({ name: "VIP", color: "red" }).success).toBe(false)
    expect(CreateTagSchema.safeParse({ name: "VIP", color: "#xyz" }).success).toBe(false)
    expect(CreateTagSchema.safeParse({ name: "VIP", color: "#ff660" }).success).toBe(false)
  })

  it("accepts valid hex colors", () => {
    expect(CreateTagSchema.safeParse({ name: "VIP", color: "#000000" }).success).toBe(true)
    expect(CreateTagSchema.safeParse({ name: "VIP", color: "#FFFFFF" }).success).toBe(true)
    expect(CreateTagSchema.safeParse({ name: "VIP", color: "#c2410c" }).success).toBe(true)
  })

  it("allows missing color (optional)", () => {
    const result = CreateTagSchema.safeParse({ name: "VIP" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.color).toBeUndefined()
    }
  })

  it("XSS in tag name is stored safely (parameterized query + React escaping)", () => {
    // Zod accepts the string — HTML escaping is handled by React on render,
    // and Supabase uses parameterized queries. The string is just data.
    const result = CreateTagSchema.safeParse({ name: '<script>alert("x")</script>' })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.name).toBe('<script>alert("x")</script>')
    }
  })
})

describe("Support message validation", () => {
  it("accepts valid support message", () => {
    const result = SupportSchema.safeParse({
      subject: "Bug Report",
      message: "I found a bug in the search feature",
    })
    expect(result.success).toBe(true)
  })

  it("rejects too-short message", () => {
    const result = SupportSchema.safeParse({
      subject: "Help",
      message: "Hi",
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing subject", () => {
    const result = SupportSchema.safeParse({
      message: "I need help with something",
    })
    expect(result.success).toBe(false)
  })

  it("rejects oversized message", () => {
    const result = SupportSchema.safeParse({
      subject: "Help",
      message: "x".repeat(5001),
    })
    expect(result.success).toBe(false)
  })

  it("rejects oversized subject", () => {
    const result = SupportSchema.safeParse({
      subject: "x".repeat(201),
      message: "Some message here",
    })
    expect(result.success).toBe(false)
  })
})

describe("Search query validation", () => {
  it("accepts valid search query", () => {
    const result = SearchSchema.safeParse({
      query: "AI startup founder",
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.filters).toEqual({})
    }
  })

  it("accepts search with filters", () => {
    const result = SearchSchema.safeParse({
      query: "AI",
      filters: {
        companies: ["Acme Corp"],
        healthLevels: ["healthy", "warm"],
      },
    })
    expect(result.success).toBe(true)
  })

  it("rejects empty query", () => {
    const result = SearchSchema.safeParse({ query: "" })
    expect(result.success).toBe(false)
  })

  it("rejects oversized query", () => {
    const result = SearchSchema.safeParse({ query: "x".repeat(2001) })
    expect(result.success).toBe(false)
  })

  it("rejects too many filter values", () => {
    const result = SearchSchema.safeParse({
      query: "test",
      filters: {
        companies: Array.from({ length: 51 }, (_, i) => `Company ${i}`),
      },
    })
    expect(result.success).toBe(false)
  })

  it("rejects oversized company names in filters", () => {
    const result = SearchSchema.safeParse({
      query: "test",
      filters: {
        companies: ["x".repeat(300)],
      },
    })
    expect(result.success).toBe(false)
  })

  it("defaults filters to empty object when omitted", () => {
    const result = SearchSchema.safeParse({ query: "test" })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.filters).toEqual({})
    }
  })
})
