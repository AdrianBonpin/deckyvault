import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import {
  games,
  gameVersions,
  performanceEntries,
  hardware,
} from "@/lib/db/schema"
import { eq, and, sql } from "drizzle-orm"

export const gameStatsRoutes = new Elysia({ prefix: "/games" }).get(
  "/:gameId/stats",
  async ({ params, set }) => {
    const { gameId } = params

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
        trust: [],
        filterOptions: { protonVersions: [], osVersions: [] },
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
        return {
          hardwareSlug: slug,
          hardwareName,
          min: sorted[0],
          q1: sorted[q1Idx],
          median: sorted[medIdx],
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
      const date = e.createdAt
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
        isRawPerformer:
          (e.fpsAvg ?? 0) >= 60 &&
          e.upscalerType === "none" &&
          e.frameGenMethod === "none",
        isPoorPerformer: (e.fpsAvg ?? 0) < 30,
      }))

    // ── 8. Device breakdown ───────────────────────────────────────
    const deviceBreakdown = Array.from(boxplotMap.entries()).map(
      ([slug, { hardwareName, values }]) => ({
        hardwareSlug: slug,
        hardwareName,
        count: values.length,
      }),
    )

    // ── 9. Community trust ────────────────────────────────────────
    const trust = entries.map((e) => ({
      id: e.id,
      hardwareSlug: e.hardwareSlug,
      upvotes: e.upvotes,
      downvotes: e.downvotes,
      verifiedAt: e.verifiedAt ? e.verifiedAt.toISOString() : null,
      userNotes: e.userNotes,
      createdAt: e.createdAt.toISOString(),
    }))

    // ── 10. Filter options ────────────────────────────────────────
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
      },
      isRawPerformer,
      isPoorPerformance,
      boxplot,
      historical,
      upscalerStats,
      fpsRange,
      deviceBreakdown,
      trust,
      filterOptions: { protonVersions, osVersions },
    }
  },
  {
    params: t.Object({ gameId: t.String() }),
  },
)
