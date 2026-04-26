import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import {
  hardware,
  performanceEntries,
  gameVersions,
  games,
} from "@/lib/db/schema"
import { eq, and, sql, desc } from "drizzle-orm"

export const hardwareStatsRoutes = new Elysia({ prefix: "/hardware" })
  // ── All devices with aggregated stats ──────────────────────
  .get(
    "/stats",
    async () => {
      // Get all hardware devices ordered by sortOrder
      const devices = await db
        .select({
          slug: hardware.slug,
          name: hardware.name,
          deviceType: hardware.deviceType,
          sortOrder: hardware.sortOrder,
        })
        .from(hardware)
        .orderBy(hardware.sortOrder)

      // Get aggregated stats per device
      const statsPerDevice = await db
        .select({
          hardwareSlug: performanceEntries.hardwareSlug,
          totalBenchmarks: sql<number>`count(*)::int`,
          avgFps: sql<number>`round(avg(${performanceEntries.fpsAvg})::numeric, 1)`,
          verifiedCount: sql<number>`count(*) filter (where ${performanceEntries.verifiedAt} is not null)::int`,
          gameCount: sql<number>`count(distinct ${gameVersions.gameId})::int`,
        })
        .from(performanceEntries)
        .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
        .innerJoin(games, eq(gameVersions.gameId, games.id))
        .innerJoin(hardware, eq(performanceEntries.hardwareSlug, hardware.slug))
        .where(eq(performanceEntries.isRemoved, false))
        .groupBy(performanceEntries.hardwareSlug)

      const statsMap = new Map(statsPerDevice.map((s) => [s.hardwareSlug, s]))

      // Best game per device (highest avg FPS)
      const bestGames = await db
        .select({
          hardwareSlug: performanceEntries.hardwareSlug,
          gameId: games.id,
          gameTitle: games.title,
          gameHeaderImage: games.headerImage,
          fpsAvg: sql<number>`round(avg(${performanceEntries.fpsAvg})::numeric, 1)`,
        })
        .from(performanceEntries)
        .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
        .innerJoin(games, eq(gameVersions.gameId, games.id))
        .where(eq(performanceEntries.isRemoved, false))
        .groupBy(performanceEntries.hardwareSlug, games.id, games.title, games.headerImage)
        .orderBy(desc(sql`avg(${performanceEntries.fpsAvg})`))

      // For each device, pick the best game (first result per device slug)
      const bestGameMap = new Map<string, { id: string; title: string; headerImage: string | null; fpsAvg: number }>()
      for (const bg of bestGames) {
        if (!bestGameMap.has(bg.hardwareSlug)) {
          bestGameMap.set(bg.hardwareSlug, {
            id: bg.gameId,
            title: bg.gameTitle,
            headerImage: bg.gameHeaderImage,
            fpsAvg: Number(bg.fpsAvg),
          })
        }
      }

      return devices.map((device) => {
        const stats = statsMap.get(device.slug)
        const bestGame = bestGameMap.get(device.slug)
        return {
          slug: device.slug,
          name: device.name,
          deviceType: device.deviceType,
          sortOrder: device.sortOrder,
          totalBenchmarks: stats?.totalBenchmarks ?? 0,
          avgFps: stats?.avgFps ? Number(stats.avgFps) : null,
          gameCount: stats?.gameCount ?? 0,
          verifiedCount: stats?.verifiedCount ?? 0,
          bestGame: bestGame ?? null,
        }
      })
    },
  )
  // ── Single device detailed stats ───────────────────────────
  .get(
    "/:slug/stats",
    async ({ params, set }) => {
      const { slug } = params

      // Verify hardware exists
      const [device] = await db
        .select({
          slug: hardware.slug,
          name: hardware.name,
          deviceType: hardware.deviceType,
        })
        .from(hardware)
        .where(eq(hardware.slug, slug))
        .limit(1)

      if (!device) {
        set.status = 404
        return { error: "Device not found" }
      }

      // All entries for this device
      const entries = await db
        .select({
          id: performanceEntries.id,
          gameId: games.id,
          gameTitle: games.title,
          gameHeaderImage: games.headerImage,
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
          createdAt: performanceEntries.createdAt,
          genres: games.genres,
        })
        .from(performanceEntries)
        .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
        .innerJoin(games, eq(gameVersions.gameId, games.id))
        .where(
          and(
            eq(performanceEntries.hardwareSlug, slug),
            eq(performanceEntries.isRemoved, false),
          )
        )

      if (entries.length === 0) {
        return {
          ...device,
          totalBenchmarks: 0,
          avgFps: null,
          verifiedCount: 0,
          gameCount: 0,
          boxplot: [],
          historical: [],
          topGames: [],
          genreBreakdown: [],
          protonBreakdown: [],
          upscalerBreakdown: [],
        }
      }

      const totalBenchmarks = entries.length
      const avgFps = Math.round(
        (entries.reduce((s, e) => s + (e.fpsAvg ?? 0), 0) / totalBenchmarks) * 10
      ) / 10
      const verifiedCount = entries.filter((e) => e.verifiedAt !== null).length

      // Unique game count
      const gameIds = new Set(entries.map((e) => e.gameId))
      const gameCount = gameIds.size

      // ── Boxplot: FPS distribution per game ───────────────
      const gameFpsMap = new Map<string, { title: string; values: number[] }>()
      for (const e of entries) {
        if (!gameFpsMap.has(e.gameId)) {
          gameFpsMap.set(e.gameId, { title: e.gameTitle, values: [] })
        }
        gameFpsMap.get(e.gameId)!.values.push(e.fpsAvg ?? 0)
      }

      // Top 10 games by benchmark count for boxplot
      const topGameEntries = [...gameFpsMap.entries()]
        .sort((a, b) => b[1].values.length - a[1].values.length)
        .slice(0, 10)

      const boxplot = topGameEntries.map(([gameId, { title, values }]) => {
        const sorted = [...values].sort((a, b) => a - b)
        const n = sorted.length
        return {
          gameId,
          gameTitle: title,
          min: sorted[0],
          q1: sorted[Math.floor(n * 0.25)] ?? sorted[0],
          median: sorted[Math.floor(n * 0.5)] ?? sorted[0],
          q3: sorted[Math.floor(n * 0.75)] ?? sorted[n - 1],
          max: sorted[n - 1],
          count: n,
        }
      })

      // ── Historical: avg FPS per month ───────────────────
      const monthMap = new Map<string, { sum: number; count: number }>()
      for (const e of entries) {
        const month = `${e.createdAt.getFullYear()}-${String(e.createdAt.getMonth() + 1).padStart(2, "0")}`
        if (!monthMap.has(month)) monthMap.set(month, { sum: 0, count: 0 })
        const m = monthMap.get(month)!
        m.sum += e.fpsAvg ?? 0
        m.count++
      }

      const historical = [...monthMap.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, { sum, count }]) => ({
          period,
          avgFps: Math.round((sum / count) * 10) / 10,
          count,
        }))

      // ── Top Games by avg FPS ────────────────────────────
      const topGames = [...gameFpsMap.entries()]
        .map(([gameId, { title, values }]) => ({
          gameId,
          gameTitle: title,
          headerImage: entries.find((e) => e.gameId === gameId)?.gameHeaderImage ?? null,
          avgFps: Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10,
          benchmarkCount: values.length,
        }))
        .sort((a, b) => b.avgFps - a.avgFps)
        .slice(0, 20)

      // ── Genre breakdown ─────────────────────────────────
      const genreMap = new Map<string, number>()
      for (const e of entries) {
        if (e.genres && Array.isArray(e.genres)) {
          for (const g of e.genres) {
            genreMap.set(g, (genreMap.get(g) || 0) + 1)
          }
        }
      }
      const genreBreakdown = [...genreMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([genre, count]) => ({ genre, count }))

      // ── Proton breakdown ────────────────────────────────
      const protonMap = new Map<string, number>()
      for (const e of entries) {
        if (e.protonVersion) {
          protonMap.set(e.protonVersion, (protonMap.get(e.protonVersion) || 0) + 1)
        }
      }
      const protonBreakdown = [...protonMap.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([version, count]) => ({ version, count }))

      // ── Upscaler breakdown ───────────────────────────────────
      const upscalerMap = new Map<string, { count: number; avgFps: number }>()
      for (const e of entries) {
        const key = e.upscalerType ?? "none"
        if (!upscalerMap.has(key)) upscalerMap.set(key, { count: 0, avgFps: 0 })
        const f = upscalerMap.get(key)!
        f.count++
        f.avgFps += e.fpsAvg ?? 0
      }
      const upscalerBreakdown = [...upscalerMap.entries()].map(([type, data]) => ({
        upscalerType: type,
        count: data.count,
        avgFps: Math.round((data.avgFps / data.count) * 10) / 10,
      }))

      return {
        ...device,
        totalBenchmarks,
        avgFps,
        verifiedCount,
        gameCount,
        boxplot,
        historical,
        topGames,
        genreBreakdown,
        protonBreakdown,
        upscalerBreakdown,
      }
    },
    {
      params: t.Object({ slug: t.String() }),
    },
  )
