import { describe, it, expect } from "vitest"

// Mirror the LinkedIn slug extraction from dedup.ts
function extractLinkedInSlug(url: string | null): string | null {
  if (!url) return null
  const match = url.match(/linkedin\.com\/in\/([\w-]+)/i)
  return match ? match[1].toLowerCase() : null
}

describe("Contact deduplication", () => {
  describe("LinkedIn URL matching", () => {
    it("detects same profile from different URL formats", () => {
      const slug1 = extractLinkedInSlug("https://linkedin.com/in/johndoe")
      const slug2 = extractLinkedInSlug("https://www.linkedin.com/in/johndoe?trk=share")
      expect(slug1).toBe(slug2)
      expect(slug1).toBe("johndoe")
    })

    it("detects same profile with trailing slash", () => {
      const slug1 = extractLinkedInSlug("https://linkedin.com/in/johndoe")
      const slug2 = extractLinkedInSlug("https://linkedin.com/in/johndoe/")
      expect(slug1).toBe(slug2)
    })

    it("returns null for non-LinkedIn URLs", () => {
      expect(extractLinkedInSlug("https://twitter.com/johndoe")).toBeNull()
      expect(extractLinkedInSlug(null)).toBeNull()
      expect(extractLinkedInSlug("")).toBeNull()
    })

    it("handles company LinkedIn URLs (should not match /in/)", () => {
      expect(extractLinkedInSlug("https://linkedin.com/company/google")).toBeNull()
    })
  })
})
