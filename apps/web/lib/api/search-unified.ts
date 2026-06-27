import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import {
  games,
  gameVersions,
  performanceEntries,
  gameComments,
  hardware,
} from "@/lib/db/schema"
import { ilike, or, sql, eq, inArray, and, gte, desc } from "drizzle-orm"
import { fuzzySearchTerm } from "@/lib/db/search"

interface SteamSearchItem {
  id: number
  name: string
  tiny_image: string
  metascore: string
  price?: { currency: string; initial: number; final: number }
  platforms: { windows: boolean; mac: boolean; linux: boolean }
  controller_support?: string
}

interface SteamSearchResponse {
  items: SteamSearchItem[]
  total: number
}

export const searchUnifiedRoutes = new Elysia({ prefix: "/search", detail: { tags: ["Search"] } }).get(
  "/unified",
  async ({ query, set }) => {
    if (!query.q || query.q.length < 2) {
      set.status = 400
      return { error: "Query must be at least 2 characters" }
    }

    const titleTerm = fuzzySearchTerm(query.q)
    const term = `%${query.q}%`

    // ── Build filter conditions for columns on the games table ────
    const baseFilterConditions = [
      or(
        ilike(games.title, titleTerm),
        ilike(games.developer, term),
        ilike(games.publisher, term),
      ),
    ]

    if (query.playabilityStatus) {
      baseFilterConditions.push(sql`${games.playabilityStatus} = ${query.playabilityStatus}`)
    }
    if (query.steamReviewScore) {
      const minScore = parseInt(query.steamReviewScore, 10)
      if (!isNaN(minScore)) {
        baseFilterConditions.push(gte(games.steamReviewScore, minScore))
      }
    }
    if (query.isFree === "true") {
      baseFilterConditions.push(eq(games.isFree, true))
    }
    if (query.hasMultiplayer === "true") {
      baseFilterConditions.push(sql`${games.onlineMultiplayerStatus} = 'supported'`)
    }

    // ── 1. Search local database ────────────────────────────────────
    const localGames = await db
      .select()
      .from(games)
      .where(and(...baseFilterConditions))
      .limit(40)

    // ── 1b. Post-process filters requiring joins ───────────────────
    let filteredGameIds = new Set(localGames.map((g) => g.id))

    // Device filter: keep only games that have at least one benchmark for the device
    if (query.device && filteredGameIds.size > 0) {
      const matchingGameIds = await db
        .select({ gameId: gameVersions.gameId })
        .from(performanceEntries)
        .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
        .where(
          and(
            inArray(gameVersions.gameId, [...filteredGameIds]),
            eq(performanceEntries.hardwareSlug, query.device),
            eq(performanceEntries.isRemoved, false),
          ),
        )
        .groupBy(gameVersions.gameId)
      filteredGameIds = new Set(matchingGameIds.map((r) => r.gameId))
    }

    // FSR support filter: keep games with at least one benchmark using upscaler !== 'none'
    if (query.fsrSupport === "true" && filteredGameIds.size > 0) {
      const matchingGameIds = await db
        .select({ gameId: gameVersions.gameId })
        .from(performanceEntries)
        .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
        .where(
          and(
            inArray(gameVersions.gameId, [...filteredGameIds]),
            sql`${performanceEntries.upscalerType} != 'none'`,
            eq(performanceEntries.isRemoved, false),
          ),
        )
        .groupBy(gameVersions.gameId)
      filteredGameIds = new Set(matchingGameIds.map((r) => r.gameId))
    }

    // FPS range filter: keep games whose bestFps falls within [minFps, maxFps]
    const minFps = query.minFps ? parseInt(query.minFps, 10) : undefined
    const maxFps = query.maxFps ? parseInt(query.maxFps, 10) : undefined
    if ((minFps !== undefined || maxFps !== undefined) && filteredGameIds.size > 0) {
      const fpsStats = await db
        .select({
          gameId: gameVersions.gameId,
          bestFps: sql<number>`MAX(${performanceEntries.fpsAvg})::real`,
        })
        .from(performanceEntries)
        .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
        .where(
          and(
            inArray(gameVersions.gameId, [...filteredGameIds]),
            eq(performanceEntries.isRemoved, false),
          ),
        )
        .groupBy(gameVersions.gameId)

      const fpsMatchIds = new Set<string>()
      for (const row of fpsStats) {
        if (minFps !== undefined && row.bestFps < minFps) continue
        if (maxFps !== undefined && row.bestFps > maxFps) continue
        fpsMatchIds.add(row.gameId)
      }
      filteredGameIds = fpsMatchIds
    }

    // ── Filter local games to only those that passed all filters so far ──
    const filteredLocalGames = localGames.filter((g) => filteredGameIds.has(g.id))
    const filteredIds = filteredLocalGames.map((g) => g.id)

    // Fetch platform support + anti-cheat for local games
    const platformSupportMap = new Map<
      string,
      {
        isSupported: boolean
        protonStatus: string
        antiCheatRelevant: boolean
        antiCheatName: string | null
        antiCheatStatus: string
      }
    >()
    if (filteredIds.length > 0) {
      const { gamePlatformSupport } = await import("@/lib/db/schema")
      const supportRows = await db
        .select({
          gameId: gamePlatformSupport.gameId,
          isSupported: gamePlatformSupport.isSupported,
          protonStatus: gamePlatformSupport.protonStatus,
          antiCheatRelevant: gamePlatformSupport.antiCheatRelevant,
          antiCheatName: gamePlatformSupport.antiCheatName,
          antiCheatStatus: gamePlatformSupport.antiCheatStatus,
        })
        .from(gamePlatformSupport)
        .where(inArray(gamePlatformSupport.gameId, filteredIds))

      for (const row of supportRows) {
        platformSupportMap.set(row.gameId, {
          isSupported: row.isSupported,
          protonStatus: row.protonStatus,
          antiCheatRelevant: row.antiCheatRelevant,
          antiCheatName: row.antiCheatName,
          antiCheatStatus: row.antiCheatStatus,
        })
      }
    }

    // ── 1c. Proton/Native and Anti-cheat post-filters ─────────────
    if (query.protonNative && query.protonNative !== "any" && filteredIds.length > 0) {
      const protonMatchIds = new Set<string>()
      for (const g of filteredLocalGames) {
        const platform = platformSupportMap.get(g.id)
        const protonStatus = platform
          ? platform.protonStatus
          : g.platforms?.linux
            ? "native"
            : g.platforms?.windows
              ? "proton"
              : "unknown"
        if (
          (query.protonNative === "native" && protonStatus === "native") ||
          (query.protonNative === "proton" && protonStatus === "proton")
        ) {
          protonMatchIds.add(g.id)
        }
      }
      filteredGameIds = protonMatchIds
    }

    if (query.antiCheatStatus && query.antiCheatStatus !== "any" && filteredIds.length > 0) {
      const acMatchIds = new Set<string>()
      for (const g of filteredLocalGames) {
        const platform = platformSupportMap.get(g.id)
        const acStatus = platform ? platform.antiCheatStatus : "unknown"
        if (acStatus === query.antiCheatStatus) {
          acMatchIds.add(g.id)
        }
      }
      filteredGameIds = acMatchIds
    }

    // Final local games after all filters
    const finalLocalGames = filteredLocalGames.filter((g) => filteredGameIds.has(g.id))
    const finalIds = finalLocalGames.map((g) => g.id)
    const finalSteamAppIds = new Set(
      finalLocalGames.map((g) => g.steamAppId).filter(Boolean),
    )

    // ── 2. Count related data for local games ───────────────────────
    let benchmarkCounts: { gameId: string; count: number }[] = []
    let presetCounts: { gameId: string; count: number }[] = []
    let commentCounts: { gameId: string; count: number }[] = []

    if (finalIds.length > 0) {
      const [bCounts, pCounts, cCounts] = await Promise.all([
        db
          .select({
            gameId: gameVersions.gameId,
            count: sql<number>`count(*)::int`,
          })
          .from(performanceEntries)
          .innerJoin(
            gameVersions,
            eq(performanceEntries.versionId, gameVersions.id),
          )
          .where(
            and(
              inArray(gameVersions.gameId, finalIds),
              eq(performanceEntries.isRemoved, false),
            ),
          )
          .groupBy(gameVersions.gameId),
        db
          .select({
            gameId: gameVersions.gameId,
            count: sql<number>`count(*)::int`,
          })
          .from(performanceEntries)
          .innerJoin(
            gameVersions,
            eq(performanceEntries.versionId, gameVersions.id),
          )
          .where(
            and(
              inArray(gameVersions.gameId, finalIds),
              eq(performanceEntries.isRemoved, false),
              sql`${performanceEntries.settingsJson} IS NOT NULL`,
            ),
          )
          .groupBy(gameVersions.gameId),
        db
          .select({
            gameId: gameComments.gameId,
            count: sql<number>`count(*)::int`,
          })
          .from(gameComments)
          .where(inArray(gameComments.gameId, finalIds))
          .groupBy(gameComments.gameId),
      ])
      benchmarkCounts = bCounts
      presetCounts = pCounts
      commentCounts = cCounts
    }

    const countMap = new Map<
      string,
      { benchmarks: number; presets: number; comments: number }
    >()
    for (const g of finalLocalGames) {
      countMap.set(g.id, { benchmarks: 0, presets: 0, comments: 0 })
    }
    for (const c of benchmarkCounts) {
      countMap.get(c.gameId)!.benchmarks = c.count
    }
    for (const c of presetCounts) {
      countMap.get(c.gameId)!.presets = c.count
    }
    for (const c of commentCounts) {
      countMap.get(c.gameId)!.comments = c.count
    }

    // ── 2b. Raw Performer + Poor Performance + best FPS ────────────
    const rawPerformerMap = new Map<string, boolean>()
    const poorPerformerMap = new Map<string, boolean>()
    const bestFpsMap = new Map<string, number>()

    if (finalIds.length > 0) {
      const perfStats = await db
        .select({
          gameId: gameVersions.gameId,
          bestFps: sql<number>`MAX(${performanceEntries.fpsAvg})::real`,
          isRawPerformer: sql<boolean>`BOOL_OR(
            ${performanceEntries.fpsAvg} >= 60
            AND ${performanceEntries.upscalerType} = 'none'
            AND ${performanceEntries.frameGenMethod} = 'none'
          )`,
          isPoorPerformance: sql<boolean>`BOOL_OR(${performanceEntries.fpsAvg} < 30)`,
        })
        .from(performanceEntries)
        .innerJoin(
          gameVersions,
          eq(performanceEntries.versionId, gameVersions.id),
        )
        .innerJoin(hardware, and(
          eq(performanceEntries.hardwareSlug, hardware.slug),
          eq(hardware.deviceType, "handheld"),
        ))
        .where(
          and(
            inArray(gameVersions.gameId, finalIds),
            eq(performanceEntries.isRemoved, false),
          ),
        )
        .groupBy(gameVersions.gameId)

      for (const row of perfStats) {
        bestFpsMap.set(row.gameId, row.bestFps)
        rawPerformerMap.set(row.gameId, row.isRawPerformer)
        poorPerformerMap.set(row.gameId, row.isPoorPerformance)
      }
    }

    // ── 2b2. Battery estimate for handheld devices ────────────────────
    const batteryMinMap = new Map<string, number>()

    if (finalIds.length > 0) {
      const { hardware: hardwareTable } = await import("@/lib/db/schema")

      const batteryStats = await db
        .select({
          gameId: gameVersions.gameId,
          estimatedBatteryMin: sql<number>`ROUND(
            (${hardwareTable.wattHours}::real / ${performanceEntries.tdpWatts}) * 60
          )::int`,
        })
        .from(performanceEntries)
        .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
        .innerJoin(hardwareTable, eq(performanceEntries.hardwareSlug, hardwareTable.slug))
        .where(
          and(
            inArray(gameVersions.gameId, finalIds),
            eq(performanceEntries.isRemoved, false),
            eq(hardwareTable.deviceType, "handheld"),
            sql`${performanceEntries.tdpWatts} IS NOT NULL AND ${performanceEntries.tdpWatts} > 0`,
            sql`${hardwareTable.wattHours} IS NOT NULL`,
          ),
        )
        .orderBy(desc(performanceEntries.fpsAvg))

      // Deduplicate — keep only the first (best fps) entry per game
      const seenGames = new Set<string>()
      for (const row of batteryStats) {
        if (!seenGames.has(row.gameId)) {
          seenGames.add(row.gameId)
          batteryMinMap.set(row.gameId, row.estimatedBatteryMin)
        }
      }
    }

    // ── 2c. Latest version ──────────────────────────────────────────
    const latestVersionMap = new Map<string, string>()

    if (finalIds.length > 0) {
      const versionRows = await db
        .select({
          gameId: gameVersions.gameId,
          versionString: gameVersions.versionString,
        })
        .from(gameVersions)
        .where(
          and(
            inArray(gameVersions.gameId, finalIds),
            eq(gameVersions.isLatest, true),
          ),
        )

      for (const row of versionRows) {
        if (row.versionString) {
          latestVersionMap.set(row.gameId, row.versionString)
        }
      }
    }

    // ── 3. Search Steam ─────────────────────────────────────────────
    let steamItems: SteamSearchItem[] = []
    try {
      const url = new URL("https://store.steampowered.com/api/storesearch/")
      url.searchParams.set("term", query.q)
      url.searchParams.set("cc", "US")
      url.searchParams.set("l", "en")

      const res = await fetch(url.toString(), {
        headers: { Accept: "application/json" },
      })
      if (res.ok) {
        const data = (await res.json()) as SteamSearchResponse
        steamItems = (data.items || []).filter((item) => {
          const name = item.name.toLowerCase()
          const exclude = [
            "soundtrack",
            " original soundtrack",
            " ost",
            " - ost",
            "dlc",
            "expansion",
            "season pass",
            " deluxe edition",
            " ultimate edition",
            " premium edition",
            " demo",
            " trial",
            " playtest",
            " beta",
            " artbook",
            " soundtrack bundle",
          ]
          return !exclude.some((kw) => name.includes(kw))
        })
      }
    } catch {
      // Steam search failure is non-fatal
    }

    // ── 4. Build unified results ────────────────────────────────────
    const results = []

    // Add local games
    for (const g of finalLocalGames) {
      const counts = countMap.get(g.id)!
      const platform = platformSupportMap.get(g.id)
      results.push({
        kind: "local" as const,
        id: g.id,
        appId: g.steamAppId,
        title: g.title,
        image: g.capsuleImage || g.headerImage,
        tinyImage: g.capsuleImage || g.headerImage || null,
        developer: g.developer,
        publisher: g.publisher,
        description: g.description,
        genres: g.genres,
        source: g.source,
        counts,
        platforms: g.platforms,
        platformSupport: platform
          ? {
              isSupported: platform.isSupported,
              protonStatus: platform.protonStatus,
              antiCheatRelevant: platform.antiCheatRelevant,
              antiCheatName: platform.antiCheatName,
              antiCheatStatus: platform.antiCheatStatus,
            }
          : g.platforms
            ? {
                isSupported: g.platforms.linux || g.platforms.windows || false,
                protonStatus: g.platforms.linux
                  ? "native"
                  : g.platforms.windows
                    ? "proton"
                    : "unsupported",
                antiCheatRelevant: false,
                antiCheatName: null,
                antiCheatStatus: "unknown",
              }
            : null,
        isRawPerformer: rawPerformerMap.get(g.id) ?? false,
        isPoorPerformance: poorPerformerMap.get(g.id) ?? false,
        bestFps: bestFpsMap.get(g.id) ?? null,
        estimatedBatteryMin: batteryMinMap.get(g.id) ?? null,
        latestVersion: latestVersionMap.get(g.id) ?? null,
        playabilityStatus: g.playabilityStatus,
        steamReviewScore: g.steamReviewScore,
        steamReviewSentiment: g.steamReviewSentiment,
        antiCheatRelevant: platform?.antiCheatRelevant ?? null,
        antiCheatStatus: platform?.antiCheatStatus ?? null,
        antiCheatName: platform?.antiCheatName ?? null,
      })
    }

    // Add Steam-only games
    for (const item of steamItems) {
      if (finalSteamAppIds.has(item.id)) continue
      results.push({
        kind: "steam" as const,
        appId: item.id,
        title: item.name,
        image: `https://cdn.akamai.steamstatic.com/steam/apps/${item.id}/library_600x900.jpg`,
        tinyImage: item.tiny_image || null,
        developer: null,
        publisher: null,
        description: null,
        genres: null,
        source: "steam" as const,
        counts: null,
        platformSupport: null,
        metascore: item.metascore || null,
        price: item.price
          ? {
              currency: item.price.currency,
              initial: item.price.initial,
              final: item.price.final,
            }
          : null,
        platforms: item.platforms,
        controllerSupport: item.controller_support || null,
        isRawPerformer: false,
        bestFps: null,
        latestVersion: null,
      })
    }

    return { results, total: results.length }
  },
  {
    query: t.Object({
      q: t.String(),
      device: t.Optional(t.String()),
      minFps: t.Optional(t.String()),
      maxFps: t.Optional(t.String()),
      fsrSupport: t.Optional(t.String()),
      protonNative: t.Optional(t.String()),
      antiCheatStatus: t.Optional(t.String()),
      playabilityStatus: t.Optional(t.String()),
      steamReviewScore: t.Optional(t.String()),
      isFree: t.Optional(t.String()),
      hasMultiplayer: t.Optional(t.String()),
    }),
    detail: {
      description: "Unified search across local database and Steam store. Returns both synced games (with performance data) and Steam-only results.",
    },
  },
)