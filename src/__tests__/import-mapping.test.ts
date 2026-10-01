import { describe, expect, it } from "vitest"
import { guessImportField } from "@/lib/import-mapping"

describe("CSV import column guessing", () => {
  it("maps the supported investor template columns without overwriting next steps", () => {
    expect(guessImportField("Investor Name")).toBe("name")
    expect(guessImportField("Firm")).toBe("company")
    expect(guessImportField("Role")).toBe("job_title")
    expect(guessImportField("Intro Path")).toBe("how_we_met")
    expect(guessImportField("Last Contact Date")).toBe("last_contact_date")
    expect(guessImportField("Next Step")).toBe("next_steps")
    expect(guessImportField("Next Step Date")).toBe("scheduled_follow_up")
    expect(guessImportField("Notes")).toBe("notes")
  })

  it("skips spreadsheet-only fields Savvo does not store", () => {
    expect(guessImportField("Check Size Range")).toBe("skip")
    expect(guessImportField("Stage Focus")).toBe("skip")
  })

  it("imports the template's Status column as the raise stage", () => {
    expect(guessImportField("Status")).toBe("investor_stage")
  })
})
