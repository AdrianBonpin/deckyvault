import { describe, it, expect } from "vitest"
import { generateSlug } from "@/lib/utils/slug"

describe("generateSlug", () => {
  it("converts a simple title to lowercase hyphenated slug", () => {
    expect(generateSlug("The Witcher 3")).toBe("the-witcher-3")
  })
  it("replaces special characters with hyphens", () => {
    expect(generateSlug("Hades II: The Sequel")).toBe("hades-ii-the-sequel")
  })
  it("collapses multiple consecutive hyphens", () => {
    expect(generateSlug("Game!!!  --  Test")).toBe("game-test")
  })
  it("trims leading and trailing hyphens", () => {
    expect(generateSlug("  -- My Game --  ")).toBe("my-game")
  })
  it("truncates to 80 characters", () => {
    const longTitle = "A".repeat(100)
    expect(generateSlug(longTitle).length).toBeLessThanOrEqual(80)
  })
  it("does not leave trailing hyphen after truncation", () => {
    const title = "A".repeat(79) + " -"
    expect(generateSlug(title)).not.toMatch(/-$/)
  })
  it("handles empty string", () => {
    expect(generateSlug("")).toBe("")
  })
})