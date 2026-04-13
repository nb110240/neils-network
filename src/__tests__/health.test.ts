import { describe, it, expect } from "vitest"
import { calculateHealthScore } from "@/lib/health"

describe("calculateHealthScore", () => {
  const now = new Date()
  const daysAgo = (days: number) =>
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString()

  it("returns green/Active for contact within 7 days", () => {
    const result = calculateHealthScore(daysAgo(3), daysAgo(30))
    expect(result.level).toBe("green")
    expect(result.label).toBe("Active")
    expect(result.score).toBe(100)
  })

  it("returns green/Good for contact within 8-30 days", () => {
    const result = calculateHealthScore(daysAgo(15), daysAgo(60))
    expect(result.level).toBe("green")
    expect(result.label).toBe("Good")
    expect(result.score).toBe(75)
  })

  it("returns yellow/Cooling for contact within 31-90 days", () => {
    const result = calculateHealthScore(daysAgo(45), daysAgo(120))
    expect(result.level).toBe("yellow")
    expect(result.label).toBe("Cooling")
    expect(result.score).toBe(50)
  })

  it("returns orange/Going Cold for contact within 91-180 days", () => {
    const result = calculateHealthScore(daysAgo(120), daysAgo(200))
    expect(result.level).toBe("orange")
    expect(result.label).toBe("Going cold")
    expect(result.score).toBe(25)
  })

  it("returns red/Cold for contact over 180 days", () => {
    const result = calculateHealthScore(daysAgo(200), daysAgo(365))
    expect(result.level).toBe("red")
    expect(result.label).toBe("Cold")
    expect(result.score).toBe(10)
  })

  // Edge cases
  it("uses created_at when last_contact_date is null", () => {
    const result = calculateHealthScore(null, daysAgo(5))
    expect(result.level).toBe("green")
  })

  it("handles boundary: exactly 7 days", () => {
    const result = calculateHealthScore(daysAgo(7), daysAgo(30))
    expect(result.level).toBe("green")
  })

  it("handles boundary: exactly 30 days", () => {
    const result = calculateHealthScore(daysAgo(30), daysAgo(60))
    expect(result.level).toBe("green")
  })

  it("handles boundary: exactly 90 days", () => {
    const result = calculateHealthScore(daysAgo(90), daysAgo(120))
    expect(result.level).toBe("yellow")
  })

  it("handles boundary: exactly 180 days", () => {
    const result = calculateHealthScore(daysAgo(180), daysAgo(365))
    expect(result.level).toBe("orange")
  })

  it("handles future date gracefully", () => {
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()
    const result = calculateHealthScore(tomorrow, daysAgo(30))
    expect(result.level).toBe("green")
    expect(result.score).toBe(100)
  })

  it("returns green/Active for today (0 days)", () => {
    const result = calculateHealthScore(now.toISOString(), daysAgo(30))
    expect(result.level).toBe("green")
    expect(result.label).toBe("Active")
    expect(result.score).toBe(100)
  })

  it("returns correct result when last_contact_date is null and created_at is recent", () => {
    const result = calculateHealthScore(null, daysAgo(2))
    expect(result.level).toBe("green")
    expect(result.score).toBe(100)
  })

  it("returns red when last_contact_date is null and created_at is very old", () => {
    const result = calculateHealthScore(null, daysAgo(365))
    expect(result.level).toBe("red")
    expect(result.score).toBe(10)
  })

  it("handles boundary: exactly 31 days (yellow)", () => {
    const result = calculateHealthScore(daysAgo(31), daysAgo(60))
    expect(result.level).toBe("yellow")
    expect(result.score).toBe(50)
  })

  it("handles boundary: exactly 91 days (orange)", () => {
    const result = calculateHealthScore(daysAgo(91), daysAgo(200))
    expect(result.level).toBe("orange")
    expect(result.score).toBe(25)
  })

  it("handles boundary: exactly 181 days (red)", () => {
    const result = calculateHealthScore(daysAgo(181), daysAgo(365))
    expect(result.level).toBe("red")
    expect(result.score).toBe(10)
  })
})
