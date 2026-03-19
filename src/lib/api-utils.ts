import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { rateLimit, rateLimitHeaders, type RateLimitType } from "@/lib/rate-limit"
import type { SupabaseClient } from "@supabase/supabase-js"

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
    return {
      error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    }
  }

  const rl = await rateLimit(user.id, rateLimitType)
  if (!rl.success) {
    return {
      error: NextResponse.json(
        { error: "Too many requests. Please slow down." },
        { status: 429, headers: rateLimitHeaders(rl) }
      ),
    }
  }

  return { user: { id: user.id, email: user.email }, supabase }
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
