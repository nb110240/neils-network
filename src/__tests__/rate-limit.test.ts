import { describe, it, expect, vi, beforeEach } from "vitest"

describe("Rate limiting", () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it("allows all requests when Upstash is not configured", async () => {
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN

    const { rateLimit } = await import("@/lib/rate-limit")
    const result = await rateLimit("test-user", "general")

    expect(result.success).toBe(true)
  })

  it("exports all rate limit types", async () => {
    const { rateLimit } = await import("@/lib/rate-limit")

    // Should not throw for any valid type
    const types = ["general", "create", "search", "import", "auth", "cron"] as const
    for (const type of types) {
      delete process.env.UPSTASH_REDIS_REST_URL
      const result = await rateLimit("test", type)
      expect(result.success).toBe(true)
    }
  })

  it("rateLimitHeaders returns correct format", async () => {
    const { rateLimitHeaders } = await import("@/lib/rate-limit")

    const headers = rateLimitHeaders({
      success: true,
      limit: 60,
      remaining: 59,
      reset: 1234567890,
    })

    expect(headers["X-RateLimit-Limit"]).toBe("60")
    expect(headers["X-RateLimit-Remaining"]).toBe("59")
    expect(headers["X-RateLimit-Reset"]).toBe("1234567890")
  })
})
