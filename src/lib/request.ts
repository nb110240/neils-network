import { badRequestResponse } from "@/lib/api-utils"
import { audit } from "@/lib/audit"
import { z } from "zod/v4"
import type { NextResponse } from "next/server"

// ─── Request body size limiter + JSON parser ───
// Prevents oversized payloads from consuming server memory.
// Returns a typed, validated body or an error response.

const DEFAULT_MAX_BODY_SIZE = 100 * 1024 // 100KB — generous for JSON APIs
const LARGE_BODY_ROUTES = new Set(["/api/import/csv", "/api/contacts"]) // routes that may need more

interface ParseBodySuccess<T> {
  data: T
  error?: never
}

interface ParseBodyError {
  data?: never
  error: NextResponse
}

type ParseBodyResult<T> = ParseBodySuccess<T> | ParseBodyError

/**
 * Parse and validate a request body in one call.
 *
 * Usage:
 *   const result = await parseBody(request, MyZodSchema)
 *   if (result.error) return result.error
 *   const { name, email } = result.data
 */
export async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>,
  options?: { maxSize?: number; route?: string; userId?: string }
): Promise<ParseBodyResult<T>> {
  const maxSize = options?.maxSize || DEFAULT_MAX_BODY_SIZE

  // Check Content-Length header first (fast reject)
  const contentLength = request.headers.get("content-length")
  if (contentLength && parseInt(contentLength, 10) > maxSize) {
    if (options?.userId) {
      audit({
        action: "security.body_too_large",
        severity: "warn",
        userId: options.userId,
        route: options.route,
        detail: `Request body too large: ${contentLength} bytes (max ${maxSize})`,
      })
    }
    return { error: badRequestResponse(`Request body too large (max ${Math.round(maxSize / 1024)}KB)`) }
  }

  // Read body with streaming size check
  let bodyText: string
  try {
    bodyText = await request.text()
  } catch {
    return { error: badRequestResponse("Failed to read request body") }
  }

  if (bodyText.length > maxSize) {
    if (options?.userId) {
      audit({
        action: "security.body_too_large",
        severity: "warn",
        userId: options.userId,
        route: options.route,
        detail: `Request body too large: ${bodyText.length} bytes (max ${maxSize})`,
      })
    }
    return { error: badRequestResponse(`Request body too large (max ${Math.round(maxSize / 1024)}KB)`) }
  }

  // Parse JSON
  let json: unknown
  try {
    json = JSON.parse(bodyText)
  } catch {
    return { error: badRequestResponse("Invalid JSON") }
  }

  // Validate with Zod
  const parsed = schema.safeParse(json)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]
    const field = firstIssue?.path?.join(".") || "input"
    return {
      error: badRequestResponse(`Invalid ${field}: ${firstIssue?.message || "check your input"}`),
    }
  }

  return { data: parsed.data }
}

/**
 * Parse JSON body without Zod validation (for routes that do manual validation).
 * Still enforces size limits.
 */
export async function parseJSON(
  request: Request,
  options?: { maxSize?: number; route?: string; userId?: string }
): Promise<ParseBodyResult<unknown>> {
  return parseBody(request, z.unknown(), options)
}
