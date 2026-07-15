import { describe, it, expect } from "vitest"
import { DAILY_DIGEST_PLANS, PLAN_LIMITS, type PlanType } from "@/lib/types"
import { getPlanLimits } from "@/lib/subscription"

describe("Plan limits", () => {
  it("free plan has 50 contact limit", () => {
    const limits = getPlanLimits("free")
    expect(limits.maxContacts).toBe(50)
  })

  it("pro plan has unlimited contacts", () => {
    const limits = getPlanLimits("pro")
    expect(limits.maxContacts).toBe(Infinity)
  })

  it("free plan allows digest (weekly)", () => {
    const limits = getPlanLimits("free")
    expect(limits.canDigest).toBe(true)
  })

  it("free plan has 5 semantic searches per month", () => {
    const limits = getPlanLimits("free")
    expect(limits.semanticSearchLimit).toBe(5)
  })

  it("pro plan has unlimited semantic searches", () => {
    const limits = getPlanLimits("pro")
    expect(limits.semanticSearchLimit).toBe(Infinity)
  })

  it("free plan cannot import", () => {
    const limits = getPlanLimits("free")
    expect(limits.canImport).toBe(false)
  })

  it("pro plan can import", () => {
    const limits = getPlanLimits("pro")
    expect(limits.canImport).toBe(true)
  })

  it("free plan cannot sync calendar", () => {
    const limits = getPlanLimits("free")
    expect(limits.canCalendarSync).toBe(false)
  })

  it("all plan types are defined", () => {
    const planTypes: PlanType[] = ["free", "pro", "team"]
    for (const plan of planTypes) {
      expect(PLAN_LIMITS[plan]).toBeDefined()
      expect(typeof PLAN_LIMITS[plan].maxContacts).toBe("number")
    }
  })

  // Team plan tests
  it("team plan has unlimited contacts", () => {
    const limits = getPlanLimits("team")
    expect(limits.maxContacts).toBe(Infinity)
  })

  it("team plan has unlimited semantic searches", () => {
    const limits = getPlanLimits("team")
    expect(limits.semanticSearchLimit).toBe(Infinity)
  })

  it("team plan can import", () => {
    const limits = getPlanLimits("team")
    expect(limits.canImport).toBe(true)
  })

  it("team plan can sync calendar", () => {
    const limits = getPlanLimits("team")
    expect(limits.canCalendarSync).toBe(true)
  })

  it("team plan can digest", () => {
    const limits = getPlanLimits("team")
    expect(limits.canDigest).toBe(true)
  })

  it("daily digests include both paid plans", () => {
    expect(DAILY_DIGEST_PLANS).toEqual(["pro", "team"])
  })

  it("pro plan can sync calendar", () => {
    const limits = getPlanLimits("pro")
    expect(limits.canCalendarSync).toBe(true)
  })

  it("free plan allows semantic search", () => {
    const limits = getPlanLimits("free")
    expect(limits.canSemanticSearch).toBe(true)
  })
})
