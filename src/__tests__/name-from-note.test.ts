import { describe, expect, it } from "vitest"
import { suggestNameFromNote } from "@/lib/name-from-note"

describe("suggestNameFromNote", () => {
  it.each([
    ["Priya Raman\nPartner at Lightspeed", "Priya Raman"],
    ["Met Jane Doe, partner at Acme", "Jane Doe"],
    ["Coffee with José García at Sequoia", "José García"],
    ["Sarah O'Brien - wants the deck", "Sarah O'Brien"],
    ["Mary-Kate Olsen. Seed investor.", "Mary-Kate Olsen"],
  ])("suggests a name from %j", (note, expected) => {
    expect(suggestNameFromNote(note)).toBe(expected)
  })

  it.each([
    "great chat at the demo day about seed rounds",
    "Investor Meeting Notes",
    "Coffee Chat",
    "jane doe lowercase",
    "Priya",
    "",
    "A Very Long Line That Goes On And On With Capitalized Words",
  ])("returns null for %j", (note) => {
    expect(suggestNameFromNote(note)).toBeNull()
  })
})
