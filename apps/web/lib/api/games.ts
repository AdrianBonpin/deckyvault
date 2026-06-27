import { Elysia, t } from "elysia"
import { createCrudRoutes } from "./crud-builder"
import { games, gameVersions } from "@/lib/db/schema"
import { db } from "@/lib/db/index"
import { eq, and, or, desc, sql } from "drizzle-orm"
import { syncSteamGame } from "@/lib/steam/sync"
import { requireRole } from "@/lib/auth/guard"

// ── Games CRUD (uses builder) ─────────────────────────────────────
export const gamesRoutes = createCrudRoutes(games, {
  prefix: "/games",
  name: "Game",
  tags: ["Games"],
  auth: { read: "public", write: "contributor", delete: "admin" },
  search: { fields: ["title", "developer", "publisher"] },
  filter: { fields: ["source", "onlineMultiplayerStatus", "syncStatus"] },
  paramName: "gameId",
})

// ── Game Versions (nested under /games/:gameId/versions) ──────────
export const gameVersionsRoutes = new Elysia({
  prefix: "/games/:gameId/versions",
  detail: { tags: ["Games"] },
})
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

// ── Game Sync Routes ────────────────────────────────────────────────
const MAX_BULK_SYNC = 1000


export const gameSyncRoutes = new Elysia({
  prefix: "/games",
  detail: { tags: ["Admin"] },
})
  // Bulk sync with streaming progress (defined before /:gameId/sync to avoid route conflict)
  .post(
    "/sync/bulk",
    async ({ body, request, set }) => {
      const guard = await requireRole(request.headers, ["admin"]);
      if (!guard.ok) {
        set.status = guard.status;
        return { error: guard.error };
      }

      let gamesToSync: { id: string; steamAppId: number | null }[] = [];

      if (body.mode === "all") {
        gamesToSync = await db
          .select({ id: games.id, steamAppId: games.steamAppId })
          .from(games)
          .where(sql`${games.steamAppId} IS NOT NULL`);
      } else if (body.mode === "stale") {
        gamesToSync = await db
          .select({ id: games.id, steamAppId: games.steamAppId })
          .from(games)
          .where(
            and(
              sql`${games.steamAppId} IS NOT NULL`,
              or(
                sql`${games.lastSync} IS NULL`,
                sql`${games.lastSync} < NOW() - INTERVAL '7 days'`
              )
            )
          );
      } else {
        const gameIds = (body.gameIds || []).slice(0, MAX_BULK_SYNC);
        if (gameIds.length > 0) {
          gamesToSync = await db
            .select({ id: games.id, steamAppId: games.steamAppId })
            .from(games)
            .where(
              and(
                sql`${games.steamAppId} IS NOT NULL`,
                sql`${games.id} IN (${sql.join(gameIds.map(id => sql`${id}`), sql`, `)})`
              )
            );
        }
      }

      if (gamesToSync.length === 0) {
        return { total: 0, synced: 0, failed: 0, message: "No games to sync" };
      }

      // Return streaming response for real-time progress
      const encoder = new TextEncoder()
      const stream = new ReadableStream({
        async start(controller) {
          type ProgressEvent = { type: string; current?: number; total: number; synced: number; failed: number; currentGame?: string | null }
          const send = (data: ProgressEvent) => {
            controller.enqueue(encoder.encode(JSON.stringify(data) + "\n"))
          }

          // Send initial progress
          send({ type: "progress", current: 0, total: gamesToSync.length, synced: 0, failed: 0, currentGame: null })

          let synced = 0
          let failed = 0

          // Process syncs sequentially with delay to avoid rate limiting
          for (let i = 0; i < gamesToSync.length; i++) {
            const game = gamesToSync[i]
            if (!game.steamAppId) continue

            try {
              const result = await syncSteamGame(game.steamAppId, { forceRetry: true })
              if (result.success) synced++
              else failed++
            } catch {
              failed++
            }

            // Send progress update
            send({
              type: "progress",
              current: i + 1,
              total: gamesToSync.length,
              synced,
              failed,
              currentGame: null,
            })

            // Delay between syncs to avoid rate limiting (1.5 seconds)
            if (i < gamesToSync.length - 1) {
              await new Promise((resolve) => setTimeout(resolve, 1500))
            }
          }

          // Send completion
          send({ type: "complete", total: gamesToSync.length, synced, failed })
          controller.close()
        }
      })

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      })
    },
    {
      body: t.Object({
        gameIds: t.Optional(t.Array(t.String())),
        mode: t.Union([
          t.Literal("selected"),
          t.Literal("all"),
          t.Literal("stale"),
        ]),
      }),
    }
  )
  // Single game sync
  .post(
    "/:gameId/sync",
    async ({ params, request, set }) => {
      const guard = await requireRole(request.headers, ["admin"]);
      if (!guard.ok) {
        set.status = guard.status;
        return { error: guard.error };
      }

      const [game] = await db
        .select({ id: games.id, steamAppId: games.steamAppId })
        .from(games)
        .where(eq(games.id, params.gameId))
        .limit(1);

      if (!game) {
        set.status = 404;
        return { error: "Game not found" };
      }

      if (!game.steamAppId) {
        set.status = 400;
        return { error: "Game has no Steam App ID" };
      }

      const result = await syncSteamGame(game.steamAppId, { forceRetry: true });
      
      if (!result.success) {
        set.status = 502;
        return { status: "failed", error: result.error };
      }

      return { status: "synced", gameId: params.gameId };
    },
    {
      params: t.Object({ gameId: t.String() }),
    }
  );
