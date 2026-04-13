import { log } from "@/lib/logger"

// ─── Security audit logger ───
// Structured audit trail for security-sensitive operations.
// Every audit event includes who, what, when, and the outcome.
// In production, these are machine-parseable JSON lines that can be
// shipped to any log aggregator (Datadog, Axiom, Betterstack, etc.).

export type AuditAction =
  | "auth.login"
  | "auth.logout"
  | "auth.failed"
  | "auth.signup"
  | "account.delete"
  | "account.plan_change"
  | "contact.create"
  | "contact.update"
  | "contact.delete"
  | "contact.export"
  | "contact.import"
  | "admin.access"
  | "admin.denied"
  | "rate_limit.exceeded"
  | "webhook.received"
  | "webhook.invalid_signature"
  | "webhook.customer_mismatch"
  | "dev.access"
  | "dev.denied"
  | "cron.executed"
  | "cron.unauthorized"
  | "security.suspicious_input"
  | "security.body_too_large"

export type AuditSeverity = "info" | "warn" | "critical"

interface AuditEvent {
  action: AuditAction
  severity: AuditSeverity
  userId?: string
  ip?: string
  route?: string
  detail?: string
  metadata?: Record<string, unknown>
}

// Map severity to log level
const severityToLevel: Record<AuditSeverity, "info" | "warn" | "error"> = {
  info: "info",
  warn: "warn",
  critical: "error",
}

export function audit(event: AuditEvent): void {
  const level = severityToLevel[event.severity]
  log(level, `[AUDIT] ${event.action}`, {
    action: event.action,
    category: "audit",
    severity: event.severity,
    userId: event.userId,
    ip: event.ip,
    route: event.route,
    detail: event.detail,
    ...event.metadata,
  })
}

// ─── Convenience helpers ───

export function auditAuthFailure(route: string, ip?: string, detail?: string): void {
  audit({
    action: "auth.failed",
    severity: "warn",
    route,
    ip,
    detail: detail || "Authentication failed",
  })
}

export function auditRateLimitHit(userId: string, route: string, limitType: string): void {
  audit({
    action: "rate_limit.exceeded",
    severity: "warn",
    userId,
    route,
    detail: `Rate limit exceeded: ${limitType}`,
    metadata: { limitType },
  })
}

export function auditWebhookFailure(
  action: "webhook.invalid_signature" | "webhook.customer_mismatch",
  detail: string,
  ip?: string
): void {
  audit({
    action,
    severity: "critical",
    route: "/api/stripe/webhook",
    ip,
    detail,
  })
}

export function auditAccountDeletion(userId: string): void {
  audit({
    action: "account.delete",
    severity: "critical",
    userId,
    route: "/api/settings/delete-account",
    detail: "User account permanently deleted",
  })
}

export function auditPlanChange(
  userId: string,
  from: string,
  to: string,
  source: string
): void {
  audit({
    action: "account.plan_change",
    severity: "info",
    userId,
    route: "/api/stripe/webhook",
    detail: `Plan changed: ${from} → ${to} (via ${source})`,
    metadata: { from, to, source },
  })
}

export function auditAdminAccess(userId: string, route: string, granted: boolean): void {
  audit({
    action: granted ? "admin.access" : "admin.denied",
    severity: granted ? "info" : "warn",
    userId,
    route,
    detail: granted ? "Admin access granted" : "Admin access denied",
  })
}

export function auditSuspiciousInput(userId: string, route: string, detail: string): void {
  audit({
    action: "security.suspicious_input",
    severity: "warn",
    userId,
    route,
    detail,
  })
}
