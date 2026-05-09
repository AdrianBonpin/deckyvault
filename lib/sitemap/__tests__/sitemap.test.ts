import { describe, it, expect, vi } from "vitest"

// Helper to build a chainable mock that returns []
function chainableMock() {
  const mock = {
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue([]),
  }
  return mock
}

// Mock database to prevent real queries
vi.mock("@/lib/db/index", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => chainableMock()),
    })),
    $count: vi.fn().mockResolvedValue(0),
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
  or: vi.fn((...args) => args[0]),
  ne: vi.fn((col) => col),
  isNull: vi.fn((col) => col),
}))

describe("Sitemap Generator", () => {
  it("generateSitemaps returns a single sitemap id when no data", async () => {
    const mod = await import("@/app/sitemap")
    const sitemaps = await mod.generateSitemaps()
    expect(sitemaps).toEqual([{ id: "0" }])
  })

  it("default export returns static pages in first chunk", async () => {
    const mod = await import("@/app/sitemap")
    const result = await mod.default({ id: "0" })
    expect(Array.isArray(result)).toBe(true)
    // Static pages: /, /games, /dashboard, /devices, /updates, /contact
    expect(result.length).toBeGreaterThanOrEqual(6)
    expect(result[0].url).toContain("deckyvault.xyz")
    expect(result[0].priority).toBe(1)
  })
})
