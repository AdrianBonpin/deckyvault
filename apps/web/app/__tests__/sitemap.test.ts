import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Mock data ──────────────────────────────────────────────────────────
let mockData: unknown[] = []

// ── Chainable query builder mock ──────────────────────────────────────
function createChainableQuery(resolveWith: unknown[]) {
  const then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(resolveWith).then(resolve, reject)

  const chain: Record<string, unknown> = {
    where: vi.fn(() => ({ then, [Symbol.toPrimitive]: () => resolveWith })),
    then,
    [Symbol.toPrimitive]: () => resolveWith,
  }

  return chain
}

vi.mock("@/lib/db/index", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => createChainableQuery(mockData)),
    })),
  },
}))

vi.mock("@/lib/db/schema", () => ({
  games: {
    id: "id",
    updatedAt: "updatedAt",
    capsuleImage: "capsuleImage",
    syncStatus: "syncStatus",
  },
  gameVersions: {
    id: "id",
    gameId: "gameId",
    versionString: "versionString",
    buildId: "buildId",
  },
  performanceEntries: {
    id: "id",
    versionId: "versionId",
    isRemoved: "isRemoved",
    hardwareSlug: "hardwareSlug",
    fpsAvg: "fpsAvg",
    fpsLow: "fpsLow",
    fpsHigh: "fpsHigh",
  },
  hardware: { slug: "slug", createdAt: "createdAt" },
  gameComments: { gameId: "gameId", id: "id" },
  gamePlatformSupport: {
    gameId: "gameId",
    hardwareSlug: "hardwareSlug",
    protonStatus: "protonStatus",
  },
  user: { id: "id", name: "name", image: "image", role: "role" },
  entryScreenshots: {
    id: "id",
    entryId: "entryId",
    storageKey: "storageKey",
    orderIndex: "orderIndex",
  },
  steamReviewSentimentEnum: {
    enumValues: [
      "overwhelmingly_positive",
      "very_positive",
      "positive",
      "mostly_positive",
      "mixed",
      "mostly_negative",
      "negative",
      "very_negative",
      "overwhelmingly_negative",
    ],
  },
}))

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((col: unknown) => col),
  or: vi.fn((...args: unknown[]) => args[0]),
  ne: vi.fn((col: unknown) => col),
  isNull: vi.fn((col: unknown) => col),
  inArray: vi.fn((col: unknown, vals: unknown) => ({ col, vals })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ raw: strings, vals: values })),
  avg: vi.fn((col: unknown) => col),
  count: vi.fn((col: unknown) => col),
}))

const mockGetAllUpdates = vi.fn(() => [])
vi.mock("@/lib/updates", () => ({
  getAllUpdates: mockGetAllUpdates,
}))

