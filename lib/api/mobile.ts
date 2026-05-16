import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import {
  games,
  gameVersions,
  performanceEntries,
  hardware,
  user,
  gamePlatformSupport,
  entryScreenshots,
  gameComments,
} from "@/lib/db/schema"
import { eq, and, desc, sql, isNull, inArray } from "drizzle-orm"
import { getR2PublicUrl } from "@/lib/storage"

/**
 * GET /api/mobile/game/:gameId
 *
 * Consolidated mobile-optimized endpoint that bundles game details,
 * stats, presets, platform support, and first page of comments
 * into a single response — replacing 4+ separate API calls.
 */
export const mobileRoutes = new Elysia({
  prefix: "/mobile",
  detail: { tags: ["Mobile"] },
}).get(
  "/game/:gameId",
  async ({ params, set }) => {
    const { gameId } = params

    // ── 1. Fetch game ───────────────────────────────────────────
    const [game] = await db
      .select()
      .from(games)
      .where(eq(games.id, gameId))
      .limit(1)

    if (!game) {
      set.status = 404
      return { error: "Game not found" }
    }

    // ── 2. Fetch all non-removed performance entries with joins ──
    // Used for both stats and presets
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
        settingsJson: performanceEntries.settingsJson,
        userId: performanceEntries.userId,
        userName: user.name,
        userImage: user.image,
        launchOptions: performanceEntries.launchOptions,
        loadTimeSsd: performanceEntries.loadTimeSsd,
        loadTimeSd: performanceEntries.loadTimeSd,
        youtubeVideoId: performanceEntries.youtubeVideoId,
        customSystem: performanceEntries.customSystem,
        isPinned: performanceEntries.isPinned,
        pinnedAt: performanceEntries.pinnedAt,
        versionString: gameVersions.versionString,
        buildId: gameVersions.buildId,
        gameAntiCheatName: gamePlatformSupport.antiCheatName,
        gameAntiCheatStatus: gamePlatformSupport.antiCheatStatus,
      })
      .from(performanceEntries)
      .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
      .innerJoin(hardware, eq(performanceEntries.hardwareSlug, hardware.slug))
      .innerJoin(user, eq(performanceEntries.userId, user.id))
      .innerJoin(
        gamePlatformSupport,
        and(
          eq(gamePlatformSupport.gameId, gameVersions.gameId),
          eq(gamePlatformSupport.hardwareSlug, performanceEntries.hardwareSlug),
        ),
      )
      .where(
        and(
          eq(gameVersions.gameId, gameId),
          eq(performanceEntries.isRemoved, false),
        ),
      )
      .orderBy(desc(performanceEntries.isPinned), desc(performanceEntries.upvotes))

    // ── 3. Fetch hardware details for all devices involved ───────
    const deviceSlugs = [...new Set(entries.map((e) => e.hardwareSlug))]
    const deviceData = deviceSlugs.length > 0
      ? await db
          .select({
            slug: hardware.slug,
            name: hardware.name,
            wattHours: hardware.wattHours,
            tdpMax: hardware.tdpMax,
            deviceType: hardware.deviceType,
          })
          .from(hardware)
          .where(inArray(hardware.slug, deviceSlugs))
      : []

    const deviceWattHoursMap = new Map(
      deviceData.map((d) => [d.slug, d]),
    )

    // ── 4. Compute stats ────────────────────────────────────────
    const stats = (() => {
      if (entries.length === 0) {
        return {
          summary: {
            totalEntries: 0,
            avgFps: null as number | null,
            bestDevice: null as string | null,
            verifiedCount: 0,
            versionCount: 0,
          },
          isRawPerformer: false,
          isPoorPerformance: false,
          boxplot: [] as Array<{
            hardwareSlug: string
            hardwareName: string
            min: number
            q1: number
            median: number
            onePercentLow: number
            q3: number
            max: number
          }>,
          fpsRange: [] as Array<{
            id: string
            hardwareSlug: string
            fpsLow: number
            fpsAvg: number
            fpsHigh: number
            fpsOnePercentLow: number | null
            isRawPerformer: boolean
            isPoorPerformer: boolean
          }>,
          deviceBreakdown: [] as Array<{
            hardwareSlug: string
            hardwareName: string
            count: number
            wattHours: number | null
            tdpMax: number | null
            deviceType: string | null
          }>,
          batteryLife: [] as Array<{
            id: string
            hardwareSlug: string
            tdpWatts: number
            estimatedBatteryMin: number
            estimatedBatteryHours: number
            wattHours: number | null
            tdpMax: number | null
            estimatedAtMaxTdpMin: number | null
          }>,
          filterOptions: { protonVersions: [] as string[], osVersions: [] as string[] },
        }
      }

      const totalEntries = entries.length
      const avgFps =
        Math.round(
          (entries.reduce((sum, e) => sum + (e.fpsAvg ?? 0), 0) / totalEntries) * 10,
        ) / 10
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
      const versionCount = new Set(entries.map((e) => e.versionId)).size

      // Flags
      const isRawPerformer = entries.some(
        (e) =>
          (e.fpsAvg ?? 0) >= 60 &&
          e.upscalerType === "none" &&
          e.frameGenMethod === "none",
      )
      const isPoorPerformance = entries.some((e) => (e.fpsAvg ?? 0) < 30)

      // Boxplot per device
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
          const onePercentLow =
            sorted.length > 0
              ? sorted[Math.max(0, Math.floor(sorted.length * 0.01))]
              : sorted[0]
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

      // FPS range per entry
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

      // Device breakdown with hardware info
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

      // Battery life estimates
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
        .filter(Boolean) as Array<{
          id: string
          hardwareSlug: string
          tdpWatts: number
          estimatedBatteryMin: number
          estimatedBatteryHours: number
          wattHours: number | null
          tdpMax: number | null
          estimatedAtMaxTdpMin: number | null
        }>

      // Filter options
      const protonVersions = [
        ...new Set(entries.map((e) => e.protonVersion).filter(Boolean)),
      ] as string[]
      const osVersions = [
        ...new Set(entries.map((e) => e.osVersion).filter(Boolean)),
      ] as string[]

      return {
        summary: {
          totalEntries,
          avgFps,
          bestDevice,
          verifiedCount,
          versionCount,
        },
        isRawPerformer,
        isPoorPerformance,
        boxplot,
        fpsRange,
        deviceBreakdown,
        batteryLife,
        filterOptions: { protonVersions, osVersions },
      }
    })()

    // ── 5. Build presets (entries with settingsJson) ──────────────
    const presetEntries = entries.filter((e) => e.settingsJson !== null)
    const publicUrl = getR2PublicUrl()

    const presetEntryIds = presetEntries.map((e) => e.id)

    // Batch-fetch screenshots for all presets
    const screenshotsMap = new Map<
      string,
      Array<{
        id: string
        url: string
        width: number
        height: number
        orderIndex: number
      }>
    >()

    if (presetEntryIds.length > 0) {
      const allScreenshots = await db
        .select({
          id: entryScreenshots.id,
          storageKey: entryScreenshots.storageKey,
          orderIndex: entryScreenshots.orderIndex,
          width: entryScreenshots.width,
          height: entryScreenshots.height,
          entryId: entryScreenshots.entryId,
        })
        .from(entryScreenshots)
        .where(inArray(entryScreenshots.entryId, presetEntryIds))
        .orderBy(entryScreenshots.orderIndex)

      for (const ss of allScreenshots) {
        const arr = screenshotsMap.get(ss.entryId) || []
        arr.push({
          id: ss.id,
          url: `${publicUrl}/${ss.storageKey}`,
          width: ss.width,
          height: ss.height,
          orderIndex: ss.orderIndex,
        })
        screenshotsMap.set(ss.entryId, arr)
      }
    }

    const presets = presetEntries.map((p) => {
      const settingsCount = Array.isArray(p.settingsJson)
        ? (p.settingsJson as Array<{ settings: unknown[] }>).reduce(
            (sum, cat) => sum + cat.settings.length,
            0,
          )
        : 0

      const hw = deviceWattHoursMap.get(p.hardwareSlug)

      return {
        id: p.id,
        gameId,
        hardwareSlug: p.hardwareSlug,
        hardwareName: p.hardwareName,
        upvotes: p.upvotes,
        downvotes: p.downvotes,
        settingsCount,
        fpsAvg: p.fpsAvg,
        fpsLow: p.fpsLow,
        fpsHigh: p.fpsHigh,
        fpsOnePercentLow: p.fpsOnePercentLow ?? null,
        upscalerType: p.upscalerType,
        upscalerVersion: p.upscalerVersion,
        frameGenMethod: p.frameGenMethod,
        protonVersion: p.protonVersion,
        osVersion: p.osVersion,
        createdAt: p.createdAt.toISOString(),
        settingsJson: p.settingsJson,
        launchOptions: p.launchOptions,
        loadTimeSsd: p.loadTimeSsd ?? null,
        loadTimeSd: p.loadTimeSd ?? null,
        tdpWatts: p.tdpWatts ?? null,
        youtubeVideoId: p.youtubeVideoId ?? null,
        screenshots: screenshotsMap.get(p.id) || [],
        hardwareWattHours: hw?.wattHours ? Number(hw.wattHours) : null,
        hardwareDeviceType: hw?.deviceType ?? null,
        customSystem: p.customSystem ?? false,
        userNotes: p.userNotes,
        versionString: p.versionString ?? null,
        buildId: p.buildId ?? null,
        gameAntiCheatName: p.gameAntiCheatName ?? null,
        gameAntiCheatStatus: p.gameAntiCheatStatus ?? null,
        userId: p.userId,
        userName: p.userName,
        userImage: p.userImage,
        verifiedAt: p.verifiedAt ? p.verifiedAt.toISOString() : null,
        isPinned: p.isPinned,
        pinnedAt: p.pinnedAt ? p.pinnedAt.toISOString() : null,
      }
    })

    // ── 6. Fetch platform support ────────────────────────────────
    const platformSupport = await db
      .select({
        id: gamePlatformSupport.id,
        hardwareSlug: gamePlatformSupport.hardwareSlug,
        isSupported: gamePlatformSupport.isSupported,
        protonStatus: gamePlatformSupport.protonStatus,
        antiCheatRelevant: gamePlatformSupport.antiCheatRelevant,
        antiCheatName: gamePlatformSupport.antiCheatName,
        antiCheatVersion: gamePlatformSupport.antiCheatVersion,
        antiCheatStatus: gamePlatformSupport.antiCheatStatus,
        playabilityStatus: gamePlatformSupport.playabilityStatus,
        playabilityOverride: gamePlatformSupport.playabilityOverride,
        playabilityCalculatedAt: gamePlatformSupport.playabilityCalculatedAt,
        createdAt: gamePlatformSupport.createdAt,
        updatedAt: gamePlatformSupport.updatedAt,
      })
      .from(gamePlatformSupport)
      .where(eq(gamePlatformSupport.gameId, gameId))

    // ── 7. Fetch first page of comments ──────────────────────────
    const commentLimit = 20
    const commentConditions = [
      eq(gameComments.gameId, gameId),
      eq(gameComments.isRemoved, false),
      isNull(gameComments.parentId),
    ]

    const [commentData, [{ count: commentTotal }]] = await Promise.all([
      db
        .select({
          id: gameComments.id,
          gameId: gameComments.gameId,
          userId: gameComments.userId,
          parentId: gameComments.parentId,
          content: gameComments.content,
          upvotes: gameComments.upvotes,
          createdAt: gameComments.createdAt,
          updatedAt: gameComments.updatedAt,
          userName: user.name,
          userImage: user.image,
        })
        .from(gameComments)
        .innerJoin(user, eq(gameComments.userId, user.id))
        .where(and(...commentConditions))
        .orderBy(desc(gameComments.createdAt))
        .limit(commentLimit),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(gameComments)
        .where(and(...commentConditions)),
    ])

    // ── 8. Assemble response ─────────────────────────────────────
    return {
      game: {
        id: game.id,
        steamAppId: game.steamAppId,
        title: game.title,
        description: game.description,
        developer: game.developer,
        publisher: game.publisher,
        genres: game.genres,
        headerImage: game.headerImage,
        capsuleImage: game.capsuleImage,
        storeUrl: game.storeUrl,
        source: game.source,
        lastSync: game.lastSync?.toISOString() ?? null,
        syncStatus: game.syncStatus,
        createdAt: game.createdAt.toISOString(),
        systemRequirements: game.systemRequirements,
        metacriticScore: game.metacriticScore,
        metacriticUrl: game.metacriticUrl,
        recommendationsTotal: game.recommendationsTotal,
        priceCurrent: game.priceCurrent,
        priceInitial: game.priceInitial,
        priceCurrency: game.priceCurrency,
        isFree: game.isFree,
        releaseDate: game.releaseDate,
        categories: game.categories,
        platforms: game.platforms,
        steamReviewScore: game.steamReviewScore,
        steamReviewSentiment: game.steamReviewSentiment,
        steamReviewCount: game.steamReviewCount,
      },
      stats,
      presets,
      platformSupport,
      comments: {
        data: commentData,
        total: commentTotal,
      },
    }
  },
  {
    params: t.Object({ gameId: t.String() }),
  },
)