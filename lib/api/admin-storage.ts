import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import { storageObjects, user, games } from "@/lib/db/schema"
import { eq, sql, and, ilike, desc } from "drizzle-orm"
import { requireAdmin } from "@/lib/auth/guard"
import { deleteObject, isR2Configured } from "@/lib/storage"

export const adminStorageRoutes = new Elysia({ prefix: "/admin/storage", detail: { tags: ["Admin"] } })

  // ── GET /stats ──────────────────────────────────────────────────
  .get(
    "/stats",
    async ({ request, set }) => {
      const guard = await requireAdmin(request.headers)
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const [totalResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(storageObjects)

      const [orphanedResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(storageObjects)
        .where(eq(storageObjects.isOrphaned, true))

      const byEntityType = await db
        .select({
          entityType: storageObjects.entityType,
          count: sql<number>`count(*)::int`,
        })
        .from(storageObjects)
        .groupBy(storageObjects.entityType)

      const [totalSizeResult] = await db
        .select({ total: sql<number>`coalesce(sum(${storageObjects.size}), 0)::int` })
        .from(storageObjects)

      return {
        total: totalResult?.count ?? 0,
        orphaned: orphanedResult?.count ?? 0,
        totalSizeBytes: totalSizeResult?.total ?? 0,
        byEntityType: byEntityType.reduce<Record<string, number>>(
          (acc, row) => {
            acc[row.entityType] = row.count
            return acc
          },
          {},
        ),
      }
    },
  )

  // ── GET /objects ─────────────────────────────────────────────────
  .get(
    "/objects",
    async ({ query, request, set }) => {
      const guard = await requireAdmin(request.headers)
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const limit = Math.min(Number(query.limit) || 20, 100)
      const offset = Number(query.offset) || 0

      const conditions: (ReturnType<typeof eq> | ReturnType<typeof ilike> | ReturnType<typeof and>)[] = []

      if (query.entityType) {
        conditions.push(eq(storageObjects.entityType, query.entityType))
      }

      if (query.orphaned === "true") {
        conditions.push(eq(storageObjects.isOrphaned, true))
      } else if (query.orphaned === "false") {
        conditions.push(eq(storageObjects.isOrphaned, false))
      }

      if (query.search) {
        conditions.push(ilike(storageObjects.key, `%${query.search}%`))
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined

      const baseQuery = db
        .select({
          id: storageObjects.id,
          key: storageObjects.key,
          bucket: storageObjects.bucket,
          size: storageObjects.size,
          mimeType: storageObjects.mimeType,
          entityType: storageObjects.entityType,
          entityId: storageObjects.entityId,
          uploadedBy: storageObjects.uploadedBy,
          createdAt: storageObjects.createdAt,
          lastAccessedAt: storageObjects.lastAccessedAt,
          isOrphaned: storageObjects.isOrphaned,
          uploaderName: user.name,
        })
        .from(storageObjects)
        .innerJoin(user, eq(storageObjects.uploadedBy, user.id))
        .orderBy(desc(storageObjects.createdAt))

      const items = whereClause
        ? await baseQuery.where(whereClause).limit(limit).offset(offset)
        : await baseQuery.limit(limit).offset(offset)

      const countQuery = db
        .select({ count: sql<number>`count(*)::int` })
        .from(storageObjects)
        .innerJoin(user, eq(storageObjects.uploadedBy, user.id))

      const countResult = whereClause
        ? await countQuery.where(whereClause)
        : await countQuery

      const total = countResult[0]?.count ?? 0

      return {
        data: items.map((item) => ({
          ...item,
          createdAt: item.createdAt.toISOString(),
          lastAccessedAt: item.lastAccessedAt?.toISOString() ?? null,
        })),
        total,
        limit,
        offset,
      }
    },
    {
      query: t.Object({
        limit: t.Optional(t.String()),
        offset: t.Optional(t.String()),
        entityType: t.Optional(t.String()),
        orphaned: t.Optional(t.Union([t.Literal("true"), t.Literal("false")])),
        search: t.Optional(t.String()),
      }),
    },
  )

  // ── DELETE /objects/:id ──────────────────────────────────────────
  .delete(
    "/objects/:id",
    async ({ params, request, set }) => {
      const guard = await requireAdmin(request.headers)
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const [obj] = await db
        .select()
        .from(storageObjects)
        .where(eq(storageObjects.id, params.id))
        .limit(1)

      if (!obj) {
        set.status = 404
        return { error: "Storage object not found" }
      }

      // Delete from R2 (best-effort; don't block on R2 failure)
      if (isR2Configured()) {
        try {
          await deleteObject(obj.key)
        } catch {
          console.warn(`Failed to delete object from R2: ${obj.key}`)
        }
      }

      // Clear entity references for known entity types
      if (obj.entityType === "avatar" && obj.entityId) {
        try {
          await db
            .update(user)
            .set({ image: null, updatedAt: new Date() })
            .where(eq(user.id, obj.entityId))
        } catch {
          // User may have been deleted already; skip silently
        }
      } else if (obj.entityType === "game_cover" && obj.entityId) {
        try {
          await db
            .update(games)
            .set({ headerImage: null, updatedAt: new Date() })
            .where(eq(games.id, obj.entityId))
        } catch {
          // Game may have been deleted already; skip silently
        }
      }

      // Delete the DB record
      await db
        .delete(storageObjects)
        .where(eq(storageObjects.id, params.id))

      return { success: true, deleted: { id: obj.id, key: obj.key } }
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // ── POST /cleanup ───────────────────────────────────────────────
  .post(
    "/cleanup",
    async ({ request, set }) => {
      const guard = await requireAdmin(request.headers)
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      if (!isR2Configured()) {
        set.status = 503
        return { error: "Storage (R2) not configured" }
      }

      // 1. Mark orphaned avatars (entityId not in user table)
      const avatarOrphans = await db.execute(sql`
        UPDATE storage_objects
        SET is_orphaned = true
        WHERE entity_type = 'avatar'
        AND is_orphaned = false
        AND entity_id NOT IN (SELECT id FROM "user")
      `)

      // 2. Mark orphaned game covers (entityId not in games table)
      const gameCoverOrphans = await db.execute(sql`
        UPDATE storage_objects
        SET is_orphaned = true
        WHERE entity_type = 'game_cover'
        AND is_orphaned = false
        AND entity_id NOT IN (SELECT id FROM games)
      `)

      // 3. Fetch all now-orphaned objects for deletion
      const orphaned = await db
        .select()
        .from(storageObjects)
        .where(eq(storageObjects.isOrphaned, true))

      let deletedFromR2 = 0
      let r2Errors = 0

      // 4. Delete from R2 in batches of 50
      for (let i = 0; i < orphaned.length; i += 50) {
        const batch = orphaned.slice(i, i + 50)
        const results = await Promise.allSettled(
          batch.map(async (obj) => {
            await deleteObject(obj.key)
          }),
        )
        for (const result of results) {
          if (result.status === "fulfilled") {
            deletedFromR2++
          } else {
            r2Errors++
          }
        }
      }

      // 5. Clear entity references for orphaned objects that still reference entities
      // (These are orphans where the entity was deleted but reference wasn't cleared)
      const orphanedAvatars = orphaned.filter((o) => o.entityType === "avatar" && o.entityId)
      const orphanedGameCovers = orphaned.filter((o) => o.entityType === "game_cover" && o.entityId)

      // Clear avatar references
      if (orphanedAvatars.length > 0) {
        const avatarEntityIds = [...new Set(orphanedAvatars.map((o) => o.entityId!))]
        // Only clear for users that still exist
        for (const userId of avatarEntityIds) {
          try {
            await db
              .update(user)
              .set({ image: null, updatedAt: new Date() })
              .where(eq(user.id, userId))
          } catch {
            // User may not exist; skip
          }
        }
      }

      // Clear game cover references
      if (orphanedGameCovers.length > 0) {
        const gameIds = [...new Set(orphanedGameCovers.map((o) => o.entityId!))]
        for (const gameId of gameIds) {
          try {
            await db
              .update(games)
              .set({ headerImage: null, updatedAt: new Date() })
              .where(eq(games.id, gameId))
          } catch {
            // Game may not exist; skip
          }
        }
      }

      // 6. Delete DB records
      if (orphaned.length > 0) {
        await db
          .delete(storageObjects)
          .where(eq(storageObjects.isOrphaned, true))
      }

      return {
        success: true,
        marked: {
          avatars: avatarOrphans.rowCount ?? 0,
          gameCovers: gameCoverOrphans.rowCount ?? 0,
        },
        deleted: {
          fromR2: deletedFromR2,
          r2Errors,
          fromDb: orphaned.length,
        },
      }
    },
  )