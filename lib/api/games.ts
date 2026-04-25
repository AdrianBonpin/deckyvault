import { Elysia, t } from "elysia"
import { createCrudRoutes } from "./crud-builder"
import { games, gameVersions } from "@/lib/db/schema"
import { db } from "@/lib/db/index"
import { eq, and, desc, sql } from "drizzle-orm"
import { requireRole } from "@/lib/auth/guard"

// ── Games CRUD (uses builder) ─────────────────────────────────────
export const gamesRoutes = createCrudRoutes(games, {
  prefix: "/games",
  name: "Game",
  auth: { read: "public", write: "contributor", delete: "admin" },
  search: { fields: ["title", "developer", "publisher"] },
  filter: { fields: ["source", "onlineMultiplayerStatus", "syncStatus"] },
})

// ── Game Versions (nested under /games/:gameId/versions) ──────────
export const gameVersionsRoutes = new Elysia({ prefix: "/games/:gameId/versions" })
  // LIST versions for a game
  .get(
    "/",
    async ({ params, query }) => {
      const limit = Math.min(Number(query.limit) || 20, 100)
      const offset = Number(query.offset) || 0

      const data = await db
        .select()
        .from(gameVersions)
        .where(eq(gameVersions.gameId, params.gameId))
        .orderBy(desc(gameVersions.createdAt))
        .limit(limit)
        .offset(offset)

      const [{ count }] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(gameVersions)
        .where(eq(gameVersions.gameId, params.gameId))

      return { data, total: count, limit, offset }
    },
    {
      params: t.Object({ gameId: t.String() }),
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
      }),
    },
  )
  // GET single version
  .get(
    "/:id",
    async ({ params, set }) => {
      const [version] = await db
        .select()
        .from(gameVersions)
        .where(
          and(
            eq(gameVersions.id, params.id),
            eq(gameVersions.gameId, params.gameId),
          ),
        )
        .limit(1)

      if (!version) {
        set.status = 404
        return { error: "Version not found" }
      }

      return version
    },
    {
      params: t.Object({ gameId: t.String(), id: t.String() }),
    },
  )
  // CREATE version (contributor+ only)
  .post(
    "/",
    async ({ params, body, request, set }) => {
      const guard = await requireRole(request.headers, [
        "contributor",
        "admin",
      ])
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      // Verify game exists
      const [game] = await db
        .select({ id: games.id })
        .from(games)
        .where(eq(games.id, params.gameId))
        .limit(1)

      if (!game) {
        set.status = 404
        return { error: "Game not found" }
      }

      const [created] = await db
        .insert(gameVersions)
        .values({ ...body, gameId: params.gameId })
        .returning()

      set.status = 201
      return created
    },
    {
      params: t.Object({ gameId: t.String() }),
      body: t.Object({
        buildId: t.Optional(t.String()),
        versionString: t.Optional(t.String()),
        isLatest: t.Optional(t.Boolean()),
      }),
    },
  )
  // UPDATE version
  .patch(
    "/:id",
    async ({ params, body, request, set }) => {
      const guard = await requireRole(request.headers, [
        "contributor",
        "admin",
      ])
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const [updated] = await db
        .update(gameVersions)
        .set(body)
        .where(
          and(
            eq(gameVersions.id, params.id),
            eq(gameVersions.gameId, params.gameId),
          ),
        )
        .returning()

      if (!updated) {
        set.status = 404
        return { error: "Version not found" }
      }

      return updated
    },
    {
      params: t.Object({ gameId: t.String(), id: t.String() }),
      body: t.Object({
        buildId: t.Optional(t.String()),
        versionString: t.Optional(t.String()),
        isLatest: t.Optional(t.Boolean()),
      }),
    },
  )
  // DELETE version (admin only)
  .delete(
    "/:id",
    async ({ params, request, set }) => {
      const guard = await requireRole(request.headers, ["admin"])
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const [deleted] = await db
        .delete(gameVersions)
        .where(
          and(
            eq(gameVersions.id, params.id),
            eq(gameVersions.gameId, params.gameId),
          ),
        )
        .returning()

      if (!deleted) {
        set.status = 404
        return { error: "Version not found" }
      }

      return { success: true }
    },
    {
      params: t.Object({ gameId: t.String(), id: t.String() }),
    },
  )
