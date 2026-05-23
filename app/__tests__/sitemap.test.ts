import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Mock data ──────────────────────────────────────────────────────────
let mockGameRows: Array<{ id: string; updatedAt: Date | null; capsuleImage: string | null }> = []
let mockDeviceRows: Array<{ slug: string; createdAt: Date | null }> = []

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

let devicesCallCount = 0

vi.mock("@/lib/db/index", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => {
        devicesCallCount++
        const data = devicesCallCount % 2 === 1 ? mockGameRows : mockDeviceRows
        return createChainableQuery(data)
      }),
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

// Mock the updates module (markdown-based changelogs)
vi.mock("@/lib/updates", () => ({
  getAllUpdates: vi.fn(() => []),
}))

describe("Sitemap Generator (app/sitemap.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGameRows = []
    mockDeviceRows = []
    devicesCallCount = 0
  })

  it("has ISR revalidation configured", async () => {
    const mod = await import("@/app/sitemap")
    expect(mod.revalidate).toBe(3600)
  })

  it("returns static pages even with empty DB results", async () => {
    const mod = await import("@/app/sitemap")
    const result = await mod.default()

    expect(Array.isArray(result)).toBe(true)
    // 7 static pages (now includes /compare and /search)
    expect(result.length).toBeGreaterThanOrEqual(7)
    // First entry should be the homepage with priority 1
    expect(result[0].url).toContain("deckyvault.xyz")
    expect(result[0].priority).toBe(1)
  })

  it("includes compare and search in static pages", async () => {
    const mod = await import("@/app/sitemap")
    const result = await mod.default()

    const urls = result.map((e: { url: string }) => e.url)
    expect(urls).toContain("https://deckyvault.xyz/compare")
    expect(urls).toContain("https://deckyvault.xyz/search")
  })

  it("includes game entries from DB", async () => {
    mockGameRows = [
      { id: "123456", updatedAt: new Date("2025-01-01"), capsuleImage: "https://cdn.example.com/img.jpg" },
    ]
    mockDeviceRows = []

    const mod = await import("@/app/sitemap")
    const result = await mod.default()

    const gameEntry = result.find((e: { url: string }) => e.url.includes("/game/123456"))
    expect(gameEntry).toBeDefined()
    expect(gameEntry!.url).toContain("deckyvault.xyz/game/123456")
    expect(gameEntry!.priority).toBe(0.8)
  })

  it("includes image entries for games with capsule images", async () => {
    mockGameRows = [
      { id: "abc123", updatedAt: null, capsuleImage: "https://cdn.example.com/capsule.jpg" },
    ]
    mockDeviceRows = []

    const mod = await import("@/app/sitemap")
    const result = await mod.default()

    const gameEntry = result.find((e: { url: string }) => e.url.includes("/game/abc123"))
    expect(gameEntry).toBeDefined()
    expect(gameEntry!.images).toEqual(["https://cdn.example.com/capsule.jpg"])
  })

  it("handles game with null capsuleImage gracefully", async () => {
    mockGameRows = [
      { id: "noimg", updatedAt: null, capsuleImage: null },
    ]
    mockDeviceRows = []

    const mod = await import("@/app/sitemap")
    const result = await mod.default()

    const gameEntry = result.find((e: { url: string }) => e.url.includes("/game/noimg"))
    expect(gameEntry).toBeDefined()
    expect(gameEntry!.images).toBeUndefined()
  })

  it("includes device entries from DB", async () => {
    mockGameRows = []
    mockDeviceRows = [
      { slug: "steam-deck-oled", createdAt: new Date("2025-03-01") },
    ]

    const mod = await import("@/app/sitemap")
    const result = await mod.default()

    const deviceEntry = result.find((e: { url: string }) => e.url.includes("/devices/steam-deck-oled"))
    expect(deviceEntry).toBeDefined()
    expect(deviceEntry!.priority).toBe(0.6)
  })

  it("includes entries from all data sources combined", async () => {
    mockGameRows = [
      { id: "game1", updatedAt: null, capsuleImage: null },
      { id: "game2", updatedAt: null, capsuleImage: null },
    ]
    mockDeviceRows = [
      { slug: "device-1", createdAt: null },
    ]

    const mod = await import("@/app/sitemap")
    const result = await mod.default()

    // 7 static + 2 games + 1 device = 10
    expect(result.length).toBeGreaterThanOrEqual(10)
  })

  it("always uses production URL when env is localhost", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000"

    const mod = await import("@/app/sitemap")
    const result = await mod.default()

    expect(result[0].url).toContain("deckyvault.xyz")
    expect(result[0].url).not.toContain("localhost")

    delete process.env.NEXT_PUBLIC_SITE_URL
  })

  it("uses custom NEXT_PUBLIC_SITE_URL when set to non-localhost", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "https://staging.deckyvault.xyz"

    const mod = await import("@/app/sitemap")
    const result = await mod.default()

    expect(result[0].url).toContain("staging.deckyvault.xyz")

    delete process.env.NEXT_PUBLIC_SITE_URL
  })
})
