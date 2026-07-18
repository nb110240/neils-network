import { describe, expect, it, vi, beforeEach } from "vitest"

const h = vi.hoisted(() => ({ structured: vi.fn() }))

vi.mock("@/lib/openai", () => ({ generateStructuredOutput: h.structured }))

import { analyzeInteraction } from "@/lib/action-extraction"

const validAnalysis = {
  summary: "Taylor asked for the updated metrics by Friday.",
  contact: {
    name: "Taylor",
    email: null,
    company: "Northstar",
    job_title: null,
    how_we_met: "Seed meeting",
    next_steps: "Send updated metrics",
  },
  commitments: [{
    title: "Send updated metrics",
    direction: "user_owes",
    details: "Include the July revenue update",
    due_at: "2026-07-18T17:00:00.000Z",
    evidence: "Can you send the updated metrics by Friday?",
    confidence: 0.95,
    priority: 90,
  }],
  follow_up_draft: "Taylor, great speaking today. I will send the updated metrics by Friday.",
}

describe("analyzeInteraction", () => {
  beforeEach(() => h.structured.mockReset())

  it("requests strict schema-constrained output and normalizes the approved result", async () => {
    h.structured.mockResolvedValue(validAnalysis)

    const result = await analyzeInteraction({
      rawText: "Taylor asked for the updated metrics by Friday.",
      title: "Northstar investor call",
      occurredAt: "2026-07-17T10:00:00.000Z",
      userName: "Neil",
    })

    expect(result.commitments[0]).toMatchObject({ title: "Send updated metrics", direction: "user_owes" })
    expect(result.contactPatch).toEqual({
      name: "Taylor",
      company: "Northstar",
      how_we_met: "Seed meeting",
      next_steps: "Send updated metrics",
    })
    expect(h.structured).toHaveBeenCalledWith(expect.objectContaining({
      name: "after_call_review",
      schema: expect.objectContaining({ additionalProperties: false, required: expect.arrayContaining(["summary", "commitments"]) }),
      system: expect.stringContaining("untrusted user data"),
    }))
  })

  it("rejects malformed model output instead of producing an unsafe proposal", async () => {
    h.structured.mockResolvedValue({ ...validAnalysis, commitments: [{ ...validAnalysis.commitments[0], direction: "someone_else" }] })

    await expect(analyzeInteraction({
      rawText: "Taylor asked for the updated metrics by Friday.",
      title: "Northstar investor call",
      occurredAt: "2026-07-17T10:00:00.000Z",
    })).rejects.toThrow(/user_owes|contact_owes/)
  })
})
