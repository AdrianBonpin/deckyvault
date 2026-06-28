import { Elysia, t } from "elysia"
import { createCrudRoutes } from "./crud-builder"
import { performanceEntries, games, gameVersions, hardware, user, gamePlatformSupport, entryScreenshots, storageObjects } from "@/lib/db/schema"
import { db } from "@/lib/db/index"
import { eq, and, desc, sql } from "drizzle-orm"
import { requireRole } from "@/lib/auth/guard"
import { checkAndAutoPin } from "./auto-pin"
import { uploadObject, deleteObject, isR2Configured } from "@/lib/storage/r2-client"
import { processScreenshot, isAllowedMimeType, validateMagicBytes } from "@/lib/image-processing"

const MAX_SCREENSHOTS_PER_ENTRY = 2
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024 // 10 MB

// ── Performance Entries CRUD ──────────────────────────────────────
export const performanceRoutes = createCrudRoutes(performanceEntries, {
  prefix: "/performance",
  name: "Performance Entry",
  tags: ["Performance"],
  auth: { read: "public", write: "user", delete: "admin" },
  softDelete: true,
  search: { fields: ["userNotes"] },
  filter: { fields: ["hardwareSlug", "upscalerType", "upscalerVersion", "frameGenMethod"] },
})

// ── Verify endpoint (admin/mod) ───────────────────────────────────
export const performanceVerifyRoutes = new Elysia({
  prefix: "/performance",
  detail: { tags: ["Performance"] },
})
  .post(
    "/:id/verify",
    async ({ params, request, set }) => {
      const guard = await requireRole(request.headers, ["contributor", "admin"])
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const [entry] = await db
        .select()
        .from(performanceEntries)
        .where(eq(performanceEntries.id, params.id))
        .limit(1)

      if (!entry) {
        set.status = 404
        return { error: "Performance entry not found" }
      }

      if (entry.verifiedAt) {
        set.status = 409
        return { error: "Entry already verified" }
      }

      const [updated] = await db
        .update(performanceEntries)
        .set({
          verifiedAt: new Date(),
          verifiedBy: guard.user.id,
          updatedAt: new Date(),
        })
        .where(eq(performanceEntries.id, params.id))
        .returning()

      return updated
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  // ── Upvote ────────────────────────────────────────────────────────
  .post(
    "/:id/upvote",
    async ({ params, request, set }) => {
      const guard = await requireRole(request.headers, [
        "user",
        "contributor",
        "admin",
      ])
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const [updated] = await db
        .update(performanceEntries)
        .set({
          upvotes: sql`${performanceEntries.upvotes} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(performanceEntries.id, params.id),
            eq(performanceEntries.isRemoved, false),
          ),
        )
        .returning()

      if (!updated) {
        set.status = 404
        return { error: "Performance entry not found" }
      }

      // Auto-pin check (fire and forget, result doesn't affect response)
      checkAndAutoPin(updated.id).catch((err) =>
        console.error("Auto-pin check failed:", err),
      )

      return updated
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  // ── Downvote ──────────────────────────────────────────────────────
  .post(
    "/:id/downvote",
    async ({ params, request, set }) => {
      const guard = await requireRole(request.headers, [
        "user",
        "contributor",
        "admin",
      ])
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const [updated] = await db
        .update(performanceEntries)
        .set({
          downvotes: sql`${performanceEntries.downvotes} + 1`,
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(performanceEntries.id, params.id),
            eq(performanceEntries.isRemoved, false),
          ),
        )
        .returning()

      if (!updated) {
        set.status = 404
        return { error: "Performance entry not found" }
      }

      // Auto-pin check (fire and forget, result doesn't affect response)
      checkAndAutoPin(updated.id).catch((err) =>
        console.error("Auto-pin check failed:", err),
      )

      return updated
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  // ── Pin a preset (admin only) ──────────────────────────────────────
  .post(
    "/:id/pin",
    async ({ request, params, set }) => {
      const guard = await requireRole(request.headers, ["admin"])
      if (!guard.ok) { set.status = guard.status; return { error: guard.error } }

      const [entry] = await db
        .update(performanceEntries)
        .set({ isPinned: true, pinnedAt: new Date() })
        .where(eq(performanceEntries.id, params.id))
        .returning()

      if (!entry) { set.status = 404; return { error: "Entry not found" } }
      return { entry }
    },
    { params: t.Object({ id: t.String() }) },
  )
  // ── Unpin a preset (admin only) ────────────────────────────────────
  .delete(
    "/:id/pin",
    async ({ request, params, set }) => {
      const guard = await requireRole(request.headers, ["admin"])
      if (!guard.ok) { set.status = guard.status; return { error: guard.error } }

      const [entry] = await db
        .update(performanceEntries)
        .set({ isPinned: false, pinnedAt: null })
        .where(eq(performanceEntries.id, params.id))
        .returning()

      if (!entry) { set.status = 404; return { error: "Entry not found" } }
      return { entry }
    },
    { params: t.Object({ id: t.String() }) },
  )
  // ── User-scoped soft delete (owner or admin) ────────────────────
  .delete(
    "/:id/user-delete",
    async ({ params, body, request, set }) => {
      const guard = await requireRole(request.headers, [
        "user",
        "contributor",
        "admin",
      ])
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const [entry] = await db
        .select({
          id: performanceEntries.id,
          userId: performanceEntries.userId,
        })
        .from(performanceEntries)
        .where(eq(performanceEntries.id, params.id))
        .limit(1)

      if (!entry) {
        set.status = 404
        return { error: "Performance entry not found" }
      }

      if (entry.userId !== guard.user.id && guard.user.role !== "admin") {
        set.status = 403
        return { error: "Not authorized to delete this entry" }
      }

      const reason = body?.reason as string | undefined

      const [updated] = await db
        .update(performanceEntries)
        .set({
          isRemoved: true,
          removedReason: reason ?? "User deleted",
          updatedAt: new Date(),
        })
        .where(eq(performanceEntries.id, params.id))
        .returning()

      if (!updated) {
        set.status = 404
        return { error: "Performance entry not found" }
      }

      return { success: true }
    },
    {
      params: t.Object({ id: t.String() }),
      body: t.Optional(t.Object({ reason: t.Optional(t.String()) })),
    },
  )
  // ── Edit entry (owner or admin) ───────────────────────────────────
  .patch(
    "/:id/edit",
    async ({ params, request, set }) => {
      const guard = await requireRole(request.headers, [
        "user",
        "contributor",
        "admin",
      ])
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      const [entry] = await db
        .select({
          id: performanceEntries.id,
          userId: performanceEntries.userId,
        })
        .from(performanceEntries)
        .where(eq(performanceEntries.id, params.id))
        .limit(1)

      if (!entry) {
        set.status = 404
        return { error: "Performance entry not found" }
      }

      if (entry.userId !== guard.user.id && guard.user.role !== "admin") {
        set.status = 403
        return { error: "Not authorized to edit this entry" }
      }

      // Parse multipart/form-data
      let formData: FormData
      try {
        formData = await request.formData()
      } catch {
        set.status = 400
        return { error: "Invalid multipart/form-data" }
      }

      // Extract and parse the JSON payload field
      const payloadStr = formData.get("payload")
      if (!payloadStr || typeof payloadStr !== "string") {
        set.status = 400
        return { error: "Missing or invalid payload field" }
      }

      let payload: Record<string, unknown>
      try {
        payload = JSON.parse(payloadStr)
      } catch {
        set.status = 400
        return { error: "Invalid JSON in payload field" }
      }

      // Extract screenshot files
      const screenshotFiles = formData.getAll("screenshots").filter((f): f is File => f instanceof File)

      // ── Process new screenshots with sharp BEFORE any DB changes ──
      const processedScreenshots: Array<{
        buffer: Buffer
        width: number
        height: number
        mimeType: string
        size: number
        originalName: string | null
      }> = []

      if (screenshotFiles.length > MAX_SCREENSHOTS_PER_ENTRY) {
        set.status = 400
        return { error: `Maximum ${MAX_SCREENSHOTS_PER_ENTRY} screenshots allowed` }
      }

      for (const file of screenshotFiles) {
        if (file.size > MAX_UPLOAD_SIZE) {
          set.status = 400
          return { error: `Screenshot "${file.name}" exceeds 10 MB limit` }
        }

        if (!isAllowedMimeType(file.type)) {
          set.status = 400
          return { error: `Screenshot "${file.name}" has unsupported MIME type: ${file.type}` }
        }

        const arrayBuffer = await file.arrayBuffer()
        const rawBuffer = Buffer.from(arrayBuffer)

        if (!validateMagicBytes(rawBuffer, file.type)) {
          set.status = 400
          return { error: `Screenshot "${file.name}" content does not match declared type` }
        }

        try {
          const processed = await processScreenshot(rawBuffer, file.type)
          processedScreenshots.push({
            ...processed,
            originalName: file.name || null,
          })
        } catch (err) {
          set.status = 400
          return { error: `Failed to process screenshot "${file.name}": ${err instanceof Error ? err.message : "Unknown error"}` }
        }
      }

      // ── Build updateData from payload ────────────────────────────────
      const updateData: Partial<typeof performanceEntries.$inferInsert> = {
        updatedAt: new Date(),
      }

      if (payload.fpsAvg !== undefined) updateData.fpsAvg = payload.fpsAvg as number | undefined
      if (payload.fpsOnePercentLow !== undefined) updateData.fpsOnePercentLow = payload.fpsOnePercentLow as number | undefined
      if (payload.fpsLow !== undefined) updateData.fpsLow = payload.fpsLow as number | undefined
      if (payload.fpsHigh !== undefined) updateData.fpsHigh = payload.fpsHigh as number | undefined
      if (payload.protonVersion !== undefined)
        updateData.protonVersion = payload.protonVersion as string | null
      if (payload.osVersion !== undefined)
        updateData.osVersion = payload.osVersion as string | null
      if (payload.upscalerType !== undefined)
        updateData.upscalerType = (payload.upscalerType as "none" | "fsr" | "dlss" | "xess" | "lsfg" | "other" | null) ?? "none"
      if (payload.upscalerVersion !== undefined)
        updateData.upscalerVersion = payload.upscalerVersion as string | null
      if (payload.frameGenMethod !== undefined)
        updateData.frameGenMethod = (payload.frameGenMethod as "none" | "fsr_fg" | "dlss_fg" | "lsfg" | "other" | null) ?? "none"
      if (payload.launchOptions !== undefined)
        updateData.launchOptions = payload.launchOptions as string | null
      if (payload.settingsJson !== undefined)
        updateData.settingsJson = payload.settingsJson as typeof performanceEntries.$inferInsert["settingsJson"]
      if (payload.userNotes !== undefined)
        updateData.userNotes = payload.userNotes as string | null
      if (payload.tdpWatts !== undefined) updateData.tdpWatts = payload.tdpWatts as number | undefined
      if (payload.youtubeVideoId !== undefined) {
        const ytIdRaw = payload.youtubeVideoId as string | null
        if (ytIdRaw !== null) {
          const ytId = ytIdRaw.trim()
          if (!/^[a-zA-Z0-9_-]{11}$/.test(ytId)) {
            set.status = 400
            return { error: "Invalid YouTube video ID format" }
          }
          updateData.youtubeVideoId = ytId
        } else {
          updateData.youtubeVideoId = null
        }
      }

      // ── Update the performance entry ──────────────────────────────────
      const [updated] = await db
        .update(performanceEntries)
        .set(updateData)
        .where(eq(performanceEntries.id, params.id))
        .returning()

      // ── Remove screenshots marked for deletion ────────────────────────
      const removedIds: string[] = (Array.isArray(payload.removedScreenshotIds)
        ? payload.removedScreenshotIds.filter((id: unknown) => typeof id === "string" && id.length > 0)
        : [])

      if (removedIds.length > 0) {
        // Fetch storage keys before deleting rows
        const toRemove = await db
          .select({ id: entryScreenshots.id, storageKey: entryScreenshots.storageKey })
          .from(entryScreenshots)
          .where(
            and(
              eq(entryScreenshots.entryId, params.id),
              sql`${entryScreenshots.id} = ANY(${removedIds})`,
            ),
          )

        for (const ss of toRemove) {
          try { await deleteObject(ss.storageKey) } catch { /* best-effort */ }
          try {
            await db.delete(storageObjects).where(eq(storageObjects.key, ss.storageKey))
          } catch { /* best-effort */ }
        }

        // Delete the screenshot rows
        if (toRemove.length > 0) {
          await db.delete(entryScreenshots).where(
            sql`${entryScreenshots.id} = ANY(${toRemove.map((s) => s.id)})`,
          )
        }
      }

      // ── Atomic screenshot replacement ─────────────────────────────────
      if (screenshotFiles.length > 0) {
        // a. Upload all new screenshots to R2 FIRST (before deleting old ones)
        const uploadedKeys: string[] = []
        const uploadedStorageIds: string[] = []
        const uploadedScreenshotIds: string[] = []

        let uploadFailed = false
        let uploadError = ""

        for (let i = 0; i < processedScreenshots.length; i++) {
          const shot = processedScreenshots[i]
          const r2Key = `screenshots/${entry.id}/${crypto.randomUUID()}.jpg`

          try {
            if (!isR2Configured()) {
              throw new Error("R2 storage is not configured")
            }
            await uploadObject(r2Key, shot.buffer, shot.mimeType, {
              entryId: entry.id,
              orderIndex: String(i),
            })
            uploadedKeys.push(r2Key)

            // Insert into storageObjects
            const [storageObj] = await db
              .insert(storageObjects)
              .values({
                key: r2Key,
                bucket: "deckyvault",
                size: shot.size,
                mimeType: shot.mimeType,
                entityType: "entry_screenshot",
                entityId: entry.id,
                uploadedBy: guard.user.id,
              })
              .returning()
            uploadedStorageIds.push(storageObj.id)

            // Insert into entryScreenshots
            const [screenshotRow] = await db
              .insert(entryScreenshots)
              .values({
                entryId: entry.id,
                storageKey: r2Key,
                orderIndex: i,
                mimeType: shot.mimeType,
                width: shot.width,
                height: shot.height,
                originalName: shot.originalName,
              })
              .returning()
            uploadedScreenshotIds.push(screenshotRow.id)
          } catch (err) {
            uploadFailed = true
            uploadError = err instanceof Error ? err.message : "Upload failed"
            break
          }
        }

        if (uploadFailed) {
          // Roll back: delete just-uploaded R2 objects, storageObjects rows, entryScreenshots rows
          for (const key of uploadedKeys) {
            try { await deleteObject(key) } catch { /* best-effort */ }
          }
          for (const id of uploadedStorageIds) {
            try { await db.delete(storageObjects).where(eq(storageObjects.id, id)) } catch { /* best-effort */ }
          }
          for (const id of uploadedScreenshotIds) {
            try { await db.delete(entryScreenshots).where(eq(entryScreenshots.id, id)) } catch { /* best-effort */ }
          }

          set.status = 500
          return { error: `Screenshot upload failed: ${uploadError}` }
        }

        // b. All new uploads succeeded — now safe to delete old screenshots
        const oldScreenshots = await db
          .select()
          .from(entryScreenshots)
          .where(eq(entryScreenshots.entryId, entry.id))

        for (const old of oldScreenshots) {
          // Skip any that were just uploaded (shouldn't overlap, but safety check)
          if (uploadedScreenshotIds.includes(old.id)) continue

          try { await deleteObject(old.storageKey) } catch { /* best-effort R2 delete */ }
          try { await db.delete(storageObjects).where(eq(storageObjects.key, old.storageKey)) } catch { /* best-effort */ }
        }

        // Delete old entryScreenshots rows (excluding newly inserted ones)
        if (oldScreenshots.length > 0) {
          const oldIds = oldScreenshots
            .filter((s) => !uploadedScreenshotIds.includes(s.id))
            .map((s) => s.id)
          if (oldIds.length > 0) {
            await db.delete(entryScreenshots).where(
              sql`${entryScreenshots.id} = ANY(${oldIds})`
            )
          }
        }
      }

      // ── Update gamePlatformSupport anti-cheat info if provided ──────
      if (
        payload.antiCheatRelevant !== undefined ||
        payload.antiCheatName !== undefined ||
        payload.antiCheatStatus !== undefined
      ) {
        // Need versionId to resolve gameId
        const [entryVersion] = await db
          .select({ versionId: performanceEntries.versionId })
          .from(performanceEntries)
          .where(eq(performanceEntries.id, params.id))
          .limit(1)

        if (entryVersion) {
          const [gv] = await db
            .select({ gameId: gameVersions.gameId })
            .from(gameVersions)
            .where(eq(gameVersions.id, entryVersion.versionId))
            .limit(1)

          if (gv) {
            const [existingSupport] = await db
              .select()
              .from(gamePlatformSupport)
              .where(
                and(
                  eq(gamePlatformSupport.gameId, gv.gameId),
                  eq(gamePlatformSupport.hardwareSlug, updated.hardwareSlug),
                ),
              )
              .limit(1)

            if (existingSupport) {
              await db
                .update(gamePlatformSupport)
                .set({
                  antiCheatRelevant:
                    payload.antiCheatRelevant !== undefined
                      ? (payload.antiCheatRelevant as boolean)
                      : existingSupport.antiCheatRelevant,
                  antiCheatName:
                    payload.antiCheatName !== undefined
                      ? (payload.antiCheatName as string | null)
                      : existingSupport.antiCheatName,
                  antiCheatStatus:
                    payload.antiCheatStatus !== undefined
                      ? ((payload.antiCheatStatus ?? "unknown") as "none" | "supported" | "unsupported" | "unknown")
                      : existingSupport.antiCheatStatus,
                  updatedAt: new Date(),
                })
                .where(eq(gamePlatformSupport.id, existingSupport.id))
            } else {
              await db.insert(gamePlatformSupport).values({
                gameId: gv.gameId,
                hardwareSlug: updated.hardwareSlug,
                isSupported: true,
                protonStatus: "unknown",
                antiCheatRelevant: (payload.antiCheatRelevant as boolean) ?? false,
                antiCheatName: (payload.antiCheatName as string | null) ?? null,
                antiCheatStatus: (payload.antiCheatStatus ?? "unknown") as "none" | "supported" | "unsupported" | "unknown",
                playabilityStatus: "unknown",
              })
            }
          }
        }
      }

      return updated
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )
  // ── Best entry: highest-rated for latest version ──────────────────
  .get(
    "/best",
    async ({ query, set }) => {
      const { gameId, hardwareSlug } = query as {
        gameId?: string
        hardwareSlug?: string
      }

      if (!gameId) {
        set.status = 400
        return { error: "gameId query parameter is required" }
      }

      // Find the latest version for this game
      const [latestVersion] = await db
        .select()
        .from(gameVersions)
        .where(
          and(eq(gameVersions.gameId, gameId), eq(gameVersions.isLatest, true)),
        )
        .limit(1)

      if (!latestVersion) {
        set.status = 404
        return { error: "No versions found for this game" }
      }

      const conditions = [
        eq(performanceEntries.versionId, latestVersion.id),
        eq(performanceEntries.isRemoved, false),
      ]

      if (hardwareSlug) {
        conditions.push(eq(performanceEntries.hardwareSlug, hardwareSlug))
      }

      const [bestEntry] = await db
        .select({
          id: performanceEntries.id,
          versionId: performanceEntries.versionId,
          hardwareSlug: performanceEntries.hardwareSlug,
          fpsAvg: performanceEntries.fpsAvg,
          fpsLow: performanceEntries.fpsLow,
          fpsHigh: performanceEntries.fpsHigh,
          upscalerType: performanceEntries.upscalerType,
          upscalerVersion: performanceEntries.upscalerVersion,
          frameGenMethod: performanceEntries.frameGenMethod,
          settingsJson: performanceEntries.settingsJson,
          userNotes: performanceEntries.userNotes,
          upvotes: performanceEntries.upvotes,
          downvotes: performanceEntries.downvotes,
          verifiedAt: performanceEntries.verifiedAt,
          createdAt: performanceEntries.createdAt,
          userName: user.name,
          userImage: user.image,
          hardwareName: hardware.name,
          versionString: gameVersions.versionString,
        })
        .from(performanceEntries)
        .innerJoin(user, eq(performanceEntries.userId, user.id))
        .innerJoin(hardware, eq(performanceEntries.hardwareSlug, hardware.slug))
        .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
        .where(and(...conditions))
        .orderBy(
          desc(
            sql`${performanceEntries.upvotes} - ${performanceEntries.downvotes}`,
          ),
          desc(performanceEntries.upvotes),
        )
        .limit(1)

      if (!bestEntry) {
        set.status = 404
        return { error: "No performance entries found" }
      }

      return bestEntry
    },
    {
      query: t.Object({
        gameId: t.String(),
        hardwareSlug: t.Optional(t.String()),
      }),
    },
  )
  // ── Stats endpoint: aggregated performance for a game+hardware combo ──
  .get(
    "/stats",
    async ({ query, set }) => {
      const { gameId, hardwareSlug, upscalerType, upscalerVersion } = query as {
        gameId?: string
        hardwareSlug?: string
        upscalerType?: string
        upscalerVersion?: string
      }

      if (!gameId) {
        set.status = 400
        return { error: "gameId query parameter is required" }
      }

      const conditions = [
        eq(games.id, gameId),
        eq(performanceEntries.isRemoved, false),
      ]

      if (hardwareSlug) {
        conditions.push(eq(performanceEntries.hardwareSlug, hardwareSlug))
      }
      if (upscalerType) {
        conditions.push(eq(performanceEntries.upscalerType, upscalerType as any)) // eslint-disable-line @typescript-eslint/no-explicit-any
      }
      if (upscalerVersion) {
        conditions.push(eq(performanceEntries.upscalerVersion, upscalerVersion))
      }

      // Join through gameVersions to get to games
      const stats = await db
        .select({
          count: sql<number>`count(*)::int`,
          fpsAvg: sql<number>`avg(${performanceEntries.fpsAvg})::real`,
          fpsLow: sql<number>`percentile_cont(0.1) within group (order by ${performanceEntries.fpsAvg})::real`,
          fpsHigh: sql<number>`percentile_cont(0.9) within group (order by ${performanceEntries.fpsAvg})::real`,
        })
        .from(performanceEntries)
        .innerJoin(
          gameVersions,
          eq(performanceEntries.versionId, gameVersions.id),
        )
        .innerJoin(games, eq(gameVersions.gameId, games.id))
        .where(and(...conditions))

      return stats[0] ?? { count: 0, fpsAvg: null, fpsLow: null, fpsHigh: null }
    },
    {
      query: t.Object({
        gameId: t.String(),
        hardwareSlug: t.Optional(t.String()),
        upscalerType: t.Optional(t.String()),
        upscalerVersion: t.Optional(t.String()),
      }),
    },
  )
