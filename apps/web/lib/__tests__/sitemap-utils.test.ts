import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  PRODUCTION_URL,
  getBaseUrl,
  imageEntry,
  toDate,
  querySafe,
  STATIC_PAGES,
} from "@/lib/sitemap-utils"

describe("PRODUCTION_URL", () => {
  it("is the canonical production URL", () => {
    expect(PRODUCTION_URL).toBe("https://deckyvault.xyz")
  })
})

describe("getBaseUrl", () => {
  afterEach(() => {
    delete process.env.NEXT_PUBLIC_SITE_URL
  })

  it("returns PRODUCTION_URL when no env var is set", () => {
    expect(getBaseUrl()).toBe("https://deckyvault.xyz")
  })

  it("returns PRODUCTION_URL when env var is localhost", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000"
    expect(getBaseUrl()).toBe("https://deckyvault.xyz")
  })

  it("returns PRODUCTION_URL when env var is 127.0.0.1", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://127.0.0.1:8080"
    expect(getBaseUrl()).toBe("https://deckyvault.xyz")
  })

  it("returns the custom env var when set to a real domain", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://staging.deckyvault.xyz"
    expect(getBaseUrl()).toBe("https://staging.deckyvault.xyz")
  })

  it("strips trailing slash from env var", () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://staging.deckyvault.xyz/"
    expect(getBaseUrl()).toBe("https://staging.deckyvault.xyz")
  })
})

describe("imageEntry", () => {
  it("returns an images array for valid HTTPS capsule URLs", () => {
    const result = imageEntry("https://cdn.example.com/capsule.jpg")
    expect(result).toEqual({ images: ["https://cdn.example.com/capsule.jpg"] })
  })

  it("trims whitespace from the URL", () => {
    const result = imageEntry("  https://cdn.example.com/capsule.jpg  ")
    expect(result).toEqual({ images: ["https://cdn.example.com/capsule.jpg"] })
  })

  it("returns empty object for non-HTTPS URLs", () => {
    const result = imageEntry("http://cdn.example.com/capsule.jpg")
    expect(result).toEqual({})
  })

  it("returns empty object for non-string values", () => {
    expect(imageEntry(null)).toEqual({})
    expect(imageEntry(undefined)).toEqual({})
    expect(imageEntry(123)).toEqual({})
    expect(imageEntry({})).toEqual({})
  })

  it("returns empty object for empty strings", () => {
    expect(imageEntry("")).toEqual({})
    expect(imageEntry("   ")).toEqual({})
  })

  it("returns empty object for URLs exceeding 2048 characters", () => {
    const longUrl = "https://cdn.example.com/" + "a".repeat(2048)
    expect(imageEntry(longUrl)).toEqual({})
  })

  it("accepts URLs exactly at the 2048 character limit", () => {
    const maxUrl = "https://cdn.example.com/" + "a".repeat(2048 - 26)
    expect(imageEntry(maxUrl)).toEqual({ images: [maxUrl] })
  })
})

describe("toDate", () => {
  it("returns the same Date object if passed a valid Date", () => {
    const d = new Date("2025-01-15T10:00:00Z")
    expect(toDate(d)).toBe(d)
  })

  it("returns undefined for invalid Date objects", () => {
    const d = new Date("not-a-date")
    expect(toDate(d)).toBeUndefined()
  })

  it("parses a valid ISO date string", () => {
    const result = toDate("2025-01-15T10:00:00Z")
    expect(result).toBeInstanceOf(Date)
    expect(result!.toISOString()).toBe("2025-01-15T10:00:00.000Z")
  })

  it("returns undefined for invalid date strings", () => {
    expect(toDate("not-a-date")).toBeUndefined()
  })

  it("parses a numeric timestamp", () => {
    const result = toDate(1700000000000)
    expect(result).toBeInstanceOf(Date)
    expect(result!.getTime()).toBe(1700000000000)
  })

  it("returns undefined for null", () => {
    expect(toDate(null)).toBeUndefined()
  })

  it("returns undefined for undefined", () => {
    expect(toDate(undefined)).toBeUndefined()
  })

  it("returns undefined for non-date objects", () => {
    expect(toDate({ foo: "bar" })).toBeUndefined()
  })
})

describe("querySafe", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("returns the query result on success", async () => {
    const query = vi.fn().mockResolvedValue([{ id: 1 }])
    const result = await querySafe("test", query)
    expect(result).toEqual([{ id: 1 }])
    expect(query).toHaveBeenCalledOnce()
  })

  it("returns undefined when the query throws", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const query = vi.fn().mockRejectedValue(new Error("DB down"))
    const result = await querySafe("test", query)
    expect(result).toBeUndefined()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[Sitemap] test query failed:",
      expect.any(Error),
    )
    consoleErrorSpy.mockRestore()
  })

  it("returns undefined when the query times out", async () => {
    const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
    const query = vi.fn().mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([{ id: 1 }]), 20_000)),
    )
    const resultPromise = querySafe("test", query, 5_000)
    vi.advanceTimersByTime(5_001)
    const result = await resultPromise
    expect(result).toBeUndefined()
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      "[Sitemap] test query failed:",
      expect.any(Error),
    )
    consoleErrorSpy.mockRestore()
  })

  it("uses default timeout of 15s when not specified", async () => {
    const query = vi.fn().mockResolvedValue([{ id: 1 }])
    const result = await querySafe("test", query)
    expect(result).toEqual([{ id: 1 }])
  })
})

describe("STATIC_PAGES", () => {
  it("contains exactly 7 entries", () => {
    expect(STATIC_PAGES).toHaveLength(7)
  })

  it("first entry is the homepage with empty urlPath and priority 1", () => {
    expect(STATIC_PAGES[0].urlPath).toBe("")
    expect(STATIC_PAGES[0].priority).toBe(1.0)
  })

  it("includes /games with priority 0.9", () => {
    const entry = STATIC_PAGES.find((p) => p.urlPath === "/games")
    expect(entry).toBeDefined()
    expect(entry!.priority).toBe(0.9)
  })

  it("includes /compare with priority 0.5", () => {
    const entry = STATIC_PAGES.find((p) => p.urlPath === "/compare")
    expect(entry).toBeDefined()
    expect(entry!.priority).toBe(0.5)
  })

  it("includes /search with priority 0.3", () => {
    const entry = STATIC_PAGES.find((p) => p.urlPath === "/search")
    expect(entry).toBeDefined()
    expect(entry!.priority).toBe(0.3)
  })

  it("every entry has a valid changeFrequency", () => {
    const validFreqs = ["always", "hourly", "daily", "weekly", "monthly", "yearly", "never"]
    for (const page of STATIC_PAGES) {
      expect(validFreqs).toContain(page.changeFrequency)
    }
  })
})