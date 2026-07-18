import { afterEach, describe, expect, it, vi } from "vitest"
import { getGranolaNote, granolaNoteToMeetingText, listGranolaNotes } from "@/lib/granola"

const note = {
  id: "not_1d3tmYTlCICgjy",
  object: "note",
  title: "Investor update",
  owner: { name: "Neil", email: "neil@savvo.app" },
  created_at: "2026-07-17T10:00:00Z",
  updated_at: "2026-07-17T11:00:00Z",
  attendees: [{ name: "Alex", email: "alex@fund.com" }],
  calendar_event: { scheduled_start_time: "2026-07-17T10:00:00Z" },
  summary_text: "Alex agreed to review the deck.",
  summary_markdown: null,
  transcript: [{ speaker: { source: "speaker" }, text: "Send me the deck Friday.", start_time: "2026-07-17T10:00:00Z" }],
}

describe("Granola API client", () => {
  afterEach(() => vi.unstubAllGlobals())

  it("uses bearer auth and validates the list response", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ notes: [note], hasMore: false, cursor: null }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    const result = await listGranolaNotes("grn_secret", "2026-07-01T00:00:00Z", 10)
    expect(result.notes[0].id).toBe(note.id)
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("created_after=2026-07-01"), expect.objectContaining({
      headers: expect.objectContaining({ Authorization: "Bearer grn_secret" }),
    }))
  })

  it("passes the provider cursor when scanning later pages", async () => {
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ notes: [], hasMore: false, cursor: null }), { status: 200 }))
    vi.stubGlobal("fetch", fetchMock)
    await listGranolaNotes("grn_secret", "2026-07-01T00:00:00Z", 30, "next-page")
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("cursor=next-page"), expect.anything())
  })

  it("fetches transcript details and turns them into reviewable meeting text", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(note), { status: 200 })))
    const result = await getGranolaNote("grn_secret", note.id)
    expect(granolaNoteToMeetingText(result)).toContain("Attendees: Alex <alex@fund.com>")
    expect(granolaNoteToMeetingText(result)).toContain("speaker: Send me the deck Friday.")
  })

  it("returns a safe error for rejected keys without exposing the key", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Unauthorized", { status: 401 })))
    await expect(listGranolaNotes("grn_do_not_echo")).rejects.toThrow("Granola rejected this API key")
  })
})
