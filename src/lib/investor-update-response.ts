// ─── Investor update response handling (client) ───
// Interprets the /api/investor-update response without trusting the body to
// be JSON: a proxy error page or empty 403 must still route to the right UI.

export type InvestorUpdateResponse =
  | { kind: "upgrade" }
  | { kind: "error"; message: string }
  | { kind: "ok"; body: Record<string, unknown> }

export async function readInvestorUpdateResponse(response: Response): Promise<InvestorUpdateResponse> {
  const parsed: unknown = await response.json().catch(() => ({}))
  const body = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}
  if (response.status === 403) return { kind: "upgrade" }
  if (!response.ok) return { kind: "error", message: typeof body.error === "string" ? body.error : "" }
  return { kind: "ok", body }
}
