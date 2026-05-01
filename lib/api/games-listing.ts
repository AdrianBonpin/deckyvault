import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import {
  games,
  gameVersions,
  performanceEntries,
  gamePlatformSupport,
  hardware,
} from "@/lib/db/schema"
import { ilike, or, sql, eq, and, desc, asc, inArray, gte, lte, type SQL } from "drizzle-orm"
import { fuzzySearchTerm } from "@/lib/db/search"

const MAX_OFFSET = 10000
const PAGE_SIZE = 24

export const gamesListingRoutes = new Elysia({ prefix: "/games/listing" }).get(
  "/",
  async ({ query }) => {
    const offset = Math.min(Number(query.offset) || 0, MAX_OFFSET)
    const limit = Math.min(Number(query.limit) || PAGE_SIZE, 100)
    const search = query.search || ""
    const genre = query.genre || ""
    const device = query.device || ""
    const sort = query.sort || "recent"
    const order = query.order === "asc" ? asc : desc

    // ── New filter parameters ─────────────────────────────────────
    const minFps = query.minFps
    const maxFps = query.maxFps
    const fsrSupport = query.fsrSupport
    const protonNative = query.protonNative
    const antiCheatStatus = query.antiCheatStatus
    const playabilityStatus = query.playabilityStatus
    const steamReviewScore = query.steamReviewScore
    const isFree = query.isFree
    const hasMultiplayer = query.hasMultiplayer

    // Build where conditions
    const conditions = []

    // Search filter (title, developer, publisher)
    if (search) {
      const titleTerm = fuzzySearchTerm(search)
      const term = `%${search}%`
      conditions.push(
        or(
          ilike(games.title, titleTerm),
          ilike(games.developer, term),
          ilike(games.publisher, term),
        )!,
      )
    }

    // Genre filter
    if (genre) {
      conditions.push(sql`${games.genres} @> ${JSON.stringify([genre])}::jsonb`)
    }

    // Device filter
    if (device) {
      // Get games with platform support
      const supportedIds = await db
        .select({ gameId: gamePlatformSupport.gameId })
        .from(gamePlatformSupport)
        .where(
          and(
            eq(gamePlatformSupport.hardwareSlug, device),
            eq(gamePlatformSupport.isSupported, true),
          ),
        )

      // Also get games with performance entries for this hardware
      const gamesWithBenchmarks = await db
        .select({ gameId: gameVersions.gameId })
        .from(performanceEntries)
        .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
        .where(eq(performanceEntries.hardwareSlug, device))
        .groupBy(gameVersions.gameId)

      // Combine both sets
      const deviceGameIds = new Set([
        ...supportedIds.map((s) => s.gameId),
        ...gamesWithBenchmarks.map((b) => b.gameId),
      ])

      if (deviceGameIds.size > 0) {
        conditions.push(inArray(games.id, Array.from(deviceGameIds)))
      } else {
        return { data: [], total: 0, limit, offset, genres: [], devices: [] }
      }
    }

    // ── FPS range filter (games with benchmarks in this range) ────
    if (minFps || maxFps) {
      const fpsConditions: (SQL | undefined)[] = [
        eq(performanceEntries.isRemoved, false),
        minFps ? gte(performanceEntries.fpsAvg, Number(minFps)) : undefined,
        maxFps ? lte(performanceEntries.fpsAvg, Number(maxFps)) : undefined,
      ].filter((c): c is SQL => c !== undefined)

      const fpsSubquery = db
        .select({ gameId: gameVersions.gameId })
        .from(performanceEntries)
        .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
        .where(and(...fpsConditions))
        .groupBy(gameVersions.gameId)

      conditions.push(sql`${games.id} IN (SELECT "gameId" FROM (${fpsSubquery}) AS fps_sub)`)
    }

    // ── FSR support filter ────────────────────────────────────────
    if (fsrSupport === "true") {
      const fsrSubquery = db
        .select({ gameId: gameVersions.gameId })
        .from(performanceEntries)
        .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
        .where(
          and(
            eq(performanceEntries.isRemoved, false),
            eq(performanceEntries.upscalerType, "fsr"),
          ),
        )
        .groupBy(gameVersions.gameId)

      conditions.push(sql`${games.id} IN (SELECT "gameId" FROM (${fsrSubquery}) AS fsr_sub)`)
    }

    // ── Proton / Native filter ────────────────────────────────────
    if (protonNative && ["proton", "native", "both"].includes(protonNative)) {
      const protonConditions: SQL[] = []

      if (protonNative === "proton" || protonNative === "both") {
        protonConditions.push(eq(gamePlatformSupport.protonStatus, "proton"))
      }
      if (protonNative === "native" || protonNative === "both") {
        protonConditions.push(eq(gamePlatformSupport.protonStatus, "native"))
      }

      const protonSubquery = db
        .select({ gameId: gamePlatformSupport.gameId })
        .from(gamePlatformSupport)
        .where(or(...protonConditions))
        .groupBy(gamePlatformSupport.gameId)

      conditions.push(sql`${games.id} IN (SELECT "gameId" FROM (${protonSubquery}) AS proton_sub)`)
    }

    // ── Anti-cheat status filter ──────────────────────────────────
    const validAcStatuses = ["supported", "unsupported", "unknown", "none"]
    if (antiCheatStatus && antiCheatStatus !== "any" && validAcStatuses.includes(antiCheatStatus)) {
      const acConditions: SQL[] = [
        eq(gamePlatformSupport.antiCheatRelevant, true),
        eq(gamePlatformSupport.antiCheatStatus, antiCheatStatus as "none" | "supported" | "unsupported" | "unknown"),
      ]

      const acSubquery = db
        .select({ gameId: gamePlatformSupport.gameId })
        .from(gamePlatformSupport)
        .where(and(...acConditions))
        .groupBy(gamePlatformSupport.gameId)

      conditions.push(sql`${games.id} IN (SELECT "gameId" FROM (${acSubquery}) AS ac_sub)`)
    }

    // ── Playability status filter ─────────────────────────────────
    const validPlayStatuses = ["great", "playable", "needs_tweaks", "unplayable", "unknown"]
    if (playabilityStatus && validPlayStatuses.includes(playabilityStatus)) {
      conditions.push(eq(games.playabilityStatus, playabilityStatus as "great" | "playable" | "needs_tweaks" | "unplayable" | "unknown"))
    }

    // ── Steam review score filter (minimum score) ─────────────────
    if (steamReviewScore) {
      conditions.push(gte(games.steamReviewScore, Number(steamReviewScore)))
    }

    // ── Free-to-play filter ───────────────────────────────────────
    if (isFree === "true") {
      conditions.push(eq(games.isFree, true))
    }

    // ── Has multiplayer filter ────────────────────────────────────
    if (hasMultiplayer === "true") {
      conditions.push(
        or(
          eq(games.onlineMultiplayerStatus, "supported"),
          eq(games.onlineMultiplayerStatus, "unknown"),
        )!,
      )
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined

    // Fetch all genres (for filter options)
    const genreRows = await db
      .select({ genres: games.genres })
      .from(games)
      .where(sql`${games.genres} IS NOT NULL`)

    const genreSet = new Set<string>()
    for (const row of genreRows) {
      if (Array.isArray(row.genres)) {
        for (const g of row.genres) {
          if (typeof g === "string") genreSet.add(g)
        }
      }
    }

    // Fetch all hardware devices (for filter options)
    const deviceRows = await db
      .select({ slug: hardware.slug, name: hardware.name })
      .from(hardware)
      .orderBy(hardware.sortOrder)

    // Count total games matching filters
    const countQuery = db
      .select({ count: sql<number>`count(*)::int` })
      .from(games)
      .where(where)

    // Determine sort order
    let orderBy
    let needsPostSort = false
    let postSortField: string | null = null

    switch (sort) {
      case "name":
        orderBy = order(games.title)
        break
      case "popularity":
        orderBy = order(games.recommendationsTotal)
        break
      case "release_date":
        orderBy = order(games.releaseDate)
        break
      case "steam_reviews":
        orderBy = order(games.steamReviewScore)
        break
      case "performance":
        // Performance sort requires a subquery — use SQL ORDER BY directly
        orderBy = sql`(
          SELECT AVG(pe."fps_avg")
          FROM ${performanceEntries} pe
          JOIN ${gameVersions} gv ON pe."version_id" = gv.id
          WHERE gv."game_id" = ${games.id} AND pe."is_removed" = false
        ) DESC NULLS LAST`
        if (query.order === "asc") {
          orderBy = sql`(
            SELECT AVG(pe."fps_avg")
            FROM ${performanceEntries} pe
            JOIN ${gameVersions} gv ON pe."version_id" = gv.id
            WHERE gv."game_id" = ${games.id} AND pe."is_removed" = false
          ) ASC NULLS LAST`
        }
        break
      case "benchmarks":
        needsPostSort = true
        postSortField = "benchmarkCount"
        orderBy = order(games.createdAt)
        break
      case "recent":
      default:
        orderBy = order(games.createdAt)
        break
    }

    // Fetch games page
    const data = await db
      .select({
        id: games.id,
        steamAppId: games.steamAppId,
        title: games.title,
        developer: games.developer,
        capsuleImage: games.capsuleImage,
        headerImage: games.headerImage,
        genres: games.genres,
        source: games.source,
        createdAt: games.createdAt,
        isFree: games.isFree,
        releaseDate: games.releaseDate,
        steamReviewScore: games.steamReviewScore,
        recommendationsTotal: games.recommendationsTotal,
        playabilityStatus: games.playabilityStatus,
        onlineMultiplayerStatus: games.onlineMultiplayerStatus,
      })
      .from(games)
      .where(where)
      .orderBy(orderBy)
      .limit(limit)
      .offset(offset)

    const gameIds = data.map((g) => g.id)

    // Fetch benchmark counts for the returned games (separate query to avoid subquery ambiguity)
    const benchmarkCounts = gameIds.length > 0
      ? await db
          .select({
            gameId: gameVersions.gameId,
            count: sql<number>`count(*)::int`,
          })
          .from(performanceEntries)
          .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
          .where(
            and(
              inArray(gameVersions.gameId, gameIds),
              eq(performanceEntries.isRemoved, false),
            ),
          )
          .groupBy(gameVersions.gameId)
      : []

    const benchmarkMap = new Map<string, number>()
    for (const row of benchmarkCounts) {
      benchmarkMap.set(row.gameId, row.count)
    }

    // Fetch platform support for the returned games (prioritise Steam Deck)
    const platformMap = new Map<string, string>()
    const antiCheatMap = new Map<string, { antiCheatRelevant: boolean; antiCheatStatus: string | null }>()
    if (gameIds.length > 0) {
      const platformRows = await db
        .select({
          gameId: gamePlatformSupport.gameId,
          hardwareSlug: gamePlatformSupport.hardwareSlug,
          protonStatus: gamePlatformSupport.protonStatus,
          antiCheatRelevant: gamePlatformSupport.antiCheatRelevant,
          antiCheatStatus: gamePlatformSupport.antiCheatStatus,
        })
        .from(gamePlatformSupport)
        .where(inArray(gamePlatformSupport.gameId, gameIds))

      for (const row of platformRows) {
        const isSteamDeck = row.hardwareSlug.startsWith("steamdeck")
        const existing = platformMap.get(row.gameId)
        if (!existing || (!existing.startsWith("steamdeck") && isSteamDeck)) {
          platformMap.set(row.gameId, row.protonStatus)
        }

        const existingAc = antiCheatMap.get(row.gameId)
        if (row.antiCheatRelevant) {
          if (!existingAc || (!existingAc.antiCheatRelevant && isSteamDeck) || (!existingAc.antiCheatRelevant)) {
            antiCheatMap.set(row.gameId, {
              antiCheatRelevant: row.antiCheatRelevant,
              antiCheatStatus: row.antiCheatStatus,
            })
          }
        }
      }
    }

    const enrichedData = data.map((g) => ({
      id: g.id,
      steamAppId: g.steamAppId,
      title: g.title,
      developer: g.developer,
      capsuleImage: g.capsuleImage,
      headerImage: g.headerImage,
      genres: g.genres,
      source: g.source,
      isFree: g.isFree,
      releaseDate: g.releaseDate,
      steamReviewScore: g.steamReviewScore,
      recommendationsTotal: g.recommendationsTotal,
      playabilityStatus: g.playabilityStatus,
      onlineMultiplayerStatus: g.onlineMultiplayerStatus,
      benchmarkCount: benchmarkMap.get(g.id) ?? 0,
      deckStatus: platformMap.get(g.id) ?? null,
      antiCheatRelevant: antiCheatMap.get(g.id)?.antiCheatRelevant ?? false,
      antiCheatStatus: antiCheatMap.get(g.id)?.antiCheatStatus ?? null,
    }))

    // If sorting by benchmarks, re-sort the enriched data
    if (needsPostSort && postSortField === "benchmarkCount") {
      const sortFn = query.order === "asc"
        ? (a: { benchmarkCount: number }, b: { benchmarkCount: number }) => a.benchmarkCount - b.benchmarkCount
        : (a: { benchmarkCount: number }, b: { benchmarkCount: number }) => b.benchmarkCount - a.benchmarkCount
      enrichedData.sort(sortFn)
    }

    const [{ count: total }] = await countQuery

    return {
      data: enrichedData,
      total,
      limit,
      offset,
      genres: Array.from(genreSet).sort(),
      devices: deviceRows,
    }
  },
  {
    query: t.Object({
      offset: t.Optional(t.String()),
      limit: t.Optional(t.String()),
      search: t.Optional(t.String()),
      genre: t.Optional(t.String()),
      device: t.Optional(t.String()),
      sort: t.Optional(t.String()),
      order: t.Optional(t.String()),
      // New filter parameters
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
  },
)