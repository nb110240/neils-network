import { describe, it, expect } from "vitest"
import { authFailed } from "@/lib/api-utils"

describe("authFailed", () => {
  it("returns true for error result", () => {
    const result = { error: new Response() } as any
    expect(authFailed(result)).toBe(true)
  })

  it("returns false for success result", () => {
    const result = { user: { id: "123" }, supabase: {} } as any
    expect(authFailed(result)).toBe(false)
  })
})
