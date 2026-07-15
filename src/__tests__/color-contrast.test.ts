import { describe, expect, it } from "vitest"
import { getAccessibleTextColor } from "@/lib/color-contrast"

describe("getAccessibleTextColor", () => {
  it("uses dark text on bright tag colors", () => {
    expect(getAccessibleTextColor("#f97316")).toBe("#0c0a09")
    expect(getAccessibleTextColor("#eab308")).toBe("#0c0a09")
  })

  it("uses white text on dark tag colors", () => {
    expect(getAccessibleTextColor("#78716c")).toBe("#ffffff")
    expect(getAccessibleTextColor("#3b82f6")).toBe("#0c0a09")
  })

  it("falls back to dark text for malformed colors", () => {
    expect(getAccessibleTextColor("not-a-color")).toBe("#0c0a09")
  })
})
