import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import {
  games,
  gameVersions,
  performanceEntries,
  gamePlatformSupport,
  hardware,
} from "@/lib/db/schema"
import { ilike, or, sql, eq, and, desc, asc, inArray } from "drizzle-orm"

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

    // Build where conditions
    const conditions = []

    if (search) {
      const term = `%${search}%`
      conditions.push(
        or(
          ilike(games.title, term),
          ilike(games.developer, term),
          ilike(games.publisher, term),
        )!,
      )
    }

    if (genre) {
      conditions.push(sql`${games.genres} @> ${JSON.stringify([genre])}::jsonb`)
    }

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
    switch (sort) {
      case "name":
        orderBy = asc(games.title)
        break
      case "benchmarks":
      case "recent":
      default:
        orderBy = desc(games.createdAt)
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
    if (gameIds.length > 0) {
      const platformRows = await db
        .select({
          gameId: gamePlatformSupport.gameId,
          hardwareSlug: gamePlatformSupport.hardwareSlug,
          protonStatus: gamePlatformSupport.protonStatus,
        })
        .from(gamePlatformSupport)
        .where(inArray(gamePlatformSupport.gameId, gameIds))

      for (const row of platformRows) {
        const isSteamDeck = row.hardwareSlug.startsWith("steamdeck")
        const existing = platformMap.get(row.gameId)
        if (!existing || (!existing.startsWith("steamdeck") && isSteamDeck)) {
          platformMap.set(row.gameId, row.protonStatus)
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
      benchmarkCount: benchmarkMap.get(g.id) ?? 0,
      deckStatus: platformMap.get(g.id) ?? null,
    }))

    // If sorting by benchmarks, re-sort the enriched data
    if (sort === "benchmarks") {
      enrichedData.sort((a, b) => b.benchmarkCount - a.benchmarkCount)
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
    }),
  },
)