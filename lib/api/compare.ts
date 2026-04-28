import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import { games, gameVersions, performanceEntries, hardware } from "@/lib/db/schema"
import { eq, and, inArray } from "drizzle-orm"

export const compareRoutes = new Elysia({ prefix: "/compare" })
  .get(
    "/games",
    async ({ query, set }) => {
      const gameIds = query.ids.split(",").filter(Boolean).slice(0, 4)
      if (gameIds.length < 2) {
        set.status = 400
        return { error: "At least 2 games required" }
      }

      // Fetch games
      const gameRows = await db
        .select({
          id: games.id,
          title: games.title,
          steamAppId: games.steamAppId,
          source: games.source,
          capsuleImage: games.capsuleImage,
          headerImage: games.headerImage,
        })
        .from(games)
        .where(inArray(games.id, gameIds))

      const results = await Promise.all(
        gameRows.map(async (game) => {
          // Fetch all non-removed entries for this game
          const entries = await db
            .select({
              fpsAvg: performanceEntries.fpsAvg,
              fpsLow: performanceEntries.fpsLow,
              fpsHigh: performanceEntries.fpsHigh,
              fpsOnePercentLow: performanceEntries.fpsOnePercentLow,
              upscalerType: performanceEntries.upscalerType,
              frameGenMethod: performanceEntries.frameGenMethod,
              hardwareSlug: performanceEntries.hardwareSlug,
              hardwareName: hardware.name,
            })
            .from(performanceEntries)
            .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
            .innerJoin(hardware, eq(performanceEntries.hardwareSlug, hardware.slug))
            .where(
              and(
                eq(gameVersions.gameId, game.id),
                eq(performanceEntries.isRemoved, false)
              )
            )

          if (entries.length === 0) {
            return {
              ...game,
              stats: {
                totalEntries: 0,
                avgFps: null,
                medianFps: null,
                bestFps: null,
                avgOnePercentLow: null,
                avgStability: null,
                bestDevice: null,
                tierBreakdown: null,
                deviceBreakdown: [],
              },
            }
          }

          const fpsValues = entries.map((e) => e.fpsAvg ?? 0).sort((a, b) => a - b)
          const avgFps = fpsValues.reduce((a, b) => a + b, 0) / fpsValues.length
          const medianFps = fpsValues[Math.floor(fpsValues.length / 2)]

          const onePercentLowValues = entries
            .filter((e) => e.fpsOnePercentLow != null)
            .map((e) => e.fpsOnePercentLow!)

          const avgOnePercentLow =
            onePercentLowValues.length > 0
              ? onePercentLowValues.reduce((a, b) => a + b, 0) / onePercentLowValues.length
              : null

          const stabilityScores = entries
            .filter((e) => e.fpsOnePercentLow != null && e.fpsAvg > 0)
            .map((e) => Math.min(1, e.fpsOnePercentLow! / (e.fpsAvg ?? 1)))

          const avgStability =
            stabilityScores.length > 0
              ? stabilityScores.reduce((a, b) => a + b, 0) / stabilityScores.length
              : null

          // Best device by avg fps
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

          // Tier breakdown
          const tiers = { unplayable: 0, playable: 0, smooth: 0, excellent: 0 }
          for (const e of entries) {
            const fps = e.fpsAvg ?? 0
            if (fps < 30) tiers.unplayable++
            else if (fps < 60) tiers.playable++
            else if (fps < 120) tiers.smooth++
            else tiers.excellent++
          }

          // Device breakdown
          const deviceBreakdown = Array.from(deviceFpsMap.entries()).map(([slug, fpsArr]) => ({
            hardwareSlug: slug,
            count: fpsArr.length,
            avgFps: Math.round((fpsArr.reduce((a, b) => a + b, 0) / fpsArr.length) * 10) / 10,
          }))

          return {
            ...game,
            stats: {
              totalEntries: entries.length,
              avgFps: Math.round(avgFps * 10) / 10,
              medianFps: Math.round(medianFps * 10) / 10,
              bestFps: Math.round(fpsValues[fpsValues.length - 1] * 10) / 10,
              avgOnePercentLow: avgOnePercentLow ? Math.round(avgOnePercentLow * 10) / 10 : null,
              avgStability: avgStability ? Math.round(avgStability * 100) : null,
              bestDevice,
              tierBreakdown: tiers,
              deviceBreakdown,
            },
          }
        })
      )

      return { games: results }
    },
    {
      query: t.Object({ ids: t.String() }),
    }
  )
  .get(
    "/presets",
    async ({ query, set }) => {
      const presetIds = query.ids.split(",").filter(Boolean).slice(0, 4)
      if (presetIds.length < 2) {
        set.status = 400
        return { error: "At least 2 presets required" }
      }

      const presetRows = await db
        .select({
          id: performanceEntries.id,
          fpsAvg: performanceEntries.fpsAvg,
          fpsLow: performanceEntries.fpsLow,
          fpsHigh: performanceEntries.fpsHigh,
          fpsOnePercentLow: performanceEntries.fpsOnePercentLow,
          upscalerType: performanceEntries.upscalerType,
          upscalerVersion: performanceEntries.upscalerVersion,
          frameGenMethod: performanceEntries.frameGenMethod,
          protonVersion: performanceEntries.protonVersion,
          osVersion: performanceEntries.osVersion,
          loadTimeSsd: performanceEntries.loadTimeSsd,
          loadTimeSd: performanceEntries.loadTimeSd,
          estimatedBatteryMin: performanceEntries.estimatedBatteryMin,
          settingsJson: performanceEntries.settingsJson,
          launchOptions: performanceEntries.launchOptions,
          hardwareSlug: performanceEntries.hardwareSlug,
          hardwareName: hardware.name,
          createdAt: performanceEntries.createdAt,
        })
        .from(performanceEntries)
        .innerJoin(hardware, eq(performanceEntries.hardwareSlug, hardware.slug))
        .where(inArray(performanceEntries.id, presetIds))

      return { presets: presetRows }
    },
    {
      query: t.Object({ ids: t.String() }),
    }
  )