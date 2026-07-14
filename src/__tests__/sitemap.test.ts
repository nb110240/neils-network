import { describe, it, expect } from "vitest"
import sitemap from "@/app/sitemap"

// ─── Sitemap regression test ───
// The sitemap replaced a hand-maintained public/sitemap.xml. Pin the URL set
// so marketing pages don't silently drop out and /login (deliberately
// excluded — see src/app/sitemap.ts) doesn't sneak back in.
describe("sitemap", () => {
  const entries = sitemap()
  const urls = entries.map((entry) => entry.url)

  it("includes every public marketing page", () => {
    const expected = [
      "https://savvo.app/",
      "https://savvo.app/pricing",
      "https://savvo.app/from-spreadsheet",
      "https://savvo.app/changelog",
      "https://savvo.app/install",
      "https://savvo.app/privacy",
      "https://savvo.app/terms",
    ]
    for (const url of expected) {
      expect(urls).toContain(url)
    }
  })

  it("does not include /login", () => {
    expect(urls).not.toContain("https://savvo.app/login")
    expect(urls.some((url) => url.includes("/login"))).toBe(false)
  })

  it("sets lastModified on every entry", () => {
    for (const entry of entries) {
      expect(entry.lastModified).toBeInstanceOf(Date)
    }
  })
})
