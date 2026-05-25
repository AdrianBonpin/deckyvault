// app/__tests__/metadata.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock modules that page renders depend on
vi.mock("@/lib/db/index", () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => []),
          })),
        })),
        innerJoin: vi.fn(() => ({
          where: vi.fn(() => ({
            groupBy: vi.fn(() => ({
              orderBy: vi.fn(() => []),
            })),
          })),
        })),
      })),
    })),
  },
}))

vi.mock("@/lib/db/schema", () => ({
  games: { id: "id", title: "title", slug: "slug", updatedAt: "updatedAt", capsuleImage: "capsuleImage", syncStatus: "syncStatus" },
  gameVersions: { id: "id", gameId: "gameId", versionString: "versionString", buildId: "buildId" },
  performanceEntries: { id: "id", versionId: "versionId", isRemoved: "isRemoved", hardwareSlug: "hardwareSlug", fpsAvg: "fpsAvg", fpsLow: "fpsLow", fpsHigh: "fpsHigh" },
  hardware: { slug: "slug", name: "name", deviceType: "deviceType", sortOrder: "sortOrder" },
  gameComments: { gameId: "gameId", id: "id" },
  gamePlatformSupport: { gameId: "gameId", hardwareSlug: "hardwareSlug", protonStatus: "protonStatus" },
  user: { id: "id", name: "name", image: "image", role: "role" },
  entryScreenshots: { id: "id", entryId: "entryId", storageKey: "storageKey", orderIndex: "orderIndex" },
}))

vi.mock("drizzle-orm", () => ({
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val })),
  and: vi.fn((...args: unknown[]) => args),
  desc: vi.fn((col: unknown) => col),
  or: vi.fn((...args: unknown[]) => args),
  ne: vi.fn((col: unknown) => col),
  isNull: vi.fn((col: unknown) => col),
  inArray: vi.fn((col: unknown, vals: unknown) => ({ col, vals })),
  sql: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({ raw: strings, vals: values })),
}))

vi.mock("@/lib/steam/sync", () => ({
  isSyncStale: vi.fn(() => false),
  syncSteamGame: vi.fn(() => Promise.resolve()),
}))

vi.mock("@/lib/storage", () => ({
  getR2PublicUrl: vi.fn(() => "https://r2.example.com"),
}))

vi.mock("@/lib/auth", () => ({}))
vi.mock("@/lib/auth-client", () => ({}))

vi.mock("@/lib/updates", () => ({
  getAllUpdates: vi.fn(() => []),
  getAllUpdateSlugs: vi.fn(() => []),
  getUpdateBySlug: vi.fn(() => Promise.resolve({ meta: { title: "", date: "", version: "", summary: "" }, html: "", headings: [] })),
}))

vi.mock("next/font/google", () => ({
  Lexend: vi.fn(() => ({ variable: "font-mock" })),
}))

vi.mock("@/components/navbar", () => ({
  default: vi.fn(() => null),
}))

describe("Page Metadata", () => {
  describe("Root Layout", () => {
    it("exports canonical URL", async () => {
      const { metadata } = await import("@/app/layout")
      expect(metadata.alternates?.canonical).toBe("https://deckyvault.xyz")
    })
  })

  describe("Games page", () => {
    it("has a unique title without duplicate brand name", async () => {
      const { metadata } = await import("@/app/games/page")
      expect(metadata.title).toBe("Games")
    })
  })

  describe("Devices page", () => {
    it("has a unique title without duplicate brand name", async () => {
      const { metadata } = await import("@/app/devices/page")
      expect(metadata.title).toBe("Devices")
    })
  })

  describe("Compare layout", () => {
    it("exports unique title and description", async () => {
      try {
        const { metadata } = await import("@/app/compare/layout")
        expect(metadata.title).toBe("Compare Games")
        expect(metadata.description).toBeDefined()
      } catch {
        throw new Error("app/compare/layout.tsx not created yet")
      }
    })
  })

  describe("Profile layout", () => {
    it("exports unique title and description", async () => {
      try {
        const { metadata } = await import("@/app/profile/layout")
        expect(metadata.title).toBe("Profile")
        expect(metadata.description).toBeDefined()
      } catch {
        throw new Error("app/profile/layout.tsx not created yet")
      }
    })
  })
})