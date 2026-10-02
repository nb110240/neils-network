import { describe, expect, it } from "vitest"
import { ilikeAnyFilter, quotedContainsPattern } from "@/lib/ilike-filter"

describe("ilikeAnyFilter", () => {
  it("quotes the value so commas and parentheses can't split the filter", () => {
    // Regression: backslash-escaped values ("Acme\, Inc") made PostgREST
    // fail to parse the .or() tree, so these searches errored.
    expect(ilikeAnyFilter(["name", "company"], "Acme, Inc")).toBe('name.ilike."%Acme, Inc%",company.ilike."%Acme, Inc%"')
    expect(quotedContainsPattern("J. (Jay)")).toBe('"%J. (Jay)%"')
  })

  it("escapes LIKE wildcards and quote characters", () => {
    expect(quotedContainsPattern("100%")).toBe('"%100\\\\%%"')
    expect(quotedContainsPattern("a_b")).toBe('"%a\\\\_b%"')
    expect(quotedContainsPattern('say "hi"')).toBe('"%say \\"hi\\"%"')
    expect(quotedContainsPattern("back\\slash")).toBe('"%back\\\\\\\\slash%"')
  })
})
