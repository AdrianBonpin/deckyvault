import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Mock data ──────────────────────────────────────────────────────────
let mockGameRows: Array<{ id: string; updatedAt: Date | null; capsuleImage: string | null }> = []
let mockDeviceRows: Array<{ slug: string; createdAt: Date | null }> = []

// ── Chainable query builder mock ──────────────────────────────────────
// Drizzle ORM pattern: db.select().from(table).where(...).limit(...).offset(...)
// or without .where(): db.select().from(table)
// Both resolve as promises.

function createChainableQuery(resolveWith: unknown[]) {
  const then = (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
    Promise.resolve(resolveWith).then(resolve, reject)

  const chain: Record<string, unknown> = {
    where: vi.fn(() => ({ then, [Symbol.toPrimitive]: () => resolveWith })),
    limit: vi.fn(() => ({ then, [Symbol.toPrimitive]: () => resolveWith })),
    offset: vi.fn(() => ({
      then,
      where: chain.where,
      limit: chain.limit,
      [Symbol.toPrimitive]: () => resolveWith,
    })),
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
        // Alternate between games and hardware queries based on call order
        // Games query always comes first, then hardware
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

describe("Sitemap Generator (app/sitemap.ts)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGameRows = []
    mockDeviceRows = []
    gamesCallCount = 0
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
    // At minimum: 6 static pages (games and devices are empty)
    expect(result.length).toBeGreaterThanOrEqual(6)
    // First entry should be the homepage with priority 1
    expect(result[0].url).toContain("deckyvault.xyz")
    expect(result[0].priority).toBe(1)
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
    expect(gameEntry!.priority).toBe(0.7)
  })

  it("always uses production URL when env is localhost", async () => {
    process.env.NEXT_PUBLIC_SITE_URL = "http://localhost:3000"

    const mod = await import("@/app/sitemap")
    const result = await mod.default()

    expect(result[0].url).toContain("deckyvault.xyz")
    expect(result[0].url).not.toContain("localhost")

    delete process.env.NEXT_PUBLIC_SITE_URL
  })
})