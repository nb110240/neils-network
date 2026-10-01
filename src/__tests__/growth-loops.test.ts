import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"
import {
  INVESTOR_STAGES,
  normalizeInvestorStage,
  summarizeStages,
} from "@/lib/investor-stage"
import { guessImportField, IMPORT_FIELD_VALUES } from "@/lib/import-mapping"
import { createShareToken, isValidShareToken } from "@/lib/share-token"
import { isValidReferralCode, referralUrl } from "@/lib/referrals"
import { generateReferralCode } from "@/lib/referrals-server"

describe("investor stages", () => {
  it("match the 8 stages documented on the free tracker template", () => {
    const template = readFileSync(join(process.cwd(), "src/app/templates/investor-tracker/page.tsx"), "utf8")
    const documented = [...template.matchAll(/\{ stage: "([^"]+)"/g)].map((m) => m[1])
    expect(documented).toHaveLength(8)
    expect(documented.map(normalizeInvestorStage)).toEqual(INVESTOR_STAGES.map((s) => s.value))
  })

  it("map every Status value in the template CSV", () => {
    const csv = readFileSync(join(process.cwd(), "public/templates/investor-pipeline-tracker.csv"), "utf8")
    const [header, ...rows] = csv.trim().split("\n")
    const statusIndex = header.split(",").indexOf("Status")
    for (const row of rows) {
      const status = row.split(",")[statusIndex]
      expect(normalizeInvestorStage(status), status).not.toBeNull()
    }
  })

  it.each([
    ["Intro Requested", "intro_requested"],
    ["first mtg", "first_meeting"],
    ["Pitched 3/4", "first_meeting"],
    ["Partner meeting scheduled", "partner_meeting"],
    ["DD", "diligence"],
    ["Term sheet!", "committed"],
    ["Verbal yes", "committed"],
    ["Pass - too early", "passed"],
    ["Cold emailed", "intro_made"],
    ["Target", "researching"],
    ["", null],
    ["Check back in Q3", null],
    // False positives found in review: none of these may be guessed wrong.
    ["Not contacted", "researching"],
    ["Not yet contacted", "researching"],
    ["Passive", null],
    ["Deadline Q3", null],
    ["Signed NDA", null],
    ["Closed", null],
    ["Lead", null],
    ["Emailed partner", "intro_made"],
    ["Partner intro requested", "intro_requested"],
    ["Notes", null],
    ["November", null],
  ])("normalizes %j to %s", (input, expected) => {
    expect(normalizeInvestorStage(input)).toBe(expected)
  })

  it("summarizes counts in funnel order and ignores junk keys", () => {
    const summary = summarizeStages({ first_meeting: 3, committed: 1, passed: 2, bogus: 9, diligence: -4 })
    expect(summary.rows.map((r) => r.value)).toEqual(INVESTOR_STAGES.map((s) => s.value))
    expect(summary.active).toBe(4)
    expect(summary.committed).toBe(1)
    expect(summary.passed).toBe(2)
  })
})

describe("import mapping for raise stage", () => {
  it("maps the template's Status column but not Stage Focus", () => {
    expect(IMPORT_FIELD_VALUES).toContain("investor_stage")
    expect(guessImportField("Status")).toBe("investor_stage")
    expect(guessImportField("Pipeline Stage")).toBe("investor_stage")
    expect(guessImportField("Stage Focus")).toBe("skip")
    expect(guessImportField("Pipeline Owner Name")).toBe("name")
  })
})

describe("share tokens and referral codes", () => {
  it("creates unguessable tokens that pass the DB CHECK pattern", () => {
    const a = createShareToken()
    expect(isValidShareToken(a)).toBe(true)
    expect(a).not.toBe(createShareToken())
    expect(isValidShareToken("short")).toBe(false)
    expect(isValidShareToken("a".repeat(40) + "'; drop")).toBe(false)
  })

  it("creates 8-char lowercase codes without look-alike characters", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateReferralCode()
      expect(isValidReferralCode(code)).toBe(true)
      expect(code).not.toMatch(/[01ilo]/)
    }
    expect(isValidReferralCode("ABCDEFGH")).toBe(false)
    expect(referralUrl("https://savvo.app/", "abcd2345")).toBe("https://savvo.app/r/abcd2345")
  })
})

describe("share token redaction for analytics", () => {
  it("strips intro and snapshot tokens from URLs and paths", async () => {
    const { redactShareTokens } = await import("@/lib/redact-url")
    const token = "Ab3_-".repeat(9)
    expect(redactShareTokens(`https://savvo.app/i/${token}`)).toBe("https://savvo.app/i/[token]")
    expect(redactShareTokens(`/s/${token}?x=1`)).toBe("/s/[token]?x=1")
    expect(redactShareTokens("/intros")).toBe("/intros")
    expect(redactShareTokens("/settings")).toBe("/settings")
    expect(redactShareTokens(null)).toBeNull()
  })

  it("never stores a token as the first-touch landing path", async () => {
    const { parseAttribution } = await import("@/lib/attribution")
    const touch = parseAttribution(`https://savvo.app/s/${"x".repeat(43)}?utm_source=twitter`)
    expect(touch?.landing_path).toBe("/s/[token]?utm_source=twitter")
  })
})
