import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import path from "node:path"

// Regression: --font-sans / --font-serif are declared inside "@theme inline",
// which Tailwind v4 inlines into utilities but never emits as real custom
// properties. Plain CSS that read var(--font-sans) therefore resolved to
// nothing and the whole app rendered in the browser default font instead of
// DM Sans / DM Serif Display. Base styles must reference the next/font
// variables (set on <body> by src/app/layout.tsx) directly.

const css = readFileSync(path.resolve(__dirname, "../app/globals.css"), "utf8")

function rule(selector: string): string {
  const start = css.indexOf(`${selector} {`)
  expect(start, `missing rule ${selector}`).toBeGreaterThanOrEqual(0)
  return css.slice(start, css.indexOf("}", start))
}

describe("brand fonts in globals.css", () => {
  it("theme font tokens are inline-only, so base styles cannot rely on them", () => {
    expect(css).toMatch(/@theme inline \{[\s\S]*--font-sans:/)
  })

  it("body uses DM Sans via the next/font variable", () => {
    const body = rule("body")
    expect(body).toContain("font-family: var(--font-dm-sans)")
    expect(body).not.toContain("var(--font-sans)")
  })

  it("headings use DM Serif Display via the next/font variable", () => {
    const headings = rule("h1, h2, h3, h4, h5, h6")
    expect(headings).toContain("font-family: var(--font-dm-serif)")
    expect(headings).not.toContain("var(--font-serif)")
  })

  it("never fakes a bold DM Serif Display, which only has one weight", () => {
    expect(rule("h1, h2, h3, h4, h5, h6")).toContain("font-synthesis-weight: none")
  })

  it("keeps heading defaults in @layer base so utilities like font-sans and tracking-* can override them", () => {
    expect(css).toMatch(/@layer base \{\s*h1, h2, h3, h4, h5, h6 \{/)
  })

  it("renders uppercase eyebrow headings in the sans, not serif capitals", () => {
    expect(rule(":is(h1, h2, h3, h4, h5, h6).uppercase")).toContain("font-family: var(--font-dm-sans)")
  })
})
