import { Elysia, t } from "elysia"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db/index"
import { savedGames, games } from "@/lib/db/schema"
import { eq, and, sql } from "drizzle-orm"

export const savedGamesRoutes = new Elysia({ prefix: "/user/me/saved-games" })
  .post(
    "/",
    async ({ request, body, set }) => {
      const session = await auth.api.getSession({
        headers: request.headers,
      })

      if (!session) {
        set.status = 401
        return { error: "Unauthorized" }
      }

      // Check if game exists
      const [game] = await db
        .select({ id: games.id })
        .from(games)
        .where(eq(games.id, body.gameId))
        .limit(1)

      if (!game) {
        set.status = 404
        return { error: "Game not found" }
      }

      // Check if already saved
      const [existing] = await db
        .select({ id: savedGames.id })
        .from(savedGames)
        .where(
          and(
            eq(savedGames.userId, session.user.id),
            eq(savedGames.gameId, body.gameId),
          ),
        )
        .limit(1)

      if (existing) {
        set.status = 409
        return { error: "Game already saved" }
      }

      const [saved] = await db
        .insert(savedGames)
        .values({
          userId: session.user.id,
          gameId: body.gameId,
        })
        .returning()

      return { id: saved.id, gameId: saved.gameId, createdAt: saved.createdAt.toISOString() }
    },
    {
      body: t.Object({
        gameId: t.String(),
      }),
    },
  )
  .delete(
    "/:gameId",
    async ({ request, params, set }) => {
      const session = await auth.api.getSession({
        headers: request.headers,
      })

      if (!session) {
        set.status = 401
        return { error: "Unauthorized" }
      }

      const [deleted] = await db
        .delete(savedGames)
        .where(
          and(
            eq(savedGames.userId, session.user.id),
            eq(savedGames.gameId, params.gameId),
          ),
        )
        .returning()

      if (!deleted) {
        set.status = 404
        return { error: "Saved game not found" }
      }

      return { success: true }
    },
    {
      params: t.Object({
        gameId: t.String(),
      }),
    },
  )
  .get(
    "/",
    async ({ request, set }) => {
      const session = await auth.api.getSession({
        headers: request.headers,
      })

      if (!session) {
        set.status = 401
        return { error: "Unauthorized" }
      }

      const saved = await db
        .select({
          id: savedGames.id,
          gameId: savedGames.gameId,
          createdAt: savedGames.createdAt,
          gameTitle: games.title,
          gameHeaderImage: games.headerImage,
          gameCapsuleImage: games.capsuleImage,
          gameSteamAppId: games.steamAppId,
        })
        .from(savedGames)
        .innerJoin(games, eq(savedGames.gameId, games.id))
        .where(eq(savedGames.userId, session.user.id))
        .orderBy(sql`${savedGames.createdAt} DESC`)

      return saved.map((s) => ({
        ...s,
        createdAt: s.createdAt.toISOString(),
      }))
    },
  )
  .get(
    "/check/:gameId",
    async ({ request, params, set }) => {
      const session = await auth.api.getSession({
        headers: request.headers,
      })

      if (!session) {
        return { saved: false }
      }

      const [existing] = await db
        .select({ id: savedGames.id })
        .from(savedGames)
        .where(
          and(
            eq(savedGames.userId, session.user.id),
            eq(savedGames.gameId, params.gameId),
          ),
        )
        .limit(1)

      return { saved: !!existing }
    },
    {
      params: t.Object({
        gameId: t.String(),
      }),
    },
  )
