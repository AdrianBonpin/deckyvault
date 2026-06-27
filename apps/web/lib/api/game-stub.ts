import { Elysia, t } from "elysia"
import { ensureSteamGame } from "@/lib/steam/sync"

export const gameStubRoutes = new Elysia({ prefix: "/games", detail: { tags: ["Games"] } }).post(
  "/stub",
  async ({ body, set }) => {
    const result = await ensureSteamGame(body.steamAppId)

    if (!result.game) {
      set.status = 500
      return { error: "Failed to create or retrieve game" }
    }

    // If game already existed, return 200 with created:false
    if (!result.created) {
      return { game: result.game, created: false }
    }

    // If sync failed but stub exists, still return 201 with error info
    if (result.error) {
      set.status = 201
      return { game: result.game, created: true, syncError: result.error }
    }

    set.status = 201
    return { game: result.game, created: true }
  },
  {
    body: t.Object({
      steamAppId: t.Number(),
    }),
  },
)