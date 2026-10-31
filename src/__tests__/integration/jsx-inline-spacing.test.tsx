import { describe, it, expect } from "vitest"
import fs from "fs"
import path from "path"
import ts from "typescript"
import { renderToStaticMarkup } from "react-dom/server"
import type { ComponentType } from "react"

// Regression: savvo.app rendered "Wave 3: the reach list.The name-brand funds",
// "seed fundraising guidenotes" and "12contacts · Click a node".
//
// The Next.js compiler drops the leading space of a JSX text run when the run
// spans more than one line AND contains an HTML entity (&apos; &quot; &amp;
// &middot; ...). It happens after any element or {expression}, not only
// </strong>. Single-line runs and typographic characters (’ ·) are unaffected.
// Separately, plain JSX always drops whitespace at a line break, so an inline
// element that ends a line mid-sentence needs an explicit {" "}.

const SRC_DIR = path.resolve(__dirname, "../..")
const BLOG_DIR = path.join(SRC_DIR, "app/blog")
const ENTITY = /&(#\d+|#x[0-9a-f]+|[a-z]+\d*);/i
const INLINE = /^(a|Link|strong|em|b|i|code|span|abbr|mark|kbd)$/

function tsxFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const full = path.join(dir, d.name)
    if (d.isDirectory()) return d.name === "__tests__" ? [] : tsxFiles(full)
    return d.name.endsWith(".tsx") ? [full] : []
  })
}

function findDroppedSpaces(file: string): string[] {
  const src = fs.readFileSync(file, "utf8")
  const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const out: string[] = []
  const where = (n: ts.Node) =>
    `${path.relative(SRC_DIR, file)}:${sf.getLineAndCharacterOfPosition(n.getStart()).line + 1}`

  const visit = (n: ts.Node) => {
    if (ts.isJsxText(n)) {
      const raw = src.slice(n.pos, n.end)
      if (/^[ \t]+\S/.test(raw) && raw.includes("\n") && ENTITY.test(raw)) {
        out.push(`${where(n)} leading space dropped: ${JSON.stringify(raw.trim().slice(0, 40))}`)
      }
      const siblings = ts.isJsxElement(n.parent) || ts.isJsxFragment(n.parent) ? [...n.parent.children] : []
      const prev = siblings[siblings.indexOf(n) - 1]
      if (
        prev &&
        ts.isJsxElement(prev) &&
        INLINE.test(prev.openingElement.tagName.getText()) &&
        /^[ \t]*\n\s*[A-Za-z0-9&("'“‘]/.test(raw)
      ) {
        out.push(`${where(n)} line break after inline tag: ${JSON.stringify(raw.trim().slice(0, 40))}`)
      }
    }
    ts.forEachChild(n, visit)
  }
  visit(sf)
  return out
}

describe("JSX text keeps the space after inline elements", () => {
  it("no TSX file under src has a run the compiler would glue to the previous element", () => {
    const files = tsxFiles(SRC_DIR)
    expect(files.length).toBeGreaterThan(50)
    expect(files.flatMap(findDroppedSpaces)).toEqual([])
  })

  const slugs = fs
    .readdirSync(BLOG_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(BLOG_DIR, d.name, "page.tsx")))
    .map((d) => d.name)

  it("finds the blog posts", () => {
    expect(slugs.length).toBeGreaterThanOrEqual(3)
  })

  for (const slug of slugs) {
    it(`${slug}: rendered HTML has no </strong> or </a> glued to a word`, async () => {
      const mod = (await import(`../../app/blog/${slug}/page.tsx`)) as {
        default: ComponentType
      }
      const html = renderToStaticMarkup(<mod.default />)
      expect(html.match(/<\/(strong|a)>[A-Za-z][^<]{0,30}/g) ?? []).toEqual([])
    })
  }
})
