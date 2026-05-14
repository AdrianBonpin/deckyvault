import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import { games } from "@/lib/db/schema"
import { eq } from "drizzle-orm"
import { scrapeSteamDBVersion } from "@/lib/steamdb/scrape"

export const steamdbVersionRoutes = new Elysia({
  prefix: "/games/:gameId",
  detail: { tags: ["Games"] },
}).get(
  "/steamdb-version",
  async ({ params, set }) => {
    // Look up game's steamAppId
    const [game] = await db
      .select({ steamAppId: games.steamAppId })
      .from(games)
      .where(eq(games.id, params.gameId))
      .limit(1)

    if (!game) {
      set.status = 404
      return { error: "Game not found" }
    }

    if (game.steamAppId === null) {
      return { unavailable: true, reason: "no_steam_app_id" }
    }

    // Check if scraping is globally disabled
    if (process.env.STEAMDB_SCRAPING_ENABLED === "false") {
      return { unavailable: true, reason: "scraping_disabled" }
    }

    const result = await scrapeSteamDBVersion(game.steamAppId)

    if (result.versionString === null && result.buildId === null) {
      return { unavailable: true, reason: "not_found" }
    }

    return {
      versionString: result.versionString,
      buildId: result.buildId,
      steamAppId: game.steamAppId,
      source: "steamdb",
    }
  },
  {
    params: t.Object({ gameId: t.String() }),
  },
)