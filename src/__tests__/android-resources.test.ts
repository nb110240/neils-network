import { describe, it, expect } from "vitest"
import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"

// Static checks on the Android project that otherwise only surface in a
// Gradle build or an on-device instrumented test run.

const root = path.resolve(__dirname, "../..")
const appDir = path.join(root, "android/app")
const resDir = path.join(appDir, "src/main/res")

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

const xmlFiles = [
  ...walk(resDir).filter((f) => f.endsWith(".xml")),
  path.join(appDir, "src/main/AndroidManifest.xml"),
]

describe("Android resources", () => {
  it("defines every @color referenced by app XML in the app's own values*/colors*.xml", () => {
    const referenced = new Set<string>()
    for (const file of xmlFiles) {
      for (const m of readFileSync(file, "utf8").matchAll(/@color\/([A-Za-z0-9_.]+)/g)) {
        referenced.add(m[1])
      }
    }

    const defined = new Set<string>()
    const colorFiles = xmlFiles.filter((f) => {
      const rel = path.relative(resDir, f).split(path.sep)
      return rel.length === 2 && rel[0].startsWith("values") && rel[1].startsWith("colors")
    })
    for (const file of colorFiles) {
      for (const m of readFileSync(file, "utf8").matchAll(/<color\s+[^>]*name="([^"]+)"/g)) {
        defined.add(m[1])
      }
    }

    expect(referenced.size).toBeGreaterThan(0)
    const missing = [...referenced].filter((name) => !defined.has(name))
    expect(missing).toEqual([])
  })

  it("uses the Savvo copper palette for the AppTheme colors", () => {
    const colors = readFileSync(path.join(resDir, "values/colors.xml"), "utf8")
    expect(colors).toMatch(/name="colorPrimary">#C2410C</i)
    expect(colors).toMatch(/name="colorPrimaryDark">#9A3412</i)
    expect(colors).toMatch(/name="colorAccent">#EA580C</i)
  })
})

describe("Android instrumented test", () => {
  it("expects the same package name as the app's applicationId", () => {
    const gradle = readFileSync(path.join(appDir, "build.gradle"), "utf8")
    const applicationId = gradle.match(/applicationId\s+"([^"]+)"/)?.[1]
    expect(applicationId).toBe("app.savvo")

    const testSrc = readFileSync(
      path.join(
        appDir,
        "src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java",
      ),
      "utf8",
    )
    const expected = testSrc.match(/assertEquals\("([^"]+)",\s*appContext\.getPackageName\(\)\)/)?.[1]
    expect(expected).toBe(applicationId)
  })
})