describe("Sitemap Generator (app/sitemap.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockData = []
    mockGetAllUpdates.mockReturnValue([])
  })

  // ── Configuration ──────────────────────────────────────────────────

  it("has ISR revalidation configured", async () => {
    const mod = await import("@/app/sitemap")
    expect(mod.revalidate).toBe(3600)
  })

  // ── generateSitemaps ───────────────────────────────────────────────

  describe("generateSitemaps", () => {
    it("returns at least 4 child sitemap IDs", async () => {
      mockData = [{ count: 500 }]
      const mod = await import("@/app/sitemap")
      const ids = await mod.generateSitemaps()

      const idValues = ids.map((x: { id: string }) => x.id)
      expect(idValues).toContain("static")
      expect(idValues).toContain("devices")
      expect(idValues).toContain("updates")
      expect(idValues).toContain("games")
    })

    it("returns unpaginated games when count <= 5000", async () => {
      mockData = [{ count: 5000 }]
      const mod = await import("@/app/sitemap")
      const ids = await mod.generateSitemaps()

      const idValues = ids.map((x: { id: string }) => x.id)
      expect(idValues).toContain("games")
      expect(idValues).not.toContain("games-0")
      expect(idValues).not.toContain("games-1")
    })

    it("paginates games when count > 5000", async () => {
      mockData = [{ count: 7500 }]
      const mod = await import("@/app/sitemap")
      const ids = await mod.generateSitemaps()

      const idValues = ids.map((x: { id: string }) => x.id)
      expect(idValues).toContain("games-0")
      expect(idValues).toContain("games-1")
      expect(idValues).not.toContain("games")
    })

    it("falls back to unpaginated games when count query fails", async () => {
      // mockData empty — count will be 0 from empty array, simulating a failed query
      mockData = []
      const mod = await import("@/app/sitemap")
      const ids = await mod.generateSitemaps()

      const idValues = ids.map((x: { id: string }) => x.id)
      expect(idValues).toContain("games")
    })
  })

  // ── sitemap({ id: 'static' }) ──────────────────────────────────────

  describe("sitemap({ id: 'static' })", () => {
    it("returns 7 static page entries", async () => {
      const mod = await import("@/app/sitemap")
      const result = await mod.default({ id: Promise.resolve("static") })

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(7)
    })

    it("first entry is homepage with priority 1.0", async () => {
      const mod = await import("@/app/sitemap")
      const result = await mod.default({ id: Promise.resolve("static") })

      expect(result[0].url).toContain("deckyvault.xyz")
      expect(result[0].priority).toBe(1.0)
    })

    it("includes /games and /compare", async () => {
      const mod = await import("@/app/sitemap")
      const result = await mod.default({ id: Promise.resolve("static") })

      const urls = result.map((e: { url: string }) => e.url)
      expect(urls).toContain("https://deckyvault.xyz/games")
      expect(urls).toContain("https://deckyvault.xyz/compare")
    })

    it("includes lastModified on all entries", async () => {
      const mod = await import("@/app/sitemap")
      const result = await mod.default({ id: Promise.resolve("static") })

      for (const entry of result) {
        expect(entry.lastModified).toBeDefined()
        expect(entry.lastModified).toBeInstanceOf(Date)
      }
    })

    it("uses production URL even when env is localhost", async () => {
      process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000"
      const mod = await import("@/app/sitemap")
      const result = await mod.default({ id: Promise.resolve("static") })

      expect(result[0].url).toContain("deckyvault.xyz")
      expect(result[0].url).not.toContain("localhost")

      delete process.env.NEXT_PUBLIC_SITE_URL
    })

    it("uses custom NEXT_PUBLIC_SITE_URL for staging", async () => {
      process.env.NEXT_PUBLIC_SITE_URL = "https://staging.deckyvault.xyz"
      const mod = await import("@/app/sitemap")
      const result = await mod.default({ id: Promise.resolve("static") })

      expect(result[0].url).toContain("staging.deckyvault.xyz")

      delete process.env.NEXT_PUBLIC_SITE_URL
    })
  })

  // ── sitemap({ id: 'games' }) ───────────────────────────────────────

  describe("sitemap({ id: 'games' })", () => {
    it("returns game entries from the database", async () => {
      mockData = [
        { id: "abc123", updatedAt: new Date("2025-06-01"), capsuleImage: "https://cdn.example.com/img.jpg" },
      ]
      const mod = await import("@/app/sitemap")
      const result = await mod.default({ id: Promise.resolve("games") })

      expect(result).toHaveLength(1)
      expect(result[0].url).toContain("deckyvault.xyz/game/abc123")
      expect(result[0].priority).toBe(0.8)
    })

    it("includes image entries for valid capsule URLs", async () => {
      mockData = [
        { id: "img123", updatedAt: null, capsuleImage: "https://cdn.example.com/capsule.jpg" },
      ]
      const mod = await import("@/app/sitemap")
      const result = await mod.default({ id: Promise.resolve("games") })

      expect(result[0].images).toEqual(["https://cdn.example.com/capsule.jpg"])
    })

    it("omits images for null capsuleImage", async () => {
      mockData = [
        { id: "noimg", updatedAt: null, capsuleImage: null },
      ]
      const mod = await import("@/app/sitemap")
      const result = await mod.default({ id: Promise.resolve("games") })

      expect(result[0].images).toBeUndefined()
    })

    it("includes lastModified from updatedAt", async () => {
      const date = new Date("2025-01-15T10:00:00Z")
      mockData = [
        { id: "date123", updatedAt: date, capsuleImage: null },
      ]
      const mod = await import("@/app/sitemap")
      const result = await mod.default({ id: Promise.resolve("games") })

      expect(result[0].lastModified).toBe(date)
    })

    it("returns empty array when DB query fails", async () => {
      // mockData is empty, querySafe will return undefined (no data)
      const mod = await import("@/app/sitemap")
      const result = await mod.default({ id: Promise.resolve("games") })

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(0)
    })

    it("applies changeFrequency weekly and priority 0.8", async () => {
      mockData = [
        { id: "freq", updatedAt: null, capsuleImage: null },
      ]
      const mod = await import("@/app/sitemap")
      const result = await mod.default({ id: Promise.resolve("games") })

      expect(result[0].changeFrequency).toBe("weekly")
      expect(result[0].priority).toBe(0.8)
    })
  })

  // ── sitemap({ id: 'devices' }) ─────────────────────────────────────

  describe("sitemap({ id: 'devices' })", () => {
    it("returns device entries from the database", async () => {
      mockData = [
        { slug: "steam-deck-oled", createdAt: new Date("2025-03-01") },
      ]
      const mod = await import("@/app/sitemap")
      const result = await mod.default({ id: Promise.resolve("devices") })

      expect(result).toHaveLength(1)
      expect(result[0].url).toContain("deckyvault.xyz/devices/steam-deck-oled")
    })

    it("sets priority 0.6 and changeFrequency monthly", async () => {
      mockData = [
        { slug: "device-1", createdAt: null },
      ]
      const mod = await import("@/app/sitemap")
      const result = await mod.default({ id: Promise.resolve("devices") })

      expect(result[0].priority).toBe(0.6)
      expect(result[0].changeFrequency).toBe("monthly")
    })

    it("returns empty array when DB query returns no rows", async () => {
      const mod = await import("@/app/sitemap")
      const result = await mod.default({ id: Promise.resolve("devices") })

      expect(result).toHaveLength(0)
    })
  })

  // ── sitemap({ id: 'updates' }) ─────────────────────────────────────

  describe("sitemap({ id: 'updates' })", () => {
    it("returns update entries from markdown files", async () => {
      mockGetAllUpdates.mockReturnValue([
        { slug: "2026-01-01", title: "Release", date: "2026-01-01", version: "1.0.0", summary: "First" },
      ])
      const mod = await import("@/app/sitemap")
      const result = await mod.default({ id: Promise.resolve("updates") })

      expect(result).toHaveLength(1)
      expect(result[0].url).toContain("deckyvault.xyz/updates/2026-01-01")
    })

    it("sets priority 0.5 and changeFrequency monthly", async () => {
      mockGetAllUpdates.mockReturnValue([
        { slug: "upd", title: "T", date: "2026-01-01", version: "1.0.0", summary: "S" },
      ])
      const mod = await import("@/app/sitemap")
      const result = await mod.default({ id: Promise.resolve("updates") })

      expect(result[0].priority).toBe(0.5)
      expect(result[0].changeFrequency).toBe("monthly")
    })

    it("returns empty array when getAllUpdates throws", async () => {
      mockGetAllUpdates.mockImplementation(() => {
        throw new Error("Failed to read updates directory")
      })
      const mod = await import("@/app/sitemap")
      const result = await mod.default({ id: Promise.resolve("updates") })

      expect(Array.isArray(result)).toBe(true)
      expect(result).toHaveLength(0)
    })
  })

  // ── Isolation ──────────────────────────────────────────────────────

  describe("child sitemap isolation", () => {
    it("static sitemap works even when DB is empty", async () => {
      const mod = await import("@/app/sitemap")
      const result = await mod.default({ id: Promise.resolve("static") })

      expect(result).toHaveLength(7)
    })

    it("unknown id returns empty array", async () => {
      const mod = await import("@/app/sitemap")
      const result = await mod.default({ id: Promise.resolve("nonexistent") })

      expect(result).toEqual([])
    })
  })
})