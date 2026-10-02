import { describe, expect, it } from "vitest"
import { extractLinkedInUrl, normalizeLinkedInProfileUrl } from "@/lib/linkedin"

// Real-world inputs: iOS/desktop "Share Profile" links, QR payloads, and
// links pasted without a scheme.
const SHARE_URL =
  "https://www.linkedin.com/in/priya-raman-4b7a1b2c3?utm_source=share&utm_campaign=share_via&utm_content=profile&utm_medium=ios_app"

describe("normalizeLinkedInProfileUrl", () => {
  it.each([
    SHARE_URL,
    "www.linkedin.com/in/priya-raman-4b7a1b2c3?utm_source=share&utm_medium=member_desktop",
    "linkedin.com/in/priya-raman-4b7a1b2c3/",
    "https://www.linkedin.com/in/priya-raman-4b7a1b2c3",
  ])("accepts %s", (input) => {
    expect(normalizeLinkedInProfileUrl(input)?.url).toBe("https://www.linkedin.com/in/priya-raman-4b7a1b2c3")
  })

  it("accepts its own canonical output", () => {
    const canonical = normalizeLinkedInProfileUrl(SHARE_URL)!.url
    expect(normalizeLinkedInProfileUrl(canonical)?.url).toBe(canonical)
  })
})

describe("extractLinkedInUrl (scan page)", () => {
  it.each([
    [SHARE_URL, "https://www.linkedin.com/in/priya-raman-4b7a1b2c3"],
    ["www.linkedin.com/in/priya-raman-4b7a1b2c3?utm_source=share", "www.linkedin.com/in/priya-raman-4b7a1b2c3"],
    ["linkedin.com/in/jane-doe", "linkedin.com/in/jane-doe"],
    ["  uk.linkedin.com/in/oliver-bennett/ ", "uk.linkedin.com/in/oliver-bennett/"],
    ["https://lnkd.in/abc123", "https://lnkd.in/abc123"],
  ])("finds a profile link in %s", (input, expected) => {
    // Regression: scheme-less input was rejected before reaching the API.
    const found = extractLinkedInUrl(input)
    expect(found).toBe(expected)
    if (!found!.includes("lnkd.in")) expect(normalizeLinkedInProfileUrl(found!)).not.toBeNull()
  })

  it.each([
    "https://evil-linkedin.com/in/jane",
    "evil-linkedin.com/in/jane",
    "https://linkedin.com.evil.com/in/jane",
    "https://www.linkedin.com/company/acme",
    "not a url",
  ])("ignores %s", (input) => {
    expect(extractLinkedInUrl(input)).toBeNull()
  })
})
