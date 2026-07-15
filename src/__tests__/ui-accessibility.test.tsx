import { readFileSync } from "node:fs"
import { join } from "node:path"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { CardTitle } from "@/components/ui/card"
import { ComparisonTable } from "@/app/vs/shared"

describe("shared UI accessibility", () => {
  it("uses a level-two heading for card sections", () => {
    const html = renderToStaticMarkup(<CardTitle>Recent contacts</CardTitle>)
    expect(html).toBe('<h2 class="font-semibold leading-none tracking-tight">Recent contacts</h2>')
  })

  it("makes horizontally scrollable comparison tables keyboard reachable", () => {
    const html = renderToStaticMarkup(
      <ComparisonTable
        competitor="Example CRM"
        rows={[{ dimension: "Follow-ups", them: "Manual", savvo: "Automatic" }]}
      />
    )

    expect(html).toContain('role="region"')
    expect(html).toContain('aria-label="Example CRM and Savvo feature comparison"')
    expect(html).toContain('tabindex="0"')
  })

  it("keeps mobile navigation modal, keyboard-contained, and dismissible", () => {
    const source = readFileSync(join(process.cwd(), "src/components/nav-header.tsx"), "utf8")

    expect(source).toContain('aria-modal="true"')
    expect(source).toContain('aria-current={isActive ? "page" : undefined}')
    expect(source).toContain('event.key === "Escape"')
    expect(source).toContain('document.body.style.overflow = "hidden"')
    expect(source).toContain('event.shiftKey && document.activeElement === first')
  })

  it("keeps Team-plan UI on the paid feature path", () => {
    const dashboardSource = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/dashboard/page.tsx"),
      "utf8"
    )
    const settingsSource = readFileSync(
      join(process.cwd(), "src/app/(dashboard)/settings/page.tsx"),
      "utf8"
    )

    expect(dashboardSource).toContain("planLimits.canCalendarSync")
    expect(dashboardSource).toContain("planLimits.canImport")
    expect(settingsSource).toContain('plan === "pro" || plan === "team"')
    expect(settingsSource).toContain('plan === "team" ? "Team"')
  })

  it("keeps asynchronous settings controls programmatically named", () => {
    const mfaSource = readFileSync(join(process.cwd(), "src/components/mfa-settings.tsx"), "utf8")
    const themeSource = readFileSync(join(process.cwd(), "src/components/theme-selector.tsx"), "utf8")
    const deletedSource = readFileSync(join(process.cwd(), "src/components/recently-deleted.tsx"), "utf8")

    expect(mfaSource).toContain('htmlFor="mfa-code"')
    expect(mfaSource).toContain('htmlFor="mfa-device-name"')
    expect(themeSource).toContain('role="group" aria-label="Theme"')
    expect(themeSource).toContain('aria-pressed={theme === value}')
    expect(deletedSource).toContain('aria-expanded={isExpanded}')
    expect(deletedSource).toContain('aria-controls="recently-deleted-content"')
  })
})
