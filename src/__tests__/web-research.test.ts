import { afterEach, describe, expect, it, vi } from "vitest"
import { annotateResearchText, researchInvestor } from "@/lib/web-research"

describe("sourced investor research", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("replaces provider citation spans with stable numbered links", () => {
    const result = annotateResearchText("Focuses on seed fintech.†", [{
      type: "url_citation",
      start_index: 24,
      end_index: 25,
      url: "https://fund.example/thesis",
      title: "Investment thesis",
    }])
    expect(result.summary).toBe("Focuses on seed fintech.[1]")
    expect(result.citations).toEqual([{ number: 1, url: "https://fund.example/thesis", title: "Investment thesis" }])
  })

  it("drops citation schemes that are unsafe to open", () => {
    const result = annotateResearchText("Profile.†", [{
      type: "url_citation",
      start_index: 8,
      end_index: 9,
      url: "javascript:alert(1)",
      title: "Unsafe",
    }])
    expect(result.citations).toEqual([])
    expect(result.summary).toBe("Profile.†")
  })

  it("uses web search and returns only research with verifiable sources", async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      status: "completed",
      model: "gpt-5.4-mini",
      output: [{
        type: "message",
        content: [{
          type: "output_text",
          text: "Public profile.†",
          annotations: [{ type: "url_citation", start_index: 15, end_index: 16, url: "https://fund.example/alex", title: "Alex profile" }],
        }],
      }],
    }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const result = await researchInvestor({ name: "Alex", company: "Fund" })
    expect(result.summary).toBe("Public profile.[1]")
    const request = JSON.parse(String(fetchMock.mock.calls[0][1]?.body))
    expect(request.tools).toEqual([{ type: "web_search" }])
  })

  it("rejects uncited external research", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      status: "completed",
      output: [{ type: "message", content: [{ type: "output_text", text: "Unsupported claim", annotations: [] }] }],
    }), { status: 200 })))
    await expect(researchInvestor({ name: "Alex", company: "Fund" })).rejects.toThrow("no verifiable sources")
  })
})
