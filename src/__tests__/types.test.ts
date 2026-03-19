import { describe, it, expect } from "vitest"
import { PLAN_LIMITS } from "@/lib/types"

describe("PLAN_LIMITS", () => {
  it("free plan has correct limits", () => {
    expect(PLAN_LIMITS.free.maxContacts).toBe(50)
    expect(PLAN_LIMITS.free.canImport).toBe(false)
    expect(PLAN_LIMITS.free.canSemanticSearch).toBe(true)
    expect(PLAN_LIMITS.free.semanticSearchLimit).toBe(5)
    expect(PLAN_LIMITS.free.canDigest).toBe(true) // Free users get weekly digest
    expect(PLAN_LIMITS.free.canCalendarSync).toBe(false)
  })

  it("pro plan has unlimited features", () => {
    expect(PLAN_LIMITS.pro.maxContacts).toBe(Infinity)
    expect(PLAN_LIMITS.pro.canImport).toBe(true)
    expect(PLAN_LIMITS.pro.canSemanticSearch).toBe(true)
    expect(PLAN_LIMITS.pro.semanticSearchLimit).toBe(Infinity)
    expect(PLAN_LIMITS.pro.canDigest).toBe(true)
    expect(PLAN_LIMITS.pro.canCalendarSync).toBe(true)
  })

  it("team plan matches pro features", () => {
    expect(PLAN_LIMITS.team.maxContacts).toBe(Infinity)
    expect(PLAN_LIMITS.team.canImport).toBe(true)
    expect(PLAN_LIMITS.team.canCalendarSync).toBe(true)
  })
})
