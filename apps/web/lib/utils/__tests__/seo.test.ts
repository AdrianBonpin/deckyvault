import { describe, it, expect } from "vitest"
import { smartTruncate, buildBreadcrumbList, BreadcrumbSegment } from "@/lib/utils/seo"

describe("smartTruncate", () => {
  it("returns full text when shorter than maxLen", () => {
    expect(smartTruncate("Short text", 100)).toBe("Short text")
  })

  it("truncates at word boundary and appends ellipsis", () => {
    const result = smartTruncate("This is a longer sentence that should be truncated properly.", 30)
    expect(result).toBe("This is a longer sentence...")
    expect(result.length).toBeLessThanOrEqual(30 + 3) // + "..."
  })

  it("handles text with no spaces gracefully", () => {
    const result = smartTruncate("SuperLongWordThatHasNoSpaces", 10)
    expect(result).toBe("SuperLongW...")
  })

  it("does not append ellipsis when text fits exactly", () => {
    expect(smartTruncate("abc", 3)).toBe("abc")
  })

  it("handles empty string", () => {
    expect(smartTruncate("", 10)).toBe("")
  })
})

describe("buildBreadcrumbList", () => {
  it("builds a valid BreadcrumbList from segments", () => {
    const segments = [
      { name: "Home", url: "https://deckyvault.xyz" },
      { name: "Games", url: "https://deckyvault.xyz/games" },
      { name: "Elden Ring", url: "https://deckyvault.xyz/game/123" },
    ]
    const result = buildBreadcrumbList(segments)
    expect(result["@context"]).toBe("https://schema.org")
    expect(result["@type"]).toBe("BreadcrumbList")
    expect(result.itemListElement).toHaveLength(3)
    expect(result.itemListElement[0]).toEqual({
      "@type": "ListItem",
      position: 1,
      name: "Home",
      item: "https://deckyvault.xyz",
    })
  })

  it("handles a single segment", () => {
    const segments = [{ name: "Home", url: "https://deckyvault.xyz" }]
    const result = buildBreadcrumbList(segments)
    expect(result.itemListElement).toHaveLength(1)
  })
})