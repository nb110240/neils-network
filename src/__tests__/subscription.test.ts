import { describe, it, expect } from "vitest"
import { PLAN_LIMITS, type PlanType } from "@/lib/types"
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
})
