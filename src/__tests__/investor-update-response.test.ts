import { describe, it, expect } from "vitest"
import { readInvestorUpdateResponse } from "@/lib/investor-update-response"

const html = (status: number) => new Response("<html>Bad Gateway</html>", { status, headers: { "content-type": "text/html" } })
const json = (status: number, body: unknown) => Response.json(body, { status })

describe("readInvestorUpdateResponse", () => {
  it("routes a non-JSON 403 to the upgrade state", async () => {
    expect(await readInvestorUpdateResponse(html(403))).toEqual({ kind: "upgrade" })
  })

  it("routes a JSON 403 to the upgrade state", async () => {
    expect(await readInvestorUpdateResponse(json(403, { error: "Pro required" }))).toEqual({ kind: "upgrade" })
  })

  it("returns an empty message (not a SyntaxError) for a non-JSON failure", async () => {
    expect(await readInvestorUpdateResponse(html(502))).toEqual({ kind: "error", message: "" })
  })

  it("surfaces the API error message for a JSON failure", async () => {
    expect(await readInvestorUpdateResponse(json(500, { error: "Could not load your pipeline" }))).toEqual({
      kind: "error",
      message: "Could not load your pipeline",
    })
  })

  it("returns the body on success", async () => {
    const result = await readInvestorUpdateResponse(json(200, { draft: "TL;DR", fallback: false }))
    expect(result).toEqual({ kind: "ok", body: { draft: "TL;DR", fallback: false } })
  })
})
