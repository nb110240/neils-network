import { describe, it, expect, beforeEach } from "vitest"
import { isAdmin } from "@/lib/admin"

describe("isAdmin", () => {
  beforeEach(() => {
    process.env.ADMIN_EMAILS = "admin@savvo.app,boss@savvo.app"
  })

  it("returns true for admin email", () => {
    expect(isAdmin("admin@savvo.app")).toBe(true)
  })

  it("returns true for admin email case-insensitive", () => {
    expect(isAdmin("ADMIN@savvo.app")).toBe(true)
  })

  it("returns true for second admin email", () => {
    expect(isAdmin("boss@savvo.app")).toBe(true)
  })

  it("returns false for non-admin email", () => {
    expect(isAdmin("user@example.com")).toBe(false)
  })

  it("returns false for undefined", () => {
    expect(isAdmin(undefined)).toBe(false)
  })

  it("returns false for empty string", () => {
    expect(isAdmin("")).toBe(false)
  })

  it("returns false when ADMIN_EMAILS is not set", () => {
    delete process.env.ADMIN_EMAILS
    expect(isAdmin("admin@savvo.app")).toBe(false)
  })

  it("returns false when ADMIN_EMAILS is empty string", () => {
    process.env.ADMIN_EMAILS = ""
    expect(isAdmin("admin@savvo.app")).toBe(false)
  })
})
