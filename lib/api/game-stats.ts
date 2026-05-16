import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import {
  games,
  gameVersions,
  performanceEntries,
  hardware,
} from "@/lib/db/schema"
import { eq, and, inArray, sql } from "drizzle-orm"

export const gameStatsRoutes = new Elysia({ prefix: "/games", detail: { tags: ["Games"] } }).get(
  "/:gameId/stats",
  async ({ params, set }) => {
    const { gameId } = params

    try {
    // Verify game exists
    const [game] = await db
      .select({ id: games.id, steamAppId: games.steamAppId })
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1)

    if (!game) {
      set.status = 404
      return { error: "Game not found" }
    }

    // ── 1. All non-removed entries with joins ──────────────────────
    const entries = await db
      .select({
        id: performanceEntries.id,
        hardwareSlug: performanceEntries.hardwareSlug,
        hardwareName: hardware.name,
        fpsAvg: performanceEntries.fpsAvg,
        fpsLow: performanceEntries.fpsLow,
        fpsHigh: performanceEntries.fpsHigh,
        fpsOnePercentLow: performanceEntries.fpsOnePercentLow,
        upscalerType: performanceEntries.upscalerType,
        upscalerVersion: performanceEntries.upscalerVersion,
        frameGenMethod: performanceEntries.frameGenMethod,
        protonVersion: performanceEntries.protonVersion,
        osVersion: performanceEntries.osVersion,
        upvotes: performanceEntries.upvotes,
        downvotes: performanceEntries.downvotes,
        verifiedAt: performanceEntries.verifiedAt,
        userNotes: performanceEntries.userNotes,
        createdAt: performanceEntries.createdAt,
        versionId: performanceEntries.versionId,
        tdpWatts: performanceEntries.tdpWatts,
      })
      .from(performanceEntries)
      .innerJoin(
        gameVersions,
        eq(performanceEntries.versionId, gameVersions.id),
      )
      .innerJoin(hardware, eq(performanceEntries.hardwareSlug, hardware.slug))
      .where(
        and(
          eq(gameVersions.gameId, gameId),
          eq(performanceEntries.isRemoved, false),
        ),
      )

    if (entries.length === 0) {
      return {
        summary: {
          totalEntries: 0,
          avgFps: null,
          bestDevice: null,
          verifiedCount: 0,
          versionCount: 0,
        },
        isRawPerformer: false,
        boxplot: [],
        historical: [],
        upscalerStats: [],
        fpsRange: [],
        deviceBreakdown: [],
        filterOptions: { protonVersions: [], osVersions: [] },
        batteryLife: [],
      }
    }

    // ── 2. Summary stats ──────────────────────────────────────────
    const totalEntries = entries.length
    const avgFps =
      entries.reduce((sum, e) => sum + (e.fpsAvg ?? 0), 0) / totalEntries
    const verifiedCount = entries.filter((e) => e.verifiedAt !== null).length

    // Best device by mean fpsAvg
    const deviceFpsMap = new Map<string, number[]>()
    for (const e of entries) {
      const arr = deviceFpsMap.get(e.hardwareSlug) || []
      arr.push(e.fpsAvg ?? 0)
      deviceFpsMap.set(e.hardwareSlug, arr)
    }
    let bestDevice: string | null = null
    let bestDeviceAvg = 0
    for (const [slug, fpsArr] of deviceFpsMap) {
      const mean = fpsArr.reduce((a, b) => a + b, 0) / fpsArr.length
      if (mean > bestDeviceAvg) {
        bestDeviceAvg = mean
        bestDevice = slug
      }
    }

    // Version count
    const [versionRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(gameVersions)
      .where(eq(gameVersions.gameId, gameId))
    const versionCount = versionRow?.count ?? 0

    // ── 3. Raw Performer check ────────────────────────────────────
    const isRawPerformer = entries.some(
      (e) =>
        (e.fpsAvg ?? 0) >= 60 &&
        e.upscalerType === "none" &&
        e.frameGenMethod === "none",
    )

    // ── 3b. Poor Performance check ─────────────────────────────────
    const isPoorPerformance = entries.some((e) => (e.fpsAvg ?? 0) < 30)

    // ── 4. Boxplot per device ─────────────────────────────────────
    const boxplotMap = new Map<
      string,
      { hardwareName: string; values: number[] }
    >()
    for (const e of entries) {
      const existing = boxplotMap.get(e.hardwareSlug) || {
        hardwareName: e.hardwareName,
        values: [],
      }
      existing.values.push(e.fpsAvg ?? 0)
      boxplotMap.set(e.hardwareSlug, existing)
    }

    const boxplot = Array.from(boxplotMap.entries()).map(
      ([slug, { hardwareName, values }]) => {
        const sorted = [...values].sort((a, b) => a - b)
        const n = sorted.length
        const q1Idx = Math.floor(n * 0.25)
        const medIdx = Math.floor(n * 0.5)
        const q3Idx = Math.floor(n * 0.75)
        const onePercentLow = sorted.length > 0 ? sorted[Math.max(0, Math.floor(sorted.length * 0.01))] : sorted[0]
        return {
          hardwareSlug: slug,
          hardwareName,
          min: sorted[0],
          q1: sorted[q1Idx],
          median: sorted[medIdx],
          onePercentLow,
          q3: sorted[q3Idx],
          max: sorted[n - 1],
        }
      },
    )

    // ── 5. Historical (group by month + device) ───────────────────
    const histMap = new Map<
      string,
      Map<string, { sum: number; count: number }>
    >()
    for (const e of entries) {
      const date = new Date(e.createdAt)
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      if (!histMap.has(month)) histMap.set(month, new Map())
      const deviceMap = histMap.get(month)!
      const existing = deviceMap.get(e.hardwareSlug) || {
        sum: 0,
        count: 0,
      }
      existing.sum += e.fpsAvg ?? 0
      existing.count++
      deviceMap.set(e.hardwareSlug, existing)
    }

    const historical = Array.from(histMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, deviceMap]) => ({
        period: month,
        entries: Array.from(deviceMap.entries()).map(([slug, data]) => ({
          hardwareSlug: slug,
          avgFps: Math.round((data.sum / data.count) * 10) / 10,
          count: data.count,
        })),
      }))

    // ── 6. Upscaler/framegen stats ────────────────────────────────
    const upscalerMap = new Map<
      string,
      { hardwareSlug: string; sum: number; count: number }
    >()
    for (const e of entries) {
      const key = `${e.upscalerType}|${e.upscalerVersion ?? ''}|${e.frameGenMethod}|${e.hardwareSlug}`
      const existing = upscalerMap.get(key) || {
        hardwareSlug: e.hardwareSlug,
        sum: 0,
        count: 0,
      }
      existing.sum += e.fpsAvg ?? 0
      existing.count++
      upscalerMap.set(key, existing)
    }

    const upscalerStats = Array.from(upscalerMap.entries()).map(
      ([key, data]) => {
        const [upscalerType, upscalerVersion, frameGenMethod] = key.split("|")
        return {
          upscalerType,
          upscalerVersion: upscalerVersion || null,
          frameGenMethod,
          hardwareSlug: data.hardwareSlug,
          avgFps: Math.round((data.sum / data.count) * 10) / 10,
          count: data.count,
        }
      },
    )

    // ── 7. FPS range per entry ────────────────────────────────────
    const fpsRange = entries
      .filter((e) => e.fpsLow !== null && e.fpsHigh !== null)
      .map((e) => ({
        id: e.id,
        hardwareSlug: e.hardwareSlug,
        fpsLow: e.fpsLow!,
        fpsAvg: e.fpsAvg ?? 0,
        fpsHigh: e.fpsHigh!,
        fpsOnePercentLow: e.fpsOnePercentLow ?? null,
        isRawPerformer:
          (e.fpsAvg ?? 0) >= 60 &&
          e.upscalerType === "none" &&
          e.frameGenMethod === "none",
        isPoorPerformer: (e.fpsAvg ?? 0) < 30,
      }))

    // Stability score computation
    const stabilityScores = entries
      .filter(e => e.fpsOnePercentLow != null && (e.fpsAvg ?? 0) > 0)
      .map(e => Math.min(1, e.fpsOnePercentLow! / (e.fpsAvg ?? 1)))
    const avgStability = stabilityScores.length > 0
      ? Math.round((stabilityScores.reduce((a, b) => a + b, 0) / stabilityScores.length) * 100) / 100
      : null
    const bestOnePercentLow = entries.reduce((best, e) =>
      e.fpsOnePercentLow != null && e.fpsOnePercentLow > (best ?? 0) ? e.fpsOnePercentLow : best, null as number | null)

    // Fetch hardware wattHours for the relevant devices (used by deviceBreakdown + batteryLife)
    const deviceSlugs = [...new Set(entries.map((e) => e.hardwareSlug))]
    const deviceData = await db
      .select({
        slug: hardware.slug,
        wattHours: hardware.wattHours,
        tdpMax: hardware.tdpMax,
        deviceType: hardware.deviceType,
      })
      .from(hardware)
      .where(inArray(hardware.slug, deviceSlugs))

    const deviceWattHoursMap = new Map(
      deviceData.map((d) => [d.slug, d]),
    )

    // ── 8. Device breakdown ───────────────────────────────────────
    const deviceBreakdown = Array.from(boxplotMap.entries()).map(
      ([slug, { hardwareName, values }]) => {
        const dev = deviceWattHoursMap.get(slug)
        return {
          hardwareSlug: slug,
          hardwareName,
          count: values.length,
          wattHours: dev?.wattHours ? Number(dev.wattHours) : null,
          tdpMax: dev?.tdpMax ? Number(dev.tdpMax) : null,
          deviceType: dev?.deviceType ?? null,
        }
      },
    )

    // ── 9. Performance tier breakdown per device ────────────────
    const tierMap = new Map<string, { unplayable: number; playable: number; smooth: number; excellent: number }>()
    for (const e of entries) {
      const existing = tierMap.get(e.hardwareSlug) || { unplayable: 0, playable: 0, smooth: 0, excellent: 0 }
      if (e.fpsAvg < 30) existing.unplayable++
      else if (e.fpsAvg < 60) existing.playable++
      else if (e.fpsAvg < 120) existing.smooth++
      else existing.excellent++
      tierMap.set(e.hardwareSlug, existing)
    }

    const performanceTiers = Array.from(tierMap.entries()).map(([slug, tiers]) => ({
      hardwareSlug: slug,
      ...tiers,
    }))

    // ── 10. Stability scatter data ──────────────────────────────
    const stabilityScatter = entries
      .filter((e) => e.fpsOnePercentLow != null)
      .map((e) => ({
        id: e.id,
        hardwareSlug: e.hardwareSlug,
        fpsAvg: e.fpsAvg ?? 0,
        fpsOnePercentLow: e.fpsOnePercentLow!,
        stabilityRatio: e.fpsAvg > 0 ? Math.min(1, e.fpsOnePercentLow! / e.fpsAvg) : 0,
      }))

    // ── 12. Battery life estimates ─────────────────────────────
    const batteryLife = entries
      .filter((e) => e.tdpWatts != null && e.tdpWatts > 0)
      .map((e) => {
        const device = deviceWattHoursMap.get(e.hardwareSlug)
        const wh = device?.wattHours ? Number(device.wattHours) : null
        const tdpMax = device?.tdpMax ? Number(device.tdpMax) : null
        if (!wh) return null
        const estimatedBatteryHours = wh / e.tdpWatts!
        const estimatedBatteryMin = estimatedBatteryHours * 60
        const estimatedAtMaxTdpMin = tdpMax ? (wh / tdpMax) * 60 : null
        return {
          id: e.id,
          hardwareSlug: e.hardwareSlug,
          tdpWatts: Number(e.tdpWatts),
          estimatedBatteryMin: Math.round(estimatedBatteryMin),
          estimatedBatteryHours: Math.round(estimatedBatteryHours * 10) / 10,
          wattHours: wh,
          tdpMax,
          estimatedAtMaxTdpMin: estimatedAtMaxTdpMin
            ? Math.round(estimatedAtMaxTdpMin)
            : null,
        }
      })
      .filter(Boolean)

    // ── 11. Filter options ────────────────────────────────────────
    const protonVersions = [
      ...new Set(entries.map((e) => e.protonVersion).filter(Boolean)),
    ] as string[]
    const osVersions = [
      ...new Set(entries.map((e) => e.osVersion).filter(Boolean)),
    ] as string[]

    return {
      summary: {
        totalEntries,
        avgFps: Math.round(avgFps * 10) / 10,
        bestDevice,
        verifiedCount,
        versionCount,
        avgStability,
        bestOnePercentLow,
      },
      isRawPerformer,
      isPoorPerformance,
      boxplot,
      historical,
      upscalerStats,
      fpsRange,
      deviceBreakdown,
      performanceTiers,
      stabilityScatter,
      batteryLife,
      filterOptions: { protonVersions, osVersions },
    }
    } catch (err) {
      console.error("Error computing game stats:", err)
      set.status = 500
      return { error: "Failed to compute game stats" }
    }
  },
  {
    params: t.Object({ gameId: t.String() }),
    detail: { description: "Aggregated performance statistics for a game — boxplot, historical, upscaler stats, FPS ranges, device breakdown, and battery life estimates." },
  },
)
