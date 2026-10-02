import { describe, expect, it } from "vitest"
import {
  buildPipelineDigest,
  pipelineDigestSubject,
  renderPipelineDigestBody,
  renderPipelineDigestFooter,
  type PipelineInvestor,
} from "@/lib/pipeline-digest"

let n = 0
const inv = (name: string, stage: string, company: string | null = null): PipelineInvestor => ({
  id: `c-${++n}`, name, company, investor_stage: stage,
})

describe("weekly pipeline digest", () => {
  it("has nothing to say until the founder tracks investors", () => {
    expect(buildPipelineDigest({ founderName: "Neil", investors: [], meetingContactIds: [] })).toBeNull()
    expect(buildPipelineDigest({ founderName: "Neil", investors: [inv("X", "not_a_stage")], meetingContactIds: [] })).toBeNull()
  })

  it("counts the funnel, lists this week's meetings and late-stage talks", () => {
    const maya = inv("Maya Chen", "partner_meeting", "Northwind")
    const sam = inv("Sam Ortiz", "first_meeting", "Index")
    const lee = inv("Lee Park", "committed", "Lightspeed")
    const dee = inv("Dee Rao", "diligence")
    const old = inv("Old Pass", "passed")
    const digest = buildPipelineDigest({
      founderName: "Neil",
      investors: [maya, sam, lee, dee, old, inv("Res One", "researching")],
      meetingContactIds: [sam.id, maya.id, "not-an-investor"],
    })!
    expect(digest.active).toBe(5)
    expect(digest.committed).toBe(1)
    expect(digest.passed).toBe(1)
    expect(digest.stages.find((s) => s.value === "partner_meeting")?.count).toBe(1)
    expect(digest.metThisWeek.map((c) => c.name)).toEqual(["Maya Chen", "Sam Ortiz"])
    // Furthest along first: committed, diligence, partner meeting.
    expect(digest.lateStage.map((c) => c.name)).toEqual(["Lee Park", "Dee Rao", "Maya Chen"])
    expect(pipelineDigestSubject(digest)).toBe("Neil's raise this week: 5 active, 1 committed")
  })

  it("never lets a name, firm or founder name inject HTML", () => {
    const digest = buildPipelineDigest({
      founderName: "<img src=x onerror=alert(1)>",
      investors: [inv("<script>alert(1)</script>", "committed", "\"><a href=evil>")],
      meetingContactIds: [],
    })!
    const html = renderPipelineDigestBody(digest, { founderEmail: "a\"<b>@x.com" }) +
      renderPipelineDigestFooter({ founderName: digest.founderName, unsubscribeUrl: "https://savvo.app/pipeline/unsubscribe/t\"x" })
    expect(html).not.toMatch(/<script|<img|<a href=evil|"<b>/)
    expect(html).toContain("&lt;script&gt;")
  })

  it("shares names, firms and stages only", () => {
    const digest = buildPipelineDigest({ founderName: "Neil", investors: [inv("Maya Chen", "diligence", "Northwind")], meetingContactIds: [] })!
    const html = renderPipelineDigestBody(digest, { founderEmail: "neil@savvo.app" })
    expect(html).toContain("Maya Chen")
    expect(html).toContain("Northwind")
    expect(html).toContain("Diligence")
    expect(html).toContain("No investor meetings logged this week.")
    expect(html).toContain("Reply to this email to reach Neil (neil@savvo.app)")
  })

  it("keeps a big pipeline to a short email", () => {
    const many = Array.from({ length: 20 }, (_, i) => inv(`Investor ${String(i).padStart(2, "0")}`, "diligence"))
    const digest = buildPipelineDigest({ founderName: "Neil", investors: many, meetingContactIds: [] })!
    const html = renderPipelineDigestBody(digest, { founderEmail: "neil@savvo.app" })
    expect(html).toContain("Investor 11")
    expect(html).not.toContain("Investor 12")
    expect(html).toContain("and 8 more")
  })

  it("tells the recipient who added them and how to stop", () => {
    const footer = renderPipelineDigestFooter({ founderName: "Neil", unsubscribeUrl: "https://savvo.app/pipeline/unsubscribe/abc" })
    expect(footer).toContain("because Neil added you")
    expect(footer).toContain('href="https://savvo.app/pipeline/unsubscribe/abc"')
    expect(footer).toContain("Stop these emails")
  })
})
