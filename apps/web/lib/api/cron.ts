import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import { storageObjects } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"
import { deleteObject, isR2Configured } from "@/lib/storage"

// ── Task Result Type ────────────────────────────────────────────────
interface CronTaskResult {
  name: string
  status: "success" | "skipped" | "error"
  durationMs: number
  details: Record<string, unknown>
}

// ── Task Registry ───────────────────────────────────────────────────
type CronTask = () => Promise<CronTaskResult>

export const taskRegistry = new Map<string, CronTask>()

export function registerCronTask(name: string, task: CronTask): void {
  taskRegistry.set(name, task)
}

// ── Storage Cleanup Task ────────────────────────────────────────────
registerCronTask("storage_cleanup", async () => {
  const start = Date.now()
  const details: Record<string, unknown> = {}

  if (!isR2Configured()) {
    return { name: "storage_cleanup", status: "skipped" as const, durationMs: Date.now() - start, details: { reason: "R2 not configured" } }
  }

  try {
    // Find orphaned storage objects
    const orphaned = await db
      .select()
      .from(storageObjects)
      .where(eq(storageObjects.isOrphaned, true))

    let deletedCount = 0
    let errorCount = 0

    // Process in batches of 100
    for (let i = 0; i < orphaned.length; i += 100) {
      const batch = orphaned.slice(i, i + 100)
      await Promise.allSettled(
        batch.map(async (obj) => {
          try {
            await deleteObject(obj.key)
            deletedCount++
          } catch {
            errorCount++
          }
        }),
      )
    }

    // Remove deleted objects from tracking table
    if (orphaned.length > 0) {
      await db
        .delete(storageObjects)
        .where(eq(storageObjects.isOrphaned, true))
    }

    details.deletedCount = deletedCount
    details.errorCount = errorCount
    details.totalOrphans = orphaned.length

    return { name: "storage_cleanup", status: "success" as const, durationMs: Date.now() - start, details }
  } catch (err) {
    details.error = err instanceof Error ? err.message : String(err)
    return { name: "storage_cleanup", status: "error" as const, durationMs: Date.now() - start, details }
  }
})

// ── Orphan Detection (separate task for future extensibility) ──────
// This marks objects as orphaned based on their entityType/entityId references
registerCronTask("orphan_detection", async () => {
  const start = Date.now()
  const details: Record<string, unknown> = {}

  try {
    // Avatar orphans: storage_objects with entityType='avatar' where user doesn't exist
    // or user.image doesn't contain this object's key
    const avatarOrphans = await db.execute(sql`
      UPDATE storage_objects
      SET is_orphaned = true
      WHERE entity_type = 'avatar'
      AND is_orphaned = false
      AND entity_id NOT IN (SELECT id FROM "user")
    `)

    details.avatarOrphansMarked = avatarOrphans.rowCount ?? 0

    // Game cover orphans: storage_objects with entityType='game_cover' where game doesn't exist
    const gameOrphans = await db.execute(sql`
      UPDATE storage_objects
      SET is_orphaned = true
      WHERE entity_type = 'game_cover'
      AND is_orphaned = false
      AND entity_id NOT IN (SELECT id FROM games)
    `)

    details.gameCoverOrphansMarked = gameOrphans.rowCount ?? 0

    return { name: "orphan_detection", status: "success" as const, durationMs: Date.now() - start, details }
  } catch (err) {
    details.error = err instanceof Error ? err.message : String(err)
    return { name: "orphan_detection", status: "error" as const, durationMs: Date.now() - start, details }
  }
})

// ── Cron Route ──────────────────────────────────────────────────────
export const cronRoutes = new Elysia({ prefix: "/cron", detail: { tags: ["Cron"] } }).post(
  "/daily",
  async ({ query, set }) => {
    const cronSecret = process.env.CRON_SECRET

    // If CRON_SECRET is not configured, disable the endpoint
    if (!cronSecret) {
      set.status = 404
      return { error: "Cron endpoint not configured" }
    }

    // Validate cron secret from query parameter
    if (query.secret !== cronSecret) {
      set.status = 401
      return { error: "Unauthorized" }
    }

    const overallStart = Date.now()

    // Determine which tasks to run
    const taskNames = query.tasks
      ? query.tasks.split(",").filter((t) => taskRegistry.has(t))
      : Array.from(taskRegistry.keys())

    const results: CronTaskResult[] = []

    for (const taskName of taskNames) {
      const task = taskRegistry.get(taskName)
      if (task) {
        const result = await task()
        results.push(result)
      }
    }

    const overallDuration = Date.now() - overallStart

    return {
      success: true,
      duration: overallDuration,
      tasks: results,
    }
  },
  {
    query: t.Object({
      secret: t.String(),
      tasks: t.Optional(t.String()),
    }),
  },
)