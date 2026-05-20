import { Ratelimit } from "@upstash/ratelimit"
import { Redis } from "@upstash/redis"

let redis: Redis | null = null

function getRedis(): Redis {
  if (!redis) {
    redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
    })
  }
  return redis
}

// Different rate limits for different operations
// key format: "{prefix}:{userId or ip}"

// General API: 60 requests per minute per user
const generalLimiter = () =>
  new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(60, "1 m"),
    prefix: "rl:general",
  })

// Contact creation: 20 per minute (AI extraction is expensive)
const createContactLimiter = () =>
  new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(20, "1 m"),
    prefix: "rl:create",
  })

// Search: 30 per minute (embedding generation is expensive)
const searchLimiter = () =>
  new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(30, "1 m"),
    prefix: "rl:search",
  })

// Import: 5 per hour (heavy operation)
const importLimiter = () =>
  new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(5, "1 h"),
    prefix: "rl:import",
  })

// Auth/checkout: 10 per minute (prevent abuse)
const authLimiter = () =>
  new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    prefix: "rl:auth",
  })

// Cron: 2 per hour (should only fire once per day, but allow some retries)
const cronLimiter = () =>
  new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(2, "1 h"),
    prefix: "rl:cron",
  })

// AI/LLM: 5 per minute (OpenAI calls are expensive)
const aiLimiter = () =>
  new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(5, "1 m"),
    prefix: "rl:ai",
  })

// Export: 10 per minute (bulk data export — tighter than general to limit
// how fast a compromised session can exfiltrate a full contact list)
const exportLimiter = () =>
  new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(10, "1 m"),
    prefix: "rl:export",
  })

export type RateLimitType = "general" | "create" | "search" | "import" | "auth" | "cron" | "ai" | "export"

const limiters: Record<RateLimitType, () => Ratelimit> = {
  general: generalLimiter,
  create: createContactLimiter,
  search: searchLimiter,
  import: importLimiter,
  auth: authLimiter,
  cron: cronLimiter,
  ai: aiLimiter,
  export: exportLimiter,
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

export async function rateLimit(
  identifier: string,
  type: RateLimitType = "general"
): Promise<RateLimitResult> {
  // If Upstash isn't configured, fail secure in production, allow in dev
  if (!process.env.UPSTASH_REDIS_REST_URL) {
    if (process.env.NODE_ENV === "production") {
      console.error("[SECURITY] Rate limiting disabled in production: UPSTASH_REDIS_REST_URL not configured. Blocking requests.")
      return { success: false, limit: 0, remaining: 0, reset: 0 }
    }
    return { success: true, limit: 0, remaining: 0, reset: 0 }
  }

  const limiter = limiters[type]()
  const result = await limiter.limit(identifier)

  return {
    success: result.success,
    limit: result.limit,
    remaining: result.remaining,
    reset: result.reset,
  }
}

export function rateLimitHeaders(result: RateLimitResult): Record<string, string> {
  return {
    "X-RateLimit-Limit": String(result.limit),
    "X-RateLimit-Remaining": String(result.remaining),
    "X-RateLimit-Reset": String(result.reset),
  }
}
