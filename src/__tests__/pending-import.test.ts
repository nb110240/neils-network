import { readFileSync } from "node:fs"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  clearPendingImport,
  countCsvDataRows,
  isUneditedTemplate,
  readPendingImport,
  resumePendingImport,
  savePendingImport,
} from "@/lib/pending-import"

function memoryStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => void store.set(k, v),
    removeItem: (k: string) => void store.delete(k),
  }
}

const template = readFileSync(join(process.cwd(), "public/templates/investor-pipeline-tracker.csv"), "utf8")

describe("tracker CSV checks", () => {
  it("counts data rows, ignoring blank and comma-only lines", () => {
    expect(countCsvDataRows("Investor Name,Firm\n")).toBe(0)
    expect(countCsvDataRows("Investor Name,Firm\r\nJane,Acme\r\n,,\r\n\r\nBob,Beta\r\n")).toBe(2)
  })

  it("counts records, not lines, when a quoted field holds a newline", () => {
    expect(countCsvDataRows('"Investor\nName",Firm\n')).toBe(0)
    expect(countCsvDataRows('Investor Name,Notes\nJane,"met at\nthe summit"\n')).toBe(1)
  })

  it("recognizes the unedited template but not a filled-in one", () => {
    expect(isUneditedTemplate(template)).toBe(true)
    const [header, ...rows] = template.trim().split("\n")
    const filled = [header, ...rows, "Real Investor,Real Fund,Partner,,,,First Meeting,,,,"].join("\n")
    expect(isUneditedTemplate(filled)).toBe(false)
    expect(isUneditedTemplate(`${header}\n`)).toBe(false)
  })
})

describe("pending import storage", () => {
  beforeEach(() => vi.stubGlobal("localStorage", memoryStorage()))
  afterEach(() => vi.unstubAllGlobals())

  it("round-trips the file and clears it", () => {
    expect(savePendingImport("tracker.csv", "a,b\n1,2")).toBe(true)
    expect(readPendingImport()).toMatchObject({ name: "tracker.csv", text: "a,b\n1,2" })
    clearPendingImport()
    expect(readPendingImport()).toBeNull()
  })

  it("expires after 7 days and drops corrupt entries", () => {
    savePendingImport("old.csv", "a\n1")
    expect(readPendingImport(Date.now() + 8 * 24 * 60 * 60 * 1000)).toBeNull()
    expect(readPendingImport()).toBeNull()
    localStorage.setItem("savvo-pending-import", "{not json")
    expect(readPendingImport()).toBeNull()
    localStorage.setItem("savvo-pending-import", JSON.stringify({ name: 1 }))
    expect(readPendingImport()).toBeNull()
  })

  it("drops the older pending file when saving a replacement fails", () => {
    const storage = memoryStorage()
    vi.stubGlobal("localStorage", storage)
    expect(savePendingImport("old.csv", "a\n1")).toBe(true)
    storage.setItem = () => { throw new Error("QuotaExceededError") }
    expect(savePendingImport("new.csv", "a\n2")).toBe(false)
    expect(readPendingImport()).toBeNull()
  })

  it("keeps the pending file until the server has answered for it", async () => {
    savePendingImport("t.csv", "a\n1")
    const pending = readPendingImport()!
    let loaded: File | null = null
    await resumePendingImport(pending, async (file) => { loaded = file; return false })
    expect(loaded!.name).toBe("t.csv")
    expect(await loaded!.text()).toBe("a\n1")
    expect(readPendingImport()).not.toBeNull()
    await resumePendingImport(pending, async () => true)
    expect(readPendingImport()).toBeNull()
  })

  it("reports failure instead of throwing when storage is blocked", () => {
    vi.stubGlobal("localStorage", {
      getItem: () => { throw new Error("blocked") },
      setItem: () => { throw new Error("blocked") },
      removeItem: () => { throw new Error("blocked") },
    })
    expect(savePendingImport("t.csv", "a\n1")).toBe(false)
    expect(readPendingImport()).toBeNull()
    expect(() => clearPendingImport()).not.toThrow()
  })
})
