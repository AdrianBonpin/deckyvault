import { describe, it, expect, vi, beforeEach } from "vitest"

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col, val) => ({ col, val })),
  and: vi.fn((...args) => ({ and: args })),
  desc: vi.fn((col) => ({ desc: col })),
  avg: vi.fn((col) => ({ avg: col })),
  min: vi.fn((col) => ({ min: col })),
  max: vi.fn((col) => ({ max: col })),
  count: vi.fn((col) => ({ count: col })),
  sql: vi.fn((strings, ...vals) => ({ strings, vals })),
}))
vi.mock("drizzle-orm/pg-core", () => ({
  pgTable: vi.fn((n, c, i) => ({ name: n, columns: c, indexes: i })),
  pgEnum: vi.fn((n, v) => ({ name: n, values: v })),
  text: vi.fn((n) => n), integer: vi.fn((n) => n), real: vi.fn((n) => n),
  boolean: vi.fn((n) => n), timestamp: vi.fn((n) => n), jsonb: vi.fn((n) => n),
  index: vi.fn((n) => ({ on: vi.fn() })),
}))
vi.mock("@/lib/db/schema", () => ({
  games: { id: "id", steamAppId: "steam_app_id" },
  gameVersions: { id: "id", gameId: "game_id", isLatest: "is_latest", createdAt: "created_at" },
  performanceEntries: { id: "id", versionId: "version_id", hardwareSlug: "hardware_slug",
    fpsAvg: "fps_avg", fpsLow: "fps_low", fpsOnePercentLow: "fps_one_percent_low",
    fpsHigh: "fps_high", isRemoved: "is_removed", isPinned: "is_pinned", upvotes: "upvotes",
    upscalerType: "upscaler_type", frameGenMethod: "frame_gen_method", protonVersion: "proton_version",
    osVersion: "os_version", tdpWatts: "tdp_watts", settingsJson: "settings_json",
    createdAt: "created_at", userId: "user_id" },
  hardware: { slug: "slug", name: "name" },
  user: { id: "id", name: "name", image: "image" },
}))
vi.mock("@/lib/db/index", () => ({
  db: {
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(() => ({ orderBy: vi.fn(() => []) })) })) })) })),
  },
}))

import { buildPluginGameResponse } from "@/lib/api/plugin-public"

