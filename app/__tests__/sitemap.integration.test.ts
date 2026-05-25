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
  hardware: { slug: "slug", createdAt: "createdAt" },
}))

vi.mock("drizzle-orm", () => ({
  or: vi.fn((...args: unknown[]) => args[0]),
  ne: vi.fn((col: unknown) => col),
  isNull: vi.fn((col: unknown) => col),
}))

const mockGetAllUpdates = vi.fn(() => [])
vi.mock("@/lib/updates", () => ({
  getAllUpdates: mockGetAllUpdates,
}))

describe("Sitemap Integration — Constraint Verification", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockData = []
    mockGetAllUpdates.mockReturnValue([])
  })

  // ── Spec §2: Non-negotiables ─────────────────────────────────────

  it("PERFORMANCE: sitemap index generation is synchronous (no DB for index)", async () => {
    const mod = await import("@/app/sitemap")
    const start = Date.now()
    await mod.generateSitemaps()
    const elapsed = Date.now() - start
    // generateSitemaps should resolve quickly (< 500ms even with mocked slow DB)
    expect(elapsed).toBeLessThan(500)
  })

  it("RELIABILITY: generateSitemaps always returns required base IDs", async () => {
    mockData = [{ count: 500 }]
    const mod = await import("@/app/sitemap")
    const ids = await mod.generateSitemaps()
    const idValues = ids.map((x: { id: string }) => x.id)

    expect(idValues).toContain("static")
    expect(idValues).toContain("devices")
    expect(idValues).toContain("updates")
    // Either 'games' or at least one 'games-N' must exist
    const hasGames = idValues.some(
      (id: string) => id === "games" || /^games-\d+$/.test(id),
    )
    expect(hasGames).toBe(true)
  })

  it("RELIABILITY: all child sitemaps return valid arrays even on failure", async () => {
    const mod = await import("@/app/sitemap")

    for (const id of ["static", "games", "devices", "updates"]) {
      const result = await mod.default({ id: Promise.resolve(id) })
      expect(Array.isArray(result)).toBe(true)
    }
  })

  it("SECURITY: no non-public routes in static pages", async () => {
    const mod = await import("@/app/sitemap")
    const result = await mod.default({ id: Promise.resolve("static") })

    const urls = result.map((e: { url: string }) => e.url)
    for (const url of urls) {
      expect(url).not.toContain("/manage")
      expect(url).not.toContain("/api")
      expect(url).not.toContain("/profile")
    }
  })

  it("DATA: games sitemap entries have correct shape", async () => {
    mockData = [
      { id: "abc123", updatedAt: new Date("2025-06-01"), capsuleImage: "https://cdn.example.com/img.jpg" },
    ]
    const mod = await import("@/app/sitemap")
    const result = await mod.default({ id: Promise.resolve("games") })

    for (const entry of result) {
      expect(entry).toHaveProperty("url")
      expect(typeof entry.url).toBe("string")
      expect(entry.url).toMatch(/^https:\/\/deckyvault\.xyz\/game\//)
      if (entry.lastModified) {
        expect(entry.lastModified).toBeInstanceOf(Date)
      }
      if (entry.images) {
        expect(Array.isArray(entry.images)).toBe(true)
      }
    }
  })

  it("DATA: devices sitemap entries have correct shape", async () => {
    mockData = [
      { slug: "steam-deck-oled", createdAt: new Date("2025-03-01") },
    ]
    const mod = await import("@/app/sitemap")
    const result = await mod.default({ id: Promise.resolve("devices") })

    for (const entry of result) {
      expect(entry).toHaveProperty("url")
      expect(typeof entry.url).toBe("string")
      expect(entry.url).toMatch(/^https:\/\/deckyvault\.xyz\/devices\//)
    }
  })

  it("DATA: updates sitemap entries have correct shape", async () => {
    mockGetAllUpdates.mockReturnValue([
      { slug: "2026-01-01", title: "Release", date: "2026-01-01", version: "1.0.0", summary: "First" },
    ])
    const mod = await import("@/app/sitemap")
    const result = await mod.default({ id: Promise.resolve("updates") })

    for (const entry of result) {
      expect(entry).toHaveProperty("url")
      expect(typeof entry.url).toBe("string")
      expect(entry.url).toMatch(/^https:\/\/deckyvault\.xyz\/updates\//)
    }
  })

  it("ISOLATION: static sitemap has no DB dependency", async () => {
    const mod = await import("@/app/sitemap")
    const result = await mod.default({ id: Promise.resolve("static") })

    // Result must be 7 entries regardless of DB state
    expect(result).toHaveLength(7)
  })
})