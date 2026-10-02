import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { dismissPushPrompt, PROMPT_SNOOZE_MS, pushPromptDismissedRecently, safeNotificationPath } from "@/lib/native/push"
import { isAppleCancel, sha256Hex } from "@/lib/native/apple-auth"

describe("safeNotificationPath", () => {
  it("opens only same-origin app paths from a notification", () => {
    expect(safeNotificationPath("/contact/abc")).toBe("/contact/abc")
    expect(safeNotificationPath("/inbox?review=r1")).toBe("/inbox?review=r1")
    for (const bad of ["https://evil.example", "//evil.example/x", "/\\evil.example", "javascript:alert(1)", "", null, 42, undefined]) {
      expect(safeNotificationPath(bad)).toBeNull()
    }
  })
})

describe("push prompt snooze", () => {
  beforeEach(() => {
    const store = new Map<string, string>()
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    })
  })
  afterEach(() => vi.unstubAllGlobals())

  it("waits two weeks after 'Not now' before asking again", () => {
    const now = 1_800_000_000_000
    expect(pushPromptDismissedRecently(now)).toBe(false)
    dismissPushPrompt(now)
    expect(pushPromptDismissedRecently(now + PROMPT_SNOOZE_MS - 1)).toBe(true)
    expect(pushPromptDismissedRecently(now + PROMPT_SNOOZE_MS + 1)).toBe(false)
  })
})

describe("Sign in with Apple helpers", () => {
  it("hashes the nonce as lowercase SHA-256 hex, the form Apple and Supabase compare", async () => {
    expect(await sha256Hex("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad")
  })

  it("treats a dismissed Apple sheet as a cancel, not an error", () => {
    expect(isAppleCancel({ code: "1001", message: "The operation couldn't be completed." })).toBe(true)
    expect(isAppleCancel(new Error("The user canceled the authorization attempt"))).toBe(true)
    expect(isAppleCancel(new Error("Network unavailable"))).toBe(false)
  })
})