describe("buildPluginGameResponse — shape contract", () => {
  beforeEach(() => vi.clearAllMocks())

  it("returns { game: null } shape (no error) when game is missing", async () => {
    const r = await buildPluginGameResponse({ game: null })
    expect(r.game).toBeNull()
    expect(r.error).toBeUndefined()
    expect(r.estFps).toBeNull()
    expect(r.topEntries).toEqual([])
    expect(r.recentEntries).toEqual([])
  })

  it("returns estFps null when there are no entries", async () => {
    const r = await buildPluginGameResponse({ game: { id: "g1", steamAppId: 123, title: "X", slug: "x" }, entries: [], recent: [] })
    expect(r.game).not.toBeNull()
    expect(r.estFps).toBeNull()
    expect(r.topEntries).toEqual([])
    expect(r.recentEntries).toEqual([])
  })

  it("computes estFps from entries and trims entry fields", async () => {
    const entries = [
      { id: "e1", hardwareSlug: "steamdeck-oled", fpsAvg: 60, fpsLow: 40, fpsOnePercentLow: 45, fpsHigh: 90,
        upscalerType: "none", frameGenMethod: "none", protonVersion: "9", osVersion: "SteamOS 3", tdpWatts: 12,
        settingsJson: null, upvotes: 5, isPinned: true, createdAt: new Date("2026-01-01"),
        userName: "u", userImage: null },
      { id: "e2", hardwareSlug: "steamdeck-oled", fpsAvg: 80, fpsLow: 55, fpsOnePercentLow: 60, fpsHigh: 120,
        upscalerType: "fsr", frameGenMethod: "none", protonVersion: "9", osVersion: "SteamOS 3", tdpWatts: 15,
        settingsJson: null, upvotes: 2, isPinned: false, createdAt: new Date("2026-02-01"),
        userName: "u2", userImage: null },
    ]
    const r = await buildPluginGameResponse({ game: { id: "g1", steamAppId: 123, title: "X", slug: "x" }, entries, recent: entries })
    expect(r.estFps).not.toBeNull()
    expect(r.estFps!.avg).toBeCloseTo(70, 1)
    expect(r.estFps!.count).toBe(2)
    expect(r.estFps!.high).toBe(120)
    expect(r.estFps!.low).toBe(40)
    expect(r.topEntries.length).toBe(2)
    expect(r.topEntries[0].id).toBe("e1") // pinned first
  })

  it("uses provided estFps aggregate over entries-derived computation", async () => {
    const entries = [
      { id: "e1", hardwareSlug: "steamdeck-oled", fpsAvg: 60, fpsLow: 40, fpsOnePercentLow: 45, fpsHigh: 90,
        upscalerType: "none", frameGenMethod: "none", protonVersion: "9", osVersion: "SteamOS 3", tdpWatts: 12,
        settingsJson: null, upvotes: 5, isPinned: true, createdAt: new Date("2026-01-01"),
        userName: "u", userImage: null },
      { id: "e2", hardwareSlug: "steamdeck-oled", fpsAvg: 80, fpsLow: 55, fpsOnePercentLow: 60, fpsHigh: 120,
        upscalerType: "fsr", frameGenMethod: "none", protonVersion: "9", osVersion: "SteamOS 3", tdpWatts: 15,
        settingsJson: null, upvotes: 2, isPinned: false, createdAt: new Date("2026-02-01"),
        userName: "u2", userImage: null },
    ]
    // Aggregate says 25 entries averaging 72.3, distinct from the 2-row top-3 avg of 70
    const r = await buildPluginGameResponse({
      game: { id: "g1", steamAppId: 123, title: "X", slug: "x" },
      entries, recent: entries,
      estFps: { avg: 72.3, low: 35, onePct: 38, high: 140, count: 25 },
    })
    expect(r.estFps).not.toBeNull()
    expect(r.estFps!.avg).toBe(72.3)
    expect(r.estFps!.count).toBe(25)
    expect(r.estFps!.high).toBe(140)
    expect(r.estFps!.low).toBe(35)
    // Entries are still trimmed/rendered from the provided rows
    expect(r.topEntries.length).toBe(2)
    expect(r.recentEntries.length).toBe(2)
  })

  it("handles all-null fps values gracefully", async () => {
    const entries = [
      { id: "e1", hardwareSlug: "steamdeck-oled", fpsAvg: 60, fpsLow: null, fpsOnePercentLow: null, fpsHigh: null,
        upscalerType: "none", frameGenMethod: "none", protonVersion: null, osVersion: null, tdpWatts: null,
        settingsJson: null, upvotes: 0, isPinned: false, createdAt: new Date("2026-01-01"),
        userName: null, userImage: null },
    ]
    const r = await buildPluginGameResponse({ game: { id: "g1", steamAppId: 123, title: "X", slug: "x" }, entries, recent: entries })
    expect(r.estFps).not.toBeNull()
    expect(r.estFps!.avg).toBe(60)
    expect(r.estFps!.low).toBeNull()
    expect(r.estFps!.onePct).toBeNull()
    expect(r.estFps!.high).toBeNull()
    expect(r.estFps!.count).toBe(1)
  })

  it("trims recent entries separately from topEntries", async () => {
    const top = [
      { id: "e1", hardwareSlug: "steamdeck-oled", fpsAvg: 60, fpsLow: 40, fpsOnePercentLow: 45, fpsHigh: 90,
        upscalerType: "none", frameGenMethod: "none", protonVersion: "9", osVersion: "SteamOS 3", tdpWatts: 12,
        settingsJson: null, upvotes: 5, isPinned: true, createdAt: new Date("2026-01-01"),
        userName: "u", userImage: null },
    ]
    const recent = [
      { id: "e2", hardwareSlug: "steamdeck-oled", fpsAvg: 80, fpsLow: 55, fpsOnePercentLow: 60, fpsHigh: 120,
        upscalerType: "fsr", frameGenMethod: "none", protonVersion: "9", osVersion: "SteamOS 3", tdpWatts: 15,
        settingsJson: null, upvotes: 2, isPinned: false, createdAt: new Date("2026-02-01"),
        userName: "u2", userImage: null },
    ]
    const r = await buildPluginGameResponse({ game: { id: "g1", steamAppId: 123, title: "X", slug: "x" }, entries: top, recent })
    expect(r.topEntries).toHaveLength(1)
    expect(r.topEntries[0].id).toBe("e1")
    expect(r.recentEntries).toHaveLength(1)
    expect(r.recentEntries[0].id).toBe("e2")
  })
})