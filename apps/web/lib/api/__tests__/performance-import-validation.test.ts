import { describe, it, expect } from "vitest"
import { validateFps } from "@/lib/api/performance-import"

describe("validateFps", () => {
  it("rejects missing/null fpsAvg", () => {
    const r = validateFps({ fpsAvg: null as unknown as number })
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.error).toMatch(/fpsAvg/i)
  })

  it("rejects NaN fpsAvg", () => {
    const r = validateFps({ fpsAvg: NaN })
    expect(r.ok).toBe(false)
  })

  it("rejects fpsAvg below 1", () => {
    const r = validateFps({ fpsAvg: 0 })
    expect(r.ok).toBe(false)
  })

  it("accepts fpsAvg up to 1000", () => {
    const r = validateFps({ fpsAvg: 1000, fpsHigh: 999 })
    expect(r.ok).toBe(true)
  })

  it("rejects fpsAvg above 1000", () => {
    const r = validateFps({ fpsAvg: 1001 })
    expect(r.ok).toBe(false)
  })

  it("accepts fpsHigh of 750 (legit >500)", () => {
    const r = validateFps({ fpsAvg: 120, fpsHigh: 750 })
    expect(r.ok).toBe(true)
  })

  it("accepts optional nulls for fpsLow/onePct/high", () => {
    const r = validateFps({ fpsAvg: 60, fpsLow: null, fpsOnePercentLow: null, fpsHigh: null })
    expect(r.ok).toBe(true)
  })

  it("rejects negative fpsLow", () => {
    const r = validateFps({ fpsAvg: 60, fpsLow: -1 })
    expect(r.ok).toBe(false)
  })

  it("rejects fpsHigh above 1000", () => {
    const r = validateFps({ fpsAvg: 60, fpsHigh: 1200 })
    expect(r.ok).toBe(false)
  })
})