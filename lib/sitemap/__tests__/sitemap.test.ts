import { describe, it, expect, vi } from "vitest"

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
  it("exports dynamic = force-dynamic", async () => {
    const mod = await import("@/app/sitemap")
    expect(mod.dynamic).toBe("force-dynamic")
  })

  it("default export is a function", async () => {
    const mod = await import("@/app/sitemap")
    expect(typeof mod.default).toBe("function")
  })
})
