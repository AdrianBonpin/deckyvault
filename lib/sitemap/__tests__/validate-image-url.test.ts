import { describe, it, expect } from "vitest"
import { validateImageUrl } from "@/lib/sitemap/validate-image-url"

describe("validateImageUrl", () => {
  it("returns null for null input", () => {
    expect(validateImageUrl(null)).toBeNull()
  })

  it("returns null for undefined input", () => {
    expect(validateImageUrl(undefined)).toBeNull()
  })

  it("returns null for empty string", () => {
    expect(validateImageUrl("")).toBeNull()
  })

  it("returns null for whitespace-only string", () => {
    expect(validateImageUrl("   ")).toBeNull()
  })

  it("returns null for http:// URL", () => {
    expect(validateImageUrl("http://example.com/image.png")).toBeNull()
  })

  it("returns null for relative URL", () => {
    expect(validateImageUrl("/images/hero.png")).toBeNull()
  })

  it("returns null for protocol-less URL", () => {
    expect(validateImageUrl("example.com/image.png")).toBeNull()
  })

  it("returns null for URL exceeding 2048 characters", () => {
    const longUrl = "https://example.com/" + "a".repeat(2040)
    expect(longUrl.length).toBeGreaterThan(2048)
    expect(validateImageUrl(longUrl)).toBeNull()
  })

  it("returns the same URL for a valid HTTPS URL", () => {
    const url = "https://example.com/image.png"
    expect(validateImageUrl(url)).toBe(url)
  })

  it("trims whitespace from a valid URL", () => {
    const url = "https://example.com/image.png"
    expect(validateImageUrl(`  ${url}  `)).toBe(url)
  })

  it("returns URL when exactly 2048 characters", () => {
    const url = "https://example.com/" + "a".repeat(2048 - "https://example.com/".length)
    expect(url.length).toBe(2048)
    expect(validateImageUrl(url)).toBe(url)
  })

  it("returns null for URL at 2049 characters", () => {
    const url = "https://example.com/" + "a".repeat(2049 - "https://example.com/".length)
    expect(url.length).toBe(2049)
    expect(validateImageUrl(url)).toBeNull()
  })

  it("returns realistic Steam capsule and SteamGridDB URLs unchanged", () => {
    const steamCapsule =
      "https://cdn.akamai.steamstatic.com/steam/apps/1245620/capsule_616x353.jpg"
    const steamGridDb =
      "https://www.steamgriddb.com/api/v2/images/grid/12345-abcdef.png"
    expect(validateImageUrl(steamCapsule)).toBe(steamCapsule)
    expect(validateImageUrl(steamGridDb)).toBe(steamGridDb)
  })
})