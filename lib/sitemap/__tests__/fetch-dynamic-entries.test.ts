import { describe, it, expect, vi, beforeEach } from "vitest"
import { fetchDynamicEntries } from "@/lib/sitemap/fetch-dynamic-entries"

vi.mock("@/lib/db/index", () => ({
  db: {
    select: vi.fn(),
  },
}))

vi.mock("@/lib/db/schema", () => ({
  games: {
    id: "id",
    updatedAt: "updatedAt",
    capsuleImage: "capsuleImage",
    syncStatus: "syncStatus",
  },
  hardware: {
    slug: "slug",
    createdAt: "createdAt",
  },
}))

function mockDrizzleQuery(rows: Record<string, unknown>[]) {
  const limit = vi.fn().mockResolvedValue(rows)
  const where = vi.fn().mockReturnValue({ limit })
  const from = vi.fn().mockReturnValue({ where, limit })
  return { select: vi.fn().mockReturnValue({ from, where, limit }) }
}

function mockDrizzleFailingQuery() {
  const limit = vi.fn().mockRejectedValue(new Error("DB error"))
  const where = vi.fn().mockReturnValue({ limit })
  const from = vi.fn().mockReturnValue({ where, limit })
  return { select: vi.fn().mockReturnValue({ from, where, limit }) }
}

describe("fetchDynamicEntries", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("returns game entries with validated images", async () => {
    const { db } = await import("@/lib/db/index")
    const mockDb = db as unknown as { select: ReturnType<typeof vi.fn> }

    const gameRows = [
      { id: "game-1", updatedAt: new Date("2024-01-01"), capsuleImage: "https://cdn.example.com/img1.jpg", syncStatus: "synced" },
      { id: "game-2", updatedAt: new Date("2024-02-01"), capsuleImage: null, syncStatus: "synced" },
    ]
    const deviceRows = [
      { slug: "steam-deck", createdAt: new Date("2023-06-01") },
    ]

    const gamesChain = mockDrizzleQuery(gameRows)
    const devicesChain = mockDrizzleQuery(deviceRows)

    let selectCallIndex = 0
    mockDb.select.mockImplementation(() => {
      selectCallIndex++
      if (selectCallIndex === 1) return gamesChain.select()
      return devicesChain.select()
    })

    const result = await fetchDynamicEntries()

    expect(result.gameEntries).toHaveLength(2)
    expect(result.gameEntries[0].url).toBe("https://deckyvault.xyz/games/game-1")
    expect(result.gameEntries[0].images).toEqual(["https://cdn.example.com/img1.jpg"])
    expect(result.gameEntries[1].url).toBe("https://deckyvault.xyz/games/game-2")
    expect(result.gameEntries[1].images).toBeUndefined()
    expect(result.deviceEntries).toHaveLength(1)
  })

  it("returns device entries from hardware table", async () => {
    const { db } = await import("@/lib/db/index")
    const mockDb = db as unknown as { select: ReturnType<typeof vi.fn> }

    const deviceRows = [
      { slug: "steam-deck-oled", createdAt: new Date("2023-11-01") },
      { slug: "rog-ally", createdAt: new Date("2024-01-15") },
    ]

    const gamesChain = mockDrizzleQuery([])
    const devicesChain = mockDrizzleQuery(deviceRows)

    let selectCallIndex = 0
    mockDb.select.mockImplementation(() => {
      selectCallIndex++
      if (selectCallIndex === 1) return gamesChain.select()
      return devicesChain.select()
    })

    const result = await fetchDynamicEntries()

    expect(result.deviceEntries).toHaveLength(2)
    expect(result.deviceEntries[0].url).toBe("https://deckyvault.xyz/devices/steam-deck-oled")
    expect(result.deviceEntries[1].url).toBe("https://deckyvault.xyz/devices/rog-ally")
  })

  it("returns empty arrays when DB query fails", async () => {
    const { db } = await import("@/lib/db/index")
    const mockDb = db as unknown as { select: ReturnType<typeof vi.fn> }

    const gamesChain = mockDrizzleFailingQuery()
    const devicesChain = mockDrizzleFailingQuery()

    let selectCallIndex = 0
    mockDb.select.mockImplementation(() => {
      selectCallIndex++
      if (selectCallIndex === 1) return gamesChain.select()
      return devicesChain.select()
    })

    const result = await fetchDynamicEntries()

    expect(result.gameEntries).toEqual([])
    expect(result.deviceEntries).toEqual([])
  })

  it("excludes invalid image URLs", async () => {
    const { db } = await import("@/lib/db/index")
    const mockDb = db as unknown as { select: ReturnType<typeof vi.fn> }

    const gameRows = [
      { id: "game-a", updatedAt: new Date("2024-01-01"), capsuleImage: "", syncStatus: "synced" },
      { id: "game-b", updatedAt: new Date("2024-02-01"), capsuleImage: "http://cdn.example.com/img.jpg", syncStatus: "synced" },
      { id: "game-c", updatedAt: new Date("2024-03-01"), capsuleImage: "https://cdn.example.com/valid.jpg", syncStatus: "synced" },
    ]

    const gamesChain = mockDrizzleQuery(gameRows)
    const devicesChain = mockDrizzleQuery([])

    let selectCallIndex = 0
    mockDb.select.mockImplementation(() => {
      selectCallIndex++
      if (selectCallIndex === 1) return gamesChain.select()
      return devicesChain.select()
    })

    const result = await fetchDynamicEntries()

    expect(result.gameEntries).toHaveLength(3)
    expect(result.gameEntries[0].images).toBeUndefined()
    expect(result.gameEntries[1].images).toBeUndefined()
    expect(result.gameEntries[2].images).toEqual(["https://cdn.example.com/valid.jpg"])
  })

  it("returns partial data when one query succeeds and the other fails", async () => {
    const { db } = await import("@/lib/db/index")
    const mockDb = db as unknown as { select: ReturnType<typeof vi.fn> }

    const gamesChain = mockDrizzleFailingQuery()
    const deviceRows = [
      { slug: "lenovo-legion-go", createdAt: new Date("2024-03-01") },
    ]
    const devicesChain = mockDrizzleQuery(deviceRows)

    let selectCallIndex = 0
    mockDb.select.mockImplementation(() => {
      selectCallIndex++
      if (selectCallIndex === 1) return gamesChain.select()
      return devicesChain.select()
    })

    const result = await fetchDynamicEntries()

    expect(result.gameEntries).toEqual([])
    expect(result.deviceEntries).toHaveLength(1)
    expect(result.deviceEntries[0].url).toBe("https://deckyvault.xyz/devices/lenovo-legion-go")
  })
})