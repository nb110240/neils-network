import { describe, it, expect, beforeEach, afterEach } from "vitest"
import {
  attributeVerificationEnabled,
  signSubscriberAttribute,
  verifySubscriberAttribute,
} from "@/lib/revenuecat"

const USER = "11111111-1111-4111-8111-111111111111"
const OTHER_USER = "22222222-2222-4222-8222-222222222222"

describe("revenuecat signed subscriber attribute", () => {
  const original = process.env.REVENUECAT_ATTRIBUTE_SECRET

  describe("with a secret configured", () => {
    beforeEach(() => {
      process.env.REVENUECAT_ATTRIBUTE_SECRET = "test-secret-value"
    })
    afterEach(() => {
      if (original === undefined) delete process.env.REVENUECAT_ATTRIBUTE_SECRET
      else process.env.REVENUECAT_ATTRIBUTE_SECRET = original
    })

    it("reports verification enabled", () => {
      expect(attributeVerificationEnabled()).toBe(true)
    })

    it("sign -> verify roundtrips true", () => {
      const sig = signSubscriberAttribute(USER)
      expect(sig).toBeTruthy()
      expect(verifySubscriberAttribute(USER, sig)).toBe(true)
    })

    it("rejects a tampered signature", () => {
      const sig = signSubscriberAttribute(USER)!
      const tampered = sig.slice(0, -1) + (sig.endsWith("a") ? "b" : "a")
      expect(tampered).not.toBe(sig)
      expect(verifySubscriberAttribute(USER, tampered)).toBe(false)
    })

    it("rejects a signature minted for a different user id", () => {
      const sig = signSubscriberAttribute(OTHER_USER)
      expect(verifySubscriberAttribute(USER, sig)).toBe(false)
    })

    it("rejects a missing signature", () => {
      expect(verifySubscriberAttribute(USER, null)).toBe(false)
      expect(verifySubscriberAttribute(USER, undefined)).toBe(false)
    })
  })

  describe("with no secret configured", () => {
    beforeEach(() => {
      delete process.env.REVENUECAT_ATTRIBUTE_SECRET
    })
    afterEach(() => {
      if (original === undefined) delete process.env.REVENUECAT_ATTRIBUTE_SECRET
      else process.env.REVENUECAT_ATTRIBUTE_SECRET = original
    })

    it("reports verification disabled", () => {
      expect(attributeVerificationEnabled()).toBe(false)
    })

    it("signing returns null", () => {
      expect(signSubscriberAttribute(USER)).toBeNull()
    })

    it("verify returns false even with any signature", () => {
      expect(verifySubscriberAttribute(USER, "anything")).toBe(false)
    })
  })
})
