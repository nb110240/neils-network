import { describe, it, expect, vi, beforeEach } from "vitest"
import {
  audit,
  auditAuthFailure,
  auditRateLimitHit,
  auditWebhookFailure,
  auditAccountDeletion,
  auditPlanChange,
  auditAdminAccess,
  auditSuspiciousInput,
} from "@/lib/audit"

// Mock the logger
vi.mock("@/lib/logger", () => ({
  log: vi.fn(),
}))

import { log } from "@/lib/logger"
const mockLog = vi.mocked(log)

describe("Audit logger", () => {
  beforeEach(() => {
    mockLog.mockClear()
  })

  it("logs audit events with correct structure", () => {
    audit({
      action: "auth.login",
      severity: "info",
      userId: "user-123",
      route: "/api/auth",
      detail: "User logged in",
    })

    expect(mockLog).toHaveBeenCalledOnce()
    expect(mockLog).toHaveBeenCalledWith(
      "info",
      "[AUDIT] auth.login",
      expect.objectContaining({
        action: "auth.login",
        category: "audit",
        severity: "info",
        userId: "user-123",
        route: "/api/auth",
        detail: "User logged in",
      })
    )
  })

  it("maps severity to correct log level", () => {
    audit({ action: "auth.failed", severity: "info", detail: "test" })
    expect(mockLog).toHaveBeenCalledWith("info", expect.any(String), expect.any(Object))

    mockLog.mockClear()
    audit({ action: "auth.failed", severity: "warn", detail: "test" })
    expect(mockLog).toHaveBeenCalledWith("warn", expect.any(String), expect.any(Object))

    mockLog.mockClear()
    audit({ action: "auth.failed", severity: "critical", detail: "test" })
    expect(mockLog).toHaveBeenCalledWith("error", expect.any(String), expect.any(Object))
  })

  it("includes metadata in audit events", () => {
    audit({
      action: "account.plan_change",
      severity: "info",
      metadata: { from: "free", to: "pro", source: "stripe" },
    })

    expect(mockLog).toHaveBeenCalledWith(
      "info",
      expect.any(String),
      expect.objectContaining({
        from: "free",
        to: "pro",
        source: "stripe",
      })
    )
  })
})

describe("Audit convenience helpers", () => {
  beforeEach(() => {
    mockLog.mockClear()
  })

  it("auditAuthFailure logs with warn severity", () => {
    auditAuthFailure("/api/contacts", "192.168.1.1")

    expect(mockLog).toHaveBeenCalledWith(
      "warn",
      "[AUDIT] auth.failed",
      expect.objectContaining({
        action: "auth.failed",
        severity: "warn",
        route: "/api/contacts",
        ip: "192.168.1.1",
      })
    )
  })

  it("auditRateLimitHit includes limit type", () => {
    auditRateLimitHit("user-123", "/api/search", "search")

    expect(mockLog).toHaveBeenCalledWith(
      "warn",
      "[AUDIT] rate_limit.exceeded",
      expect.objectContaining({
        userId: "user-123",
        limitType: "search",
      })
    )
  })

  it("auditWebhookFailure logs critical severity", () => {
    auditWebhookFailure("webhook.invalid_signature", "Signature mismatch")

    expect(mockLog).toHaveBeenCalledWith(
      "error",
      "[AUDIT] webhook.invalid_signature",
      expect.objectContaining({
        severity: "critical",
      })
    )
  })

  it("auditAccountDeletion logs critical severity", () => {
    auditAccountDeletion("user-123")

    expect(mockLog).toHaveBeenCalledWith(
      "error",
      "[AUDIT] account.delete",
      expect.objectContaining({
        severity: "critical",
        userId: "user-123",
      })
    )
  })

  it("auditPlanChange includes from/to/source", () => {
    auditPlanChange("user-123", "free", "pro", "checkout")

    expect(mockLog).toHaveBeenCalledWith(
      "info",
      "[AUDIT] account.plan_change",
      expect.objectContaining({
        from: "free",
        to: "pro",
        source: "checkout",
      })
    )
  })

  it("auditAdminAccess distinguishes granted vs denied", () => {
    auditAdminAccess("user-123", "/dev/users", true)
    expect(mockLog).toHaveBeenCalledWith(
      "info",
      "[AUDIT] admin.access",
      expect.objectContaining({ action: "admin.access" })
    )

    mockLog.mockClear()
    auditAdminAccess("user-456", "/dev/users", false)
    expect(mockLog).toHaveBeenCalledWith(
      "warn",
      "[AUDIT] admin.denied",
      expect.objectContaining({ action: "admin.denied" })
    )
  })

  it("auditSuspiciousInput includes details", () => {
    auditSuspiciousInput("user-123", "/api/contacts", "SQL injection attempt detected")

    expect(mockLog).toHaveBeenCalledWith(
      "warn",
      "[AUDIT] security.suspicious_input",
      expect.objectContaining({
        userId: "user-123",
        detail: "SQL injection attempt detected",
      })
    )
  })
})
