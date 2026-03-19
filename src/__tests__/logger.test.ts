import { describe, it, expect, vi, beforeEach } from "vitest"
import { log } from "@/lib/logger"

describe("Structured logger", () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it("logs info to console.log as JSON", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {})
    log("info", "Test message", { action: "test.action", userId: "123" })

    expect(spy).toHaveBeenCalledTimes(1)
    const parsed = JSON.parse(spy.mock.calls[0][0])
    expect(parsed.level).toBe("info")
    expect(parsed.message).toBe("Test message")
    expect(parsed.action).toBe("test.action")
    expect(parsed.userId).toBe("123")
    expect(parsed.timestamp).toBeDefined()
  })

  it("logs errors to console.error", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {})
    log("error", "Something broke", { action: "test.error" })

    expect(spy).toHaveBeenCalledTimes(1)
    const parsed = JSON.parse(spy.mock.calls[0][0])
    expect(parsed.level).toBe("error")
  })

  it("logs warnings to console.warn", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {})
    log("warn", "Heads up", { action: "test.warn" })

    expect(spy).toHaveBeenCalledTimes(1)
    const parsed = JSON.parse(spy.mock.calls[0][0])
    expect(parsed.level).toBe("warn")
  })

  it("includes additional context fields", () => {
    const spy = vi.spyOn(console, "log").mockImplementation(() => {})
    log("info", "With extras", {
      action: "test.extras",
      route: "/api/test",
      contactId: "xyz",
      custom: 42,
    })

    const parsed = JSON.parse(spy.mock.calls[0][0])
    expect(parsed.route).toBe("/api/test")
    expect(parsed.contactId).toBe("xyz")
    expect(parsed.custom).toBe(42)
  })
})
