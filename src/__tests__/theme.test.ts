import { describe, expect, it } from "vitest"
import { runInNewContext } from "node:vm"
import { THEME_BOOT_SCRIPT, isDarkTheme, storedTheme } from "@/lib/theme"

// Runs the real inline <head> script against a fake browser.
function bootDark(saved: string | null, systemDark: boolean): boolean {
  let dark = false
  runInNewContext(THEME_BOOT_SCRIPT, {
    localStorage: { getItem: () => saved },
    window: { matchMedia: () => ({ matches: systemDark }) },
    document: { documentElement: { classList: { toggle: (_c: string, on: boolean) => (dark = on) } } },
  })
  return dark
}

describe("theme", () => {
  it("lands everyone without a saved choice on light, even with a dark device", () => {
    expect(bootDark(null, true)).toBe(false)
    expect(storedTheme(null)).toBe("light")
  })

  it("keeps explicit dark and follows the device only when System was chosen", () => {
    expect(bootDark("dark", false)).toBe(true)
    expect(bootDark("light", true)).toBe(false)
    expect(bootDark("system", true)).toBe(true)
    expect(bootDark("system", false)).toBe(false)
  })

  it("the boot script and the Settings control always agree", () => {
    for (const saved of [null, "light", "dark", "system", "garbage"]) {
      for (const systemDark of [true, false]) {
        expect(bootDark(saved, systemDark)).toBe(isDarkTheme(storedTheme(saved), systemDark))
      }
    }
  })

  it("survives storage that throws (private mode)", () => {
    expect(() => runInNewContext(THEME_BOOT_SCRIPT, { localStorage: { getItem: () => { throw new Error("blocked") } }, window: {}, document: {} })).not.toThrow()
  })
})
