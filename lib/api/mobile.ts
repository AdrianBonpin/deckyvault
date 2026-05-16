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
  // ── Mobile Search (DB-synced games only, no Steam results) ──────
  .get(
    "/search",
    async ({ query, set }) => {
      if (!query.q || query.q.length < 2) {
        set.status = 400
        return { error: "Query must be at least 2 characters" }
      }

      const { ilike, or, sql: dsql, eq: deq, and: dand, desc: ddesc, inArray, gte } = await import("drizzle-orm")
      const { fuzzySearchTerm } = await import("@/lib/db/search")

      const titleTerm = fuzzySearchTerm(query.q)
      const term = `%${query.q}%`

      // Build filter conditions
      const baseFilterConditions = [
        or(
          ilike(games.title, titleTerm),
          ilike(games.developer, term),
          ilike(games.publisher, term),
        ),
      ]

      if (query.playabilityStatus) {
        baseFilterConditions.push(dsql`${games.playabilityStatus} = ${query.playabilityStatus}`)
      }

      // Search local database only
      const localGames = await db
        .select({
          id: games.id,
          steamAppId: games.steamAppId,
          title: games.title,
          capsuleImage: games.capsuleImage,
          headerImage: games.headerImage,
          playabilityStatus: games.playabilityStatus,
          steamReviewScore: games.steamReviewScore,
        })
        .from(games)
        .where(dand(...baseFilterConditions))
        .limit(40)

      if (localGames.length === 0) {
        return { results: [], total: 0 }
      }

      const gameIds = localGames.map((g) => g.id)

      // Fetch benchmark counts
      const benchmarkCounts = await db
        .select({ gameId: gameVersions.gameId, count: sql<number>`count(*)::int` })
        .from(performanceEntries)
        .innerJoin(gameVersions, deq(performanceEntries.versionId, gameVersions.id))
        .where(dand(inArray(gameVersions.gameId, gameIds), deq(performanceEntries.isRemoved, false)))
        .groupBy(gameVersions.gameId)

      const bmMap = new Map<string, number>()
      for (const r of benchmarkCounts) bmMap.set(r.gameId, r.count)

      // Fetch comment counts
      const commentCounts = await db
        .select({ gameId: gameComments.gameId, count: sql<number>`count(*)::int` })
        .from(gameComments)
        .where(inArray(gameComments.gameId, gameIds))
        .groupBy(gameComments.gameId)

      const cmMap = new Map<string, number>()
      for (const r of commentCounts) cmMap.set(r.gameId, r.count)

      // Platform support (for playability status per game)
      const platformRows = await db
        .select({ gameId: gamePlatformSupport.gameId, hardwareSlug: gamePlatformSupport.hardwareSlug, protonStatus: gamePlatformSupport.protonStatus })
        .from(gamePlatformSupport)
        .where(inArray(gamePlatformSupport.gameId, gameIds))

      const platformMap = new Map<string, string>()
      for (const r of platformRows) {
        const existing = platformMap.get(r.gameId)
        if (!existing || (!existing.startsWith("steamdeck") && r.hardwareSlug.startsWith("steamdeck"))) {
          platformMap.set(r.gameId, r.protonStatus)
        }
      }

      // Performance stats (raw performer, poor performance, best FPS)
      const perfStats = await db
        .select({
          gameId: gameVersions.gameId,
          bestFps: sql<number>`MAX(${performanceEntries.fpsAvg})::real`,
          isRawPerformer: sql<boolean>`BOOL_OR(${performanceEntries.fpsAvg} >= 60 AND ${performanceEntries.upscalerType} = 'none' AND ${performanceEntries.frameGenMethod} = 'none')`,
          isPoorPerformance: sql<boolean>`BOOL_OR(${performanceEntries.fpsAvg} < 30)`,
        })
        .from(performanceEntries)
        .innerJoin(gameVersions, deq(performanceEntries.versionId, gameVersions.id))
        .where(dand(inArray(gameVersions.gameId, gameIds), deq(performanceEntries.isRemoved, false)))
        .groupBy(gameVersions.gameId)

      const perfMap = new Map<string, { bestFps: number | null; isRawPerformer: boolean; isPoorPerformance: boolean }>()
      for (const r of perfStats) {
        perfMap.set(r.gameId, { bestFps: r.bestFps, isRawPerformer: r.isRawPerformer, isPoorPerformance: r.isPoorPerformance })
      }

      // Battery estimates (handheld only)
      const batteryStats = await db
        .select({
          gameId: gameVersions.gameId,
          estimatedBatteryMin: sql<number>`ROUND((${hardware.wattHours}::real / ${performanceEntries.tdpWatts}) * 60)::int`,
        })
        .from(performanceEntries)
        .innerJoin(gameVersions, deq(performanceEntries.versionId, gameVersions.id))
        .innerJoin(hardware, deq(performanceEntries.hardwareSlug, hardware.slug))
        .where(
          dand(
            inArray(gameVersions.gameId, gameIds),
            deq(performanceEntries.isRemoved, false),
            deq(hardware.deviceType, "handheld"),
            dsql`${performanceEntries.tdpWatts} IS NOT NULL AND ${performanceEntries.tdpWatts} > 0`,
            dsql`${hardware.wattHours} IS NOT NULL`,
          ),
        )
        .orderBy(ddesc(performanceEntries.fpsAvg))

      const batteryMap = new Map<string, number>()
      const seen = new Set<string>()
      for (const r of batteryStats) {
        if (!seen.has(r.gameId)) { seen.add(r.gameId); batteryMap.set(r.gameId, r.estimatedBatteryMin) }
      }

      // Build results
      const results = localGames.map((g) => {
        const p = perfMap.get(g.id)
        return {
          id: g.id,
          title: g.title,
          capsuleImage: g.capsuleImage,
          headerImage: g.headerImage,
          playabilityStatus: g.playabilityStatus ?? null,
          platformStatus: platformMap.get(g.id) ?? null,
          isRawPerformer: p?.isRawPerformer ?? false,
          isPoorPerformance: p?.isPoorPerformance ?? false,
          bestFps: p?.bestFps ?? null,
          estimatedBatteryMin: batteryMap.get(g.id) ?? null,
          benchmarkCount: bmMap.get(g.id) ?? 0,
          commentCount: cmMap.get(g.id) ?? 0,
          steamReviewScore: g.steamReviewScore ?? null,
        }
      })

      return { results, total: results.length }
    },
    {
      query: t.Object({
        q: t.String(),
        playabilityStatus: t.Optional(t.String()),
      }),
      detail: {
        description: "Search synced games only — returns mobile-optimized results with performance tags. No Steam-only entries.",
      },
    },
  )
  // ── Benchmark Detail (structured sections) ────────────────────
  .get(
    "/benchmark/:entryId",
    async ({ params, set }) => {
      const { entryId } = params

      const [entry] = await db
        .select({
          id: performanceEntries.id,
          fpsAvg: performanceEntries.fpsAvg,
          fpsLow: performanceEntries.fpsLow,
          fpsHigh: performanceEntries.fpsHigh,
          fpsOnePercentLow: performanceEntries.fpsOnePercentLow,
          hardwareSlug: performanceEntries.hardwareSlug,
          tdpWatts: performanceEntries.tdpWatts,
          upscalerType: performanceEntries.upscalerType,
          upscalerVersion: performanceEntries.upscalerVersion,
          frameGenMethod: performanceEntries.frameGenMethod,
          protonVersion: performanceEntries.protonVersion,
          osVersion: performanceEntries.osVersion,
          launchOptions: performanceEntries.launchOptions,
          loadTimeSsd: performanceEntries.loadTimeSsd,
          loadTimeSd: performanceEntries.loadTimeSd,
          youtubeVideoId: performanceEntries.youtubeVideoId,
          userNotes: performanceEntries.userNotes,
          customSystem: performanceEntries.customSystem,
          userId: performanceEntries.userId,
          verifiedAt: performanceEntries.verifiedAt,
          isPinned: performanceEntries.isPinned,
          createdAt: performanceEntries.createdAt,
          upvotes: performanceEntries.upvotes,
          downvotes: performanceEntries.downvotes,
          settingsJson: performanceEntries.settingsJson,
          hardwareName: hardware.name,
          hardwareDeviceType: hardware.deviceType,
          hardwareWattHours: hardware.wattHours,
          hardwareTdpMax: hardware.tdpMax,
          gameId: gameVersions.gameId,
          gameTitle: games.title,
          gameCapsuleImage: games.capsuleImage,
          versionString: gameVersions.versionString,
          buildId: gameVersions.buildId,
          userName: user.name,
          userImage: user.image,
          gameAntiCheatName: gamePlatformSupport.antiCheatName,
          gameAntiCheatStatus: gamePlatformSupport.antiCheatStatus,
        })
        .from(performanceEntries)
        .innerJoin(hardware, eq(performanceEntries.hardwareSlug, hardware.slug))
        .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
        .innerJoin(games, eq(gameVersions.gameId, games.id))
        .innerJoin(user, eq(performanceEntries.userId, user.id))
        .innerJoin(
          gamePlatformSupport,
          and(
            eq(gamePlatformSupport.gameId, gameVersions.gameId),
            eq(gamePlatformSupport.hardwareSlug, performanceEntries.hardwareSlug),
          ),
        )
        .where(and(eq(performanceEntries.id, entryId), eq(performanceEntries.isRemoved, false)))
        .limit(1)

      if (!entry) {
        set.status = 404
        return { error: "Benchmark entry not found" }
      }

      const publicUrl = getR2PublicUrl()
      const screenshotRows = await db
        .select({ id: entryScreenshots.id, storageKey: entryScreenshots.storageKey, orderIndex: entryScreenshots.orderIndex, width: entryScreenshots.width, height: entryScreenshots.height })
        .from(entryScreenshots)
        .where(eq(entryScreenshots.entryId, entryId))
        .orderBy(entryScreenshots.orderIndex)

      const screenshots = screenshotRows.map((ss) => ({
        id: ss.id,
        url: `${publicUrl}/${ss.storageKey}`,
        width: ss.width,
        height: ss.height,
        orderIndex: ss.orderIndex,
      }))

      // Compute battery estimates
      const wh = entry.hardwareWattHours ? Number(entry.hardwareWattHours) : null
      const tdpMax = entry.hardwareTdpMax ? Number(entry.hardwareTdpMax) : null
      const isHandheld = entry.hardwareDeviceType === "handheld"
      const estimatedBatteryHours = (isHandheld && wh && entry.tdpWatts) ? wh / Number(entry.tdpWatts) : null
      const estimatedBatteryMin = estimatedBatteryHours ? Math.round(estimatedBatteryHours * 60) : null
      const estimatedAtMaxTdpMin = (isHandheld && wh && tdpMax) ? Math.round((wh / tdpMax) * 60) : null

      return {
        benchmark: {
          id: entry.id,
          gameId: entry.gameId,
          gameTitle: entry.gameTitle,
          gameCapsuleImage: entry.gameCapsuleImage,
          hardwareSlug: entry.hardwareSlug,
          hardwareName: entry.hardwareName,
          hardwareDeviceType: entry.hardwareDeviceType,
          createdAt: entry.createdAt.toISOString(),
          userName: entry.userName,
          userImage: entry.userImage,
          verifiedAt: entry.verifiedAt ? entry.verifiedAt.toISOString() : null,
          isPinned: entry.isPinned,
          upvotes: entry.upvotes,
          downvotes: entry.downvotes,
        },
        performance: {
          fpsAvg: entry.fpsAvg,
          fpsLow: entry.fpsLow,
          fpsHigh: entry.fpsHigh,
          fpsOnePercentLow: entry.fpsOnePercentLow ?? null,
          loadTimeSsd: entry.loadTimeSsd ?? null,
          loadTimeSd: entry.loadTimeSd ?? null,
        },
        hardwarePower: {
          tdpWatts: entry.tdpWatts ? Number(entry.tdpWatts) : null,
          hardwareWattHours: wh,
          estimatedBatteryHours,
          estimatedBatteryMin,
          estimatedAtMaxTdpMin,
        },
        software: {
          protonVersion: entry.protonVersion ?? null,
          osVersion: entry.osVersion ?? null,
          upscalerType: entry.upscalerType ?? null,
          upscalerVersion: entry.upscalerVersion ?? null,
          frameGenMethod: entry.frameGenMethod ?? null,
          launchOptions: entry.launchOptions ?? null,
          customSystem: entry.customSystem ?? false,
        },
        gameInfo: {
          versionString: entry.versionString ?? null,
          buildId: entry.buildId ?? null,
          gameAntiCheatName: entry.gameAntiCheatName ?? null,
          gameAntiCheatStatus: entry.gameAntiCheatStatus ?? null,
        },
        settingsJson: entry.settingsJson as any,
        screenshots,
        youtubeVideoId: entry.youtubeVideoId ?? null,
        userNotes: entry.userNotes ?? null,
      }
    },
    {
      params: t.Object({ entryId: t.String() }),
      detail: {
        description: "Full benchmark entry detail with structured sections for mobile display — Performance, Hardware & Power, Software, and Game Info.",
      },
    },
  )
  // ── Dashboard (consolidated home screen) ───────────────────────
  .get(
    "/dashboard",
    async () => {
      const { sql: dsql } = await import("drizzle-orm")

      const SEVEN_DAYS_AGO = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)

      const recentBenchmarks = await db.execute(dsql`
        SELECT g.id, g.title, g.capsule_image, g.header_image, g.playability_status,
          COUNT(pe.id) AS benchmark_count, AVG(pe.fps_avg) AS avg_fps, MAX(pe.created_at) AS latest_benchmark_at
        FROM games g
        JOIN game_versions gv ON gv.game_id = g.id
        JOIN performance_entries pe ON pe.version_id = gv.id
        WHERE pe.is_removed = false
        GROUP BY g.id, g.title, g.capsule_image, g.header_image, g.playability_status
        ORDER BY MAX(pe.created_at) DESC
        LIMIT 10
      `)

      const trending = await db.execute(dsql`
        WITH recent_benchmarks AS (
          SELECT gv.game_id, COUNT(*) AS cnt FROM performance_entries pe
          JOIN game_versions gv ON pe.version_id = gv.id
          WHERE pe.is_removed = false AND pe.created_at >= ${SEVEN_DAYS_AGO}
          GROUP BY gv.game_id
        ),
        recent_comments AS (
          SELECT gc.game_id, COUNT(*) AS cnt FROM game_comments gc
          WHERE gc.is_removed = false AND gc.created_at >= ${SEVEN_DAYS_AGO}
          GROUP BY gc.game_id
        )
        SELECT g.id, g.title, g.capsule_image, g.header_image, g.playability_status,
          COALESCE(rb.cnt, 0) AS benchmark_count, COALESCE(rc.cnt, 0) AS comment_count,
          (COALESCE(rb.cnt, 0) * 3 + COALESCE(rc.cnt, 0) * 2) AS activity_score
        FROM games g
        LEFT JOIN recent_benchmarks rb ON rb.game_id = g.id
        LEFT JOIN recent_comments rc ON rc.game_id = g.id
        WHERE (rb.cnt IS NOT NULL OR rc.cnt IS NOT NULL)
        ORDER BY activity_score DESC
        LIMIT 10
      `)

      const mostTested = await db.execute(dsql`
        SELECT g.id, g.title, g.capsule_image, g.header_image, g.playability_status,
          COUNT(pe.id) AS benchmark_count, AVG(pe.fps_avg) AS avg_fps
        FROM games g
        JOIN game_versions gv ON gv.game_id = g.id
        JOIN performance_entries pe ON pe.version_id = gv.id
        WHERE pe.is_removed = false
        GROUP BY g.id, g.title, g.capsule_image, g.header_image, g.playability_status
        ORDER BY benchmark_count DESC
        LIMIT 10
      `)

      return {
        recentBenchmarks: recentBenchmarks.rows,
        trending: trending.rows,
        mostTested: mostTested.rows,
      }
    },
    {
      detail: {
        description: "Consolidated home screen data — recent benchmarks, trending, and most tested in one call.",
      },
    },
  )