import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import { games, gameVersions, gamePlatformSupport } from "@/lib/db/schema"
import { ilike, eq } from "drizzle-orm"
import { requireRole } from "@/lib/auth/guard"

export const gamesManualRoutes = new Elysia({ prefix: "/games" })
  .post(
    "/manual",
    async ({ request, body, set }) => {
      const guard = await requireRole(request.headers, ["user", "contributor", "admin"])
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      // Duplicate check: exact title match (case-insensitive)
      const existing = await db
        .select({ id: games.id, title: games.title, source: games.source })
        .from(games)
        .where(ilike(games.title, body.title))
        .limit(5)

      if (existing.length > 0) {
        const exactMatch = existing.find(
          (g) => g.title.toLowerCase() === body.title.toLowerCase()
        )
        if (exactMatch) {
          set.status = 409
          return { error: "Game already exists", existingGame: exactMatch }
        }
      }

      // Create the game
      const [game] = await db
        .insert(games)
        .values({
          title: body.title,
          developer: body.developer || null,
          publisher: body.publisher || null,
          description: body.description || null,
          source: body.source || "manual",
          headerImage: body.headerImage || null,
          capsuleImage: body.capsuleImage || null,
          storeUrl: body.storeUrl || null,
          genres: body.genres || null,
          releaseDate: body.releaseDate || null,
          createdBy: guard.user.id,
        })
        .returning()

      // Create platform support entries
      if (body.platformSupport && body.platformSupport.length > 0) {
        await db.insert(gamePlatformSupport).values(
          body.platformSupport.map((ps) => ({
            gameId: game.id,
            hardwareSlug: ps.hardwareSlug,
            isSupported: ps.isSupported,
            protonStatus: ps.protonStatus as "native" | "proton" | "unsupported" | "unknown",
          }))
        )
      }

      // Create initial game version
      await db.insert(gameVersions).values({
        gameId: game.id,
        isLatest: true,
      })

      set.status = 201
      return { game }
    },
    {
      body: t.Object({
        title: t.String({ minLength: 1, maxLength: 200 }),
        developer: t.Optional(t.String()),
        publisher: t.Optional(t.String()),
        description: t.Optional(t.String()),
        source: t.Optional(t.Union([t.Literal("manual"), t.Literal("gog"), t.Literal("epic")])),
        headerImage: t.Optional(t.String()),
        capsuleImage: t.Optional(t.String()),
        storeUrl: t.Optional(t.String()),
        genres: t.Optional(t.Array(t.String())),
        releaseDate: t.Optional(t.String()),
        platformSupport: t.Optional(
          t.Array(
            t.Object({
              hardwareSlug: t.String(),
              isSupported: t.Boolean(),
              protonStatus: t.String(),
            })
          )
        ),
      }),
    }
  )
  .put(
    "/:gameId/manual",
    async ({ request, params, body, set }) => {
      const guard = await requireRole(request.headers, ["user", "contributor", "admin"])
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const [game] = await db
        .select()
        .from(games)
        .where(eq(games.id, params.gameId))
        .limit(1)

      if (!game) {
        set.status = 404
        return { error: "Game not found" }
      }

      if (game.source === "steam") {
        set.status = 403
        return { error: "Steam games are synced automatically and cannot be manually edited" }
      }

      // Only creator or admin can edit
      if (game.createdBy && game.createdBy !== guard.user.id && guard.user.role !== "admin") {
        set.status = 403
        return { error: "Only the creator or an admin can edit this game" }
      }

      const [updated] = await db
        .update(games)
        .set({
          title: body.title ?? game.title,
          developer: body.developer ?? game.developer,
          publisher: body.publisher ?? game.publisher,
          description: body.description ?? game.description,
          headerImage: body.headerImage ?? game.headerImage,
          capsuleImage: body.capsuleImage ?? game.capsuleImage,
          storeUrl: body.storeUrl ?? game.storeUrl,
          genres: body.genres ?? game.genres,
          releaseDate: body.releaseDate ?? game.releaseDate,
          updatedAt: new Date(),
        })
        .where(eq(games.id, params.gameId))
        .returning()

      return { game: updated }
    },
    {
      params: t.Object({ gameId: t.String() }),
      body: t.Object({
        title: t.Optional(t.String()),
        developer: t.Optional(t.String()),
        publisher: t.Optional(t.String()),
        description: t.Optional(t.String()),
        headerImage: t.Optional(t.String()),
        capsuleImage: t.Optional(t.String()),
        storeUrl: t.Optional(t.String()),
        genres: t.Optional(t.Array(t.String())),
        releaseDate: t.Optional(t.String()),
      }),
    }
  )
