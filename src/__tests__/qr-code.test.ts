import { describe, expect, it } from "vitest"
import { toQrImageSrc } from "@/lib/qr-code"

describe("toQrImageSrc", () => {
  it("encodes Supabase's raw SVG data URI payload", () => {
    const source = 'data:image/svg+xml;utf-8,<svg fill="#000"><path /></svg>'

    const result = toQrImageSrc(source)

    expect(result).toContain("%23")
    expect(result).not.toContain('fill="#000"')
    expect(decodeURIComponent(result.split(",")[1])).toBe('<svg fill="#000"><path /></svg>')
  })

  it("encodes a raw SVG response", () => {
    expect(toQrImageSrc("<svg><path /></svg>"))
      .toBe("data:image/svg+xml;utf-8,%3Csvg%3E%3Cpath%20%2F%3E%3C%2Fsvg%3E")
  })

  it("leaves an already encoded SVG data URI unchanged", () => {
    const source = "data:image/svg+xml;utf-8,%3Csvg%3E%3C%2Fsvg%3E"

    expect(toQrImageSrc(source)).toBe(source)
  })
})
