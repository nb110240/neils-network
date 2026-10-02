import { beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest } from "next/server"
import { renderToStaticMarkup } from "react-dom/server"

// The App Store and Google Play reviewers open the support URL logged out.
// /support is the signed-in contact form, so logged-out visits must land on
// the public /help page, never the login wall.
const h = vi.hoisted(() => ({ user: null as { id: string } | null }))

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: { getUser: vi.fn(async () => ({ data: { user: h.user } })) },
  })),
}))

import { proxy } from "@/proxy"
import HelpPage from "@/app/help/page"
import sitemap from "@/app/sitemap"

const visit = (path: string) => proxy(new NextRequest(`https://savvo.app${path}`))

describe("public help page for store reviewers", () => {
  beforeEach(() => {
    h.user = null
  })

  it("sends a logged-out visitor on /support to /help", async () => {
    const res = await visit("/support")
    expect(res.status).toBe(307)
    expect(res.headers.get("location")).toBe("https://savvo.app/help")
  })

  it("drops tracking params on the way, so the redirect is clean", async () => {
    const res = await visit("/support?utm_source=appstore")
    expect(res.headers.get("location")).toBe("https://savvo.app/help")
  })

  it("serves /help to logged-out visitors without a redirect", async () => {
    const res = await visit("/help")
    expect(res.headers.get("location")).toBeNull()
  })

  it("keeps the signed-in contact form at /support", async () => {
    h.user = { id: "user-1" }
    const res = await visit("/support")
    expect(res.headers.get("location")).toBeNull()
  })

  it("still sends logged-out visitors on other app pages to login", async () => {
    const res = await visit("/settings")
    expect(res.headers.get("location")).toBe("https://savvo.app/login")
  })

  it("answers what the stores require: contact, subscriptions, account deletion", () => {
    const html = renderToStaticMarkup(HelpPage())
    expect(html).toContain("mailto:neil@savvo.app")
    expect(html).toContain('id="delete-account"')
    expect(html).toContain("Delete Account")
    expect(html).toContain("Subscriptions")
    expect(html).toContain("Restore purchases")
  })

  it("is listed in the sitemap", () => {
    expect(sitemap().map((entry) => entry.url)).toContain("https://savvo.app/help")
  })
})
