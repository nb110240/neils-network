import { describe, expect, it } from "vitest"
import {
  extractEmailAddress,
  hashMeetingContent,
  htmlToPlainText,
  normalizeMeetingText,
} from "@/lib/meeting-content"

describe("meeting content normalization", () => {
  it("normalizes line endings before hashing for stable deduplication", () => {
    expect(hashMeetingContent("one\r\ntwo\n")).toBe(hashMeetingContent("one\ntwo"))
  })

  it("turns email HTML into readable text without scripts or styles", () => {
    const html = "<style>.x{display:none}</style><p>Neil &amp; Jane</p><script>alert(1)</script><div>Next step&nbsp;Friday</div>"
    expect(htmlToPlainText(html)).toBe("Neil & Jane\nNext step Friday")
  })

  it("removes null bytes and surrounding whitespace", () => {
    expect(normalizeMeetingText(" \u0000Meeting notes \r\n")).toBe("Meeting notes")
  })

  it("extracts and normalizes bracketed or bare email addresses", () => {
    expect(extractEmailAddress("Neil <NEIL@Savvo.app>")).toBe("neil@savvo.app")
    expect(extractEmailAddress("Reply to hello@example.com please")).toBe("hello@example.com")
    expect(extractEmailAddress("No address")).toBeNull()
  })
})
