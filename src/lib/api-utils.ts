import { NextResponse } from "next/server"
import { timingSafeEqual } from "crypto"
import { createClient } from "@/lib/supabase/server"
import { rateLimit, rateLimitHeaders, type RateLimitType } from "@/lib/rate-limit"
import { auditAuthFailure, auditRateLimitHit, auditAdminAccess } from "@/lib/audit"
import type { SupabaseClient } from "@supabase/supabase-js"

// ─── Timing-safe secret comparison ───
// Prevents timing attacks on secret/token comparisons
export function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}

// ─── Auth result types ───

interface AuthSuccess {
  user: { id: string; email?: string }
  supabase: SupabaseClient
}

interface AuthError {
  error: NextResponse
}

type AuthResult = AuthSuccess | AuthError

// ─── Helper to check if auth failed ───

export function authFailed(result: AuthResult): result is AuthError {
  return "error" in result
}

// ─── Authenticate + rate limit in one call ───
//
//   Usage in any route:
//
//     const auth = await authenticateRequest("create")
//     if (authFailed(auth)) return auth.error
//     const { user, supabase } = auth
//
//   Replaces 10+ lines of boilerplate per route.

export async function authenticateRequest(
  rateLimitType: RateLimitType = "general"
): Promise<AuthResult> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    auditAuthFailure("authenticateRequest")
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  const rl = await rateLimit(user.id, rateLimitType)
  if (!rl.success) {
    auditRateLimitHit(user.id, "authenticateRequest", rateLimitType)
    return {
      error: NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429, headers: rateLimitHeaders(rl) }
      ),
    }
  }

  return { user: { id: user.id, email: user.email }, supabase }
}

// ─── UUID validation ───

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isValidUUID(id: string): boolean {
  return UUID_RE.test(id)
}

// ─── Prompt injection sanitization ───

export function sanitizeForPrompt(text: string | null | undefined, maxLength: number = 300): string {
  if (!text) return "None"
  const cleaned = text
    .slice(0, maxLength)
    .replace(/```/g, "")
    .replace(/\bsystem\b\s*:/gi, "")
    .replace(/\b(ignore|disregard|forget)\b\s+(all\s+)?(previous|above|prior)\b/gi, "[filtered]")
    .replace(/<\/?[a-z_]+>/gi, "") // strip XML/HTML tags to prevent delimiter escape
    .replace(/\b(IMPORTANT|INSTRUCTION|RULE|OVERRIDE)\s*:/gi, "[filtered]")
  return `<user_data>${cleaned}</user_data>`
}

// ─── Dev endpoint secret verification ───
// Allows access if either: (1) valid DEV_SECRET header, or (2) authenticated admin user
// This lets the dev dashboard work from the browser while still protecting against
// unauthenticated API calls

export async function verifyDevAccess(request: Request): Promise<NextResponse | null> {
  // Block dev endpoints entirely in production
  if (process.env.NODE_ENV === "production" && !process.env.ALLOW_DEV_ENDPOINTS) {
    return NextResponse.json({ error: "Not available in production" }, { status: 404 })
  }

  // Path 1: secret header (for programmatic access) — timing-safe comparison
  const secret = request.headers.get("x-dev-secret")
  const devSecret = process.env.DEV_SECRET
  if (secret && devSecret && safeCompare(secret, devSecret)) {
    return null
  }

  // Path 2: authenticated admin session (for browser access)
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (user?.email) {
    const { isAdmin } = await import("@/lib/admin")
    if (isAdmin(user.email)) {
      auditAdminAccess(user.id, request.url, true)
      return null
    }
  }

  auditAdminAccess(user?.id || "anonymous", request.url, false)
  return NextResponse.json({ error: "Forbidden" }, { status: 403 })
}

// ─── Standard error responses ───

export function errorResponse(message: string, status: number = 500) {
  return NextResponse.json({ error: message }, { status })
}

export function notFoundResponse(message: string = "Not found") {
  return NextResponse.json({ error: message }, { status: 404 })
}

export function forbiddenResponse(message: string = "Forbidden") {
  return NextResponse.json({ error: message }, { status: 403 })
}

export function badRequestResponse(message: string) {
  return NextResponse.json({ error: message }, { status: 400 })
}
