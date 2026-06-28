import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import { games, gameVersions } from "@/lib/db/schema"
import { eq, and } from "drizzle-orm"

export const gamesLookupRoutes = new Elysia({
  prefix: "/games",
  detail: { tags: ["Games"] },
}).get(
  "/lookup",
  async ({ query, set }) => {
    const { steamAppId } = query

    if (steamAppId === undefined || steamAppId === null) {
      set.status = 400
      return { error: "steamAppId query parameter is required" }
    }

    // Look up the game
    const [game] = await db
      .select({
        id: games.id,
        steamAppId: games.steamAppId,
        title: games.title,
        slug: games.slug,
        headerImage: games.headerImage,
        capsuleImage: games.capsuleImage,
        developer: games.developer,
        publisher: games.publisher,
        source: games.source,
      })
      .from(games)
      .where(eq(games.steamAppId, steamAppId))
      .limit(1)

    if (!game) {
      set.status = 404
      return { error: `No game found with steamAppId ${steamAppId}` }
    }

    // Find the latest version
    const [latestVersion] = await db
      .select({
        id: gameVersions.id,
        versionString: gameVersions.versionString,
        buildId: gameVersions.buildId,
        isLatest: gameVersions.isLatest,
        createdAt: gameVersions.createdAt,
      })
      .from(gameVersions)
      .where(
        and(
          eq(gameVersions.gameId, game.id),
          eq(gameVersions.isLatest, true),
        ),
      )
      .limit(1)

    // If no latest version, get the most recent one
    const version =
      latestVersion ??
      (await db
        .select({
          id: gameVersions.id,
          versionString: gameVersions.versionString,
          buildId: gameVersions.buildId,
          isLatest: gameVersions.isLatest,
          createdAt: gameVersions.createdAt,
        })
        .from(gameVersions)
        .where(eq(gameVersions.gameId, game.id))
        .orderBy(gameVersions.createdAt)
        .limit(1)
        .then((rows) => rows[0] ?? null))

    return {
      game: {
        ...game,
        steamAppId: game.steamAppId ?? null,
      },
      version,
    }
  },
  {
    query: t.Object({
      steamAppId: t.Numeric(),
    }),
    detail: {
      description:
        "Look up a game and its latest version by Steam App ID. Used by the DeckyVault Decky Loader plugin to resolve game info before importing benchmarks.",
    },
  },
)