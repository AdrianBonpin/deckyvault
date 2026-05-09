import { describe, it, expect, vi } from "vitest"

// Mock database to prevent real queries
vi.mock("@/lib/db/index", () => ({
  db: {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      }),
    }),
  },
}))

vi.mock("@/lib/db/schema", () => ({
  games: { id: "id", updatedAt: "updatedAt", capsuleImage: "capsuleImage", syncStatus: "syncStatus" },
  hardware: { slug: "slug", createdAt: "createdAt" },
}))

vi.mock("drizzle-orm", () => ({
  or: vi.fn((...args) => args[0]),
  ne: vi.fn((col) => col),
  isNull: vi.fn((col) => col),
}))

describe("Sitemap Generator", () => {
  it("default export returns empty array (static sitemap is in public/)", async () => {
    const mod = await import("@/app/sitemap")
    const result = mod.default()
    expect(result).toEqual([])
  })
})