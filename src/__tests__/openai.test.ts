import { describe, it, expect } from "vitest"
import { buildContactEmbeddingText } from "@/lib/openai"

describe("buildContactEmbeddingText", () => {
  it("combines all fields", () => {
    const result = buildContactEmbeddingText({
      name: "John Doe",
      company: "Acme",
      job_title: "Engineer",
      raw_note: "Met at conference",
    })
    expect(result).toBe("John Doe Acme Engineer Met at conference")
  })

  it("skips null fields", () => {
    const result = buildContactEmbeddingText({
      name: "John Doe",
      company: null,
      job_title: null,
      raw_note: "Met at conference",
    })
    expect(result).toBe("John Doe Met at conference")
  })

  it("skips undefined fields", () => {
    const result = buildContactEmbeddingText({
      raw_note: "Just a note",
    })
    expect(result).toBe("Just a note")
  })

  it("handles all null except raw_note", () => {
    const result = buildContactEmbeddingText({
      name: null,
      company: null,
      job_title: null,
      raw_note: "Met someone interesting",
    })
    expect(result).toBe("Met someone interesting")
  })

  it("handles empty string fields (treated as falsy)", () => {
    const result = buildContactEmbeddingText({
      name: "",
      company: "Acme",
      job_title: "",
      raw_note: "Note",
    })
    expect(result).toBe("Acme Note")
  })
})
