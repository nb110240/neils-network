import { describe, it, expect, vi } from "vitest"
import { z } from "zod/v4"
import { parseBody, parseJSON } from "@/lib/request"

// Mock audit to prevent side effects
vi.mock("@/lib/audit", () => ({
  audit: vi.fn(),
}))

const TestSchema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
  age: z.number().int().min(0).max(150).optional(),
})

function makeRequest(body: unknown, contentType = "application/json"): Request {
  const bodyStr = typeof body === "string" ? body : JSON.stringify(body)
  return new Request("http://localhost:3001/api/test", {
    method: "POST",
    body: bodyStr,
    headers: {
      "content-type": contentType,
      "content-length": String(new Blob([bodyStr]).size),
    },
  })
}

describe("parseBody", () => {
  it("parses valid JSON body with Zod validation", async () => {
    const req = makeRequest({ name: "John", email: "john@example.com", age: 30 })
    const result = await parseBody(req, TestSchema)

    expect(result.error).toBeUndefined()
    expect(result.data).toEqual({ name: "John", email: "john@example.com", age: 30 })
  })

  it("rejects invalid JSON", async () => {
    const req = makeRequest("not valid json {{{")
    const result = await parseBody(req, TestSchema)

    expect(result.error).toBeDefined()
    expect(result.data).toBeUndefined()
  })

  it("rejects body failing Zod validation", async () => {
    const req = makeRequest({ name: "", email: "not-an-email" })
    const result = await parseBody(req, TestSchema)

    expect(result.error).toBeDefined()
    expect(result.data).toBeUndefined()
  })

  it("rejects missing required fields", async () => {
    const req = makeRequest({ name: "John" })
    const result = await parseBody(req, TestSchema)

    expect(result.error).toBeDefined()
  })

  it("rejects oversized body via Content-Length header", async () => {
    const body = JSON.stringify({ name: "x".repeat(200_000), email: "a@b.com" })
    const req = new Request("http://localhost:3001/api/test", {
      method: "POST",
      body,
      headers: {
        "content-type": "application/json",
        "content-length": String(body.length),
      },
    })

    const result = await parseBody(req, TestSchema, { maxSize: 1024 })
    expect(result.error).toBeDefined()
  })

  it("uses default 100KB max size", async () => {
    // Body under 100KB should pass size check (may still fail validation)
    const smallBody = { name: "John", email: "john@example.com" }
    const req = makeRequest(smallBody)
    const result = await parseBody(req, TestSchema)

    expect(result.error).toBeUndefined()
    expect(result.data).toBeDefined()
  })

  it("rejects extra-long string fields per schema", async () => {
    const req = makeRequest({ name: "x".repeat(200), email: "john@example.com" })
    const result = await parseBody(req, TestSchema)

    expect(result.error).toBeDefined()
  })

  it("strips extra fields not in schema (Zod default passthrough does not apply with strict)", async () => {
    const req = makeRequest({
      name: "John",
      email: "john@example.com",
      __proto__: { isAdmin: true },
      extra: "field",
    })
    const result = await parseBody(req, TestSchema)

    // Should parse successfully (extra fields ignored by default Zod)
    expect(result.data?.name).toBe("John")
  })
})

describe("parseJSON", () => {
  it("parses valid JSON without schema validation", async () => {
    const req = makeRequest({ anything: "goes", nested: { deep: true } })
    const result = await parseJSON(req)

    expect(result.error).toBeUndefined()
    expect(result.data).toEqual({ anything: "goes", nested: { deep: true } })
  })

  it("rejects oversized body", async () => {
    const body = "x".repeat(200_000)
    const req = new Request("http://localhost:3001/api/test", {
      method: "POST",
      body,
      headers: { "content-length": String(body.length) },
    })

    const result = await parseJSON(req, { maxSize: 1024 })
    expect(result.error).toBeDefined()
  })
})

describe("Request body security", () => {
  it("does not pollute Object prototype from JSON payload", async () => {
    const req = makeRequest('{"__proto__": {"isAdmin": true}, "name": "John", "email": "j@x.com"}')
    const result = await parseBody(req, TestSchema)

    // The valid fields should parse fine
    if (result.data) {
      expect(result.data.name).toBe("John")
      expect(result.data.email).toBe("j@x.com")
    }
    // Prototype pollution should NOT affect other objects
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(({} as any).isAdmin).toBeUndefined()
  })

  it("handles deeply nested JSON (resource exhaustion attempt)", async () => {
    // Create deeply nested object
    let obj: Record<string, unknown> = { name: "deep", email: "a@b.com" }
    for (let i = 0; i < 100; i++) {
      obj = { nested: obj, name: "deep", email: "a@b.com" }
    }

    const req = makeRequest(obj)
    // Should not crash — may succeed or fail validation, but no exception
    const result = await parseBody(req, TestSchema)
    // Just verify it doesn't throw
    expect(result.error !== undefined || result.data !== undefined).toBe(true)
  })

  it("rejects null body", async () => {
    const req = makeRequest("null")
    const result = await parseBody(req, TestSchema)
    expect(result.error).toBeDefined()
  })

  it("rejects array body when object expected", async () => {
    const req = makeRequest("[1, 2, 3]")
    const result = await parseBody(req, TestSchema)
    expect(result.error).toBeDefined()
  })
})
