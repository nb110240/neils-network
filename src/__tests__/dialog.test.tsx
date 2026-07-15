import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"

describe("Dialog accessibility", () => {
  it("renders an explicitly named modal dialog", () => {
    const html = renderToStaticMarkup(
      <Dialog open>
        <DialogContent>
          <DialogTitle>Delete Account</DialogTitle>
        </DialogContent>
      </Dialog>
    )

    const labelledBy = html.match(/aria-labelledby="([^"]+)"/)?.[1]

    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(labelledBy).toBeTruthy()
    expect(html).toContain(`id="${labelledBy}"`)
    expect(html).toContain('aria-label="Close dialog"')
  })
})
