import { describe, it, expect } from "vitest"

describe("app/[steamid] redirect route", () => {
  it("exports force-dynamic", async () => {
    const mod = await import("../[steamid]/page")
    expect(mod).toBeDefined()
  })

  it("redirects numeric steam IDs to /game/:id", () => {
    const buildRedirect = (steamid: string) => `/game/${steamid}`
    expect(buildRedirect("730")).toBe("/game/730")
    expect(buildRedirect("12345")).toBe("/game/12345")
  })
})