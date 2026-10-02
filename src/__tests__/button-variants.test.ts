import { describe, expect, it } from "vitest"
import { existsSync, readFileSync, readdirSync, statSync } from "fs"
import path from "path"
import { buttonVariants } from "@/components/ui/button"

describe("copper button variant", () => {
  it("pins the gradient, white text and hover classes", () => {
    const classes = buttonVariants({ variant: "copper" }).split(/\s+/)
    for (const cls of [
      "bg-gradient-to-r",
      "from-[var(--copper)]",
      "to-[var(--copper-light)]",
      "text-white",
      "border-0",
      "hover:opacity-90",
    ]) {
      expect(classes).toContain(cls)
    }
    // Regression: the default variant's text-primary-foreground is #1c1917 in
    // dark mode, which made copper CTAs unreadable.
    expect(classes).not.toContain("text-primary-foreground")
  })

  it("leaves the default variant untouched", () => {
    expect(buttonVariants()).toContain("text-primary-foreground")
  })
})

// Files owned by parallel work at the time of migration. Remove once migrated.
const PENDING = new Set([
  "src/app/(dashboard)/dashboard/page.tsx",
  "src/components/next-moves.tsx",
])
const GRADIENT = "from-[var(--copper)] to-[var(--copper-light)]"
const DECORATIVE = /\b(h-1|absolute|h-full)\b/

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry !== "__tests__") walk(full, out)
    } else if (full.endsWith(".tsx")) {
      out.push(full)
    }
  }
  return out
}

describe("copper gradient CTAs", () => {
  it("never rely on the default foreground color", () => {
    const root = path.resolve(__dirname, "../..")
    const offenders: string[] = []
    for (const file of walk(path.join(root, "src"))) {
      const rel = path.relative(root, file).split(path.sep).join("/")
      if (PENDING.has(rel)) continue
      readFileSync(file, "utf8")
        .split("\n")
        .forEach((line, i) => {
          if (line.includes(GRADIENT) && !line.includes("text-white") && !DECORATIVE.test(line)) {
            offenders.push(`${rel}:${i + 1}`)
          }
        })
    }
    expect(offenders).toEqual([])
  })

  it("only allowlists files that still exist", () => {
    // A renamed or deleted file must leave PENDING too, so the allowlist
    // cannot silently outlive the code it excuses.
    const root = path.resolve(__dirname, "../..")
    const missing = [...PENDING].filter((rel) => !existsSync(path.join(root, rel)))
    expect(missing).toEqual([])
  })
})
