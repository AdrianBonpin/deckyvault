import { describe, it, expect, vi, beforeEach } from "vitest"

// ── Mock global fetch so syncSteamGame doesn't hit real APIs ──
const mockFetch = vi.fn()
Object.assign(globalThis, { fetch: mockFetch as unknown as typeof fetch })

// ── Mock db with a queue of select results ──
function createDbMock() {
  const state = {
    selectQueue: [] as unknown[][],
    insertResults: [] as unknown[],
    selectIdx: 0,
  }

  return {
    setSelectQueue: (q: unknown[][]) => { state.selectQueue = q; state.selectIdx = 0 },
    setInsertResults: (r: unknown[]) => { state.insertResults = r },

    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => ({
          limit: vi.fn().mockImplementation((n: number) => {
            const result = state.selectQueue[state.selectIdx] ?? []
            state.selectIdx++
            return Promise.resolve(result.slice(0, n))
          }),
        })),
      })),
    })),

    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockImplementation(() => ({
        returning: vi.fn().mockImplementation(() =>
          Promise.resolve(state.insertResults)
        ),
      })),
    })),

    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation(() => ({
        where: vi.fn().mockImplementation(() => Promise.resolve(undefined)),
      })),
    })),
  }
}

const mockDb = createDbMock()

vi.mock("@/lib/db/index", () => ({ db: mockDb }))
vi.mock("@/lib/db/schema", () => ({
  games: {
    steamAppId: "steam_app_id",
    id: "id",
    source: "source",
    title: "title",
    syncRetryCount: "sync_retry_count",
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
vi.mock("@/lib/api/playability", () => ({
  recalculatePlayability: vi.fn().mockResolvedValue({
    gamePlayability: "unknown",
    deviceResults: [],
  }),
}))

// Import AFTER mocks are established
const { ensureSteamGame } = await import("@/lib/steam/sync")

describe("ensureSteamGame", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch.mockReset()
    mockDb.setSelectQueue([])
    mockDb.setInsertResults([])
  })

  it("returns existing game without re-syncing when game already exists", async () => {
    const existingGame = {
      id: "existing-id",
      steamAppId: 12345,
      title: "Existing Game",
      source: "steam",
    }
    mockDb.setSelectQueue([[existingGame]])

    const result = await ensureSteamGame(12345)

    expect(result.created).toBe(false)
    expect(result.game).toEqual(existingGame)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it("creates stub and syncs when game does not exist", async () => {
    const stubGame = {
      id: "new-id",
      steamAppId: 67890,
      title: "Steam App 67890",
      source: "steam",
      syncStatus: "pending",
    }
    const syncedGame = {
      ...stubGame,
      title: "Real Game Name",
      steamReviewScore: 95,
      syncStatus: "synced",
    }

    // Queue: [existence check, recalc-select, final-select]
    mockDb.setSelectQueue([[], [{ id: "new-id" }], [syncedGame]])
    mockDb.setInsertResults([stubGame])

    // Mock Steam API responses
    mockFetch.mockImplementation((url: string | URL, init?: RequestInit) => {
      const urlStr = url.toString()

      if (urlStr.includes("store.steampowered.com/api/appdetails")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () =>
            Promise.resolve({
              "67890": {
                success: true,
                data: {
                  type: "game",
                  name: "Real Game Name",
                  developers: ["Dev Studios"],
                  publishers: ["Publisher"],
                  genres: [{ id: "1", description: "Action" }],
                  header_image: "https://example.com/header.jpg",
                  short_description: "An action game",
                  pc_requirements: { minimum: "min", recommended: "rec" },
                  categories: [{ id: "1", description: "Single-player" }],
                  platforms: { windows: true, mac: false, linux: true },
                  is_free: false,
                  release_date: { coming_soon: false, date: "2023-01-01" },
                },
              },
            }),
        } as unknown as Response)
      }

      if (urlStr.includes("store.steampowered.com/appreviews")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
          json: () =>
            Promise.resolve({
              query_summary: {
                total_reviews: 1000,
                total_positive: 950,
                review_score_desc: "Overwhelmingly Positive",
              },
            }),
        } as unknown as Response)
      }

      // Capsule image HEAD check
      if (urlStr.includes("library_600x900.jpg") && init?.method === "HEAD") {
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: new Headers(),
        } as unknown as Response)
      }

      return Promise.resolve({
        ok: false,
        status: 404,
      } as unknown as Response)
    })

    const result = await ensureSteamGame(67890)

    expect(result.created).toBe(true)
    expect(result.game?.title).toBe("Real Game Name")
    expect(result.game?.steamReviewScore).toBe(95)
  })

  it("handles sync failure gracefully — returns stub with error info", async () => {
    const stubGame = {
      id: "fail-id",
      steamAppId: 99999,
      title: "Steam App 99999",
      source: "steam",
      syncStatus: "pending",
    }
    const failedGame = {
      ...stubGame,
      syncStatus: "error",
      syncError: "Steam API returned 503",
    }

    // Queue: [existence check, recalc-select (for recordSyncFailure gets retryCount), final-select]
    mockDb.setSelectQueue([[], [{ syncRetryCount: 0 }], [failedGame]])
    mockDb.setInsertResults([stubGame])

    // Mock Steam API to fail
    mockFetch.mockImplementation((url: string | URL) => {
      const urlStr = url.toString()
      if (urlStr.includes("store.steampowered.com/api/appdetails")) {
        return Promise.resolve({
          ok: false,
          status: 503,
          headers: new Headers(),
        } as unknown as Response)
      }
      return Promise.resolve({
        ok: false,
        status: 404,
      } as unknown as Response)
    })

    const result = await ensureSteamGame(99999)

    expect(result.created).toBe(true)
    expect(result.error).toBe("Steam API returned 503")
    expect(result.game?.syncStatus).toBe("error")
  })
})
