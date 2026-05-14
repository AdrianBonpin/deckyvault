import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import { performanceEntries, entryScreenshots, storageObjects } from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"
import { requireRole } from "@/lib/auth/guard"
import { uploadObject, deleteObject, getR2PublicUrl, isR2Configured } from "@/lib/storage"
import { processScreenshot, isAllowedMimeType } from "@/lib/image-processing"

const MAX_SCREENSHOTS_PER_ENTRY = 2
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024 // 10 MB raw

export const screenshotRoutes = new Elysia({ prefix: "/performance", detail: { tags: ["Performance"] } })

  // ── Upload screenshots ─────────────────────────────────────────
  .post(
    "/:id/screenshots",
    async ({ params, request, set }) => {
      const guard = await requireRole(request.headers, ["user", "contributor", "admin"])
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      if (!isR2Configured()) {
        set.status = 503
        return { error: "Storage not configured" }
      }

      // Verify entry exists and user is owner or admin
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
        return { error: "Not authorized to upload screenshots for this entry" }
      }

      // Check existing screenshot count
      const [countResult] = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(entryScreenshots)
        .where(eq(entryScreenshots.entryId, params.id))

      if ((countResult?.count ?? 0) >= MAX_SCREENSHOTS_PER_ENTRY) {
        set.status = 400
        return { error: `Maximum ${MAX_SCREENSHOTS_PER_ENTRY} screenshots per entry` }
      }

      // Parse multipart form data
      const formData = await request.formData()
      const files = formData.getAll("screenshots")

      if (!files || files.length === 0) {
        set.status = 400
        return { error: "No files provided" }
      }

      // Remaining slots
      const remaining = MAX_SCREENSHOTS_PER_ENTRY - (countResult?.count ?? 0)
      const toProcess = files.slice(0, remaining).filter((f): f is File => f instanceof File)

      if (toProcess.length === 0) {
        set.status = 400
        return { error: "No valid files provided or entry already has maximum screenshots" }
      }

      // Get existing max order index
      const [maxOrder] = await db
        .select({ maxIndex: sql<number>`coalesce(max(${entryScreenshots.orderIndex}), -1)` })
        .from(entryScreenshots)
        .where(eq(entryScreenshots.entryId, params.id))

      const startIndex = (maxOrder?.maxIndex ?? -1) + 1

      const results = []

      for (let i = 0; i < toProcess.length; i++) {
        const file = toProcess[i]

        // Validate MIME type
        if (!isAllowedMimeType(file.type)) {
          continue // Skip invalid types
        }

        // Validate file size
        if (file.size > MAX_UPLOAD_SIZE) {
          continue // Skip oversized files
        }

        try {
          const arrayBuffer = await file.arrayBuffer()
          const inputBuffer = Buffer.from(arrayBuffer)

          // Process and compress
          const processed = await processScreenshot(inputBuffer, file.type)

          // Upload to R2
          const storageKey = `screenshots/${params.id}/${crypto.randomUUID()}.jpg`
          const publicUrl = await uploadObject(
            storageKey,
            processed.buffer,
            processed.mimeType,
            { userId: guard.user.id, entityType: "entry_screenshot", entityId: params.id },
          )

          // Track in storage_objects
          await db.insert(storageObjects).values({
            key: storageKey,
            bucket: process.env.R2_BUCKET_NAME ?? "deckyvault",
            size: processed.size,
            mimeType: processed.mimeType,
            entityType: "entry_screenshot",
            entityId: params.id,
            uploadedBy: guard.user.id,
          })

          // Create screenshot record
          const [screenshot] = await db
            .insert(entryScreenshots)
            .values({
              entryId: params.id,
              storageKey,
              orderIndex: startIndex + i,
              mimeType: processed.mimeType,
              width: processed.width,
              height: processed.height,
              originalName: file.name || null,
            })
            .returning()

          results.push({
            id: screenshot.id,
            entryId: screenshot.entryId,
            url: publicUrl,
            orderIndex: screenshot.orderIndex,
            width: processed.width,
            height: processed.height,
          })
        } catch (err) {
          console.error(`Failed to process screenshot ${i}:`, err)
        }
      }

      if (results.length === 0) {
        set.status = 500
        return { error: "Failed to process any screenshots" }
      }

      return { data: results }
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // ── List screenshots ────────────────────────────────────────────
  .get(
    "/:id/screenshots",
    async ({ params }) => {
      const screenshots = await db
        .select({
          id: entryScreenshots.id,
          entryId: entryScreenshots.entryId,
          storageKey: entryScreenshots.storageKey,
          orderIndex: entryScreenshots.orderIndex,
          mimeType: entryScreenshots.mimeType,
          width: entryScreenshots.width,
          height: entryScreenshots.height,
          originalName: entryScreenshots.originalName,
          createdAt: entryScreenshots.createdAt,
        })
        .from(entryScreenshots)
        .where(eq(entryScreenshots.entryId, params.id))
        .orderBy(entryScreenshots.orderIndex)

      const publicUrl = getR2PublicUrl()

      return {
        data: screenshots.map((s) => ({
          ...s,
          url: `${publicUrl}/${s.storageKey}`,
        })),
      }
    },
    {
      params: t.Object({ id: t.String() }),
    },
  )

  // ── Delete screenshot ────────────────────────────────────────────
  .delete(
    "/:id/screenshots/:sid",
    async ({ params, request, set }) => {
      const guard = await requireRole(request.headers, ["user", "contributor", "admin"])
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      // Find the screenshot
      const [screenshot] = await db
        .select()
        .from(entryScreenshots)
        .where(eq(entryScreenshots.id, params.sid))
        .limit(1)

      if (!screenshot) {
        set.status = 404
        return { error: "Screenshot not found" }
      }

      // Verify ownership or admin
      const [entry] = await db
        .select({ userId: performanceEntries.userId })
        .from(performanceEntries)
        .where(eq(performanceEntries.id, screenshot.entryId))
        .limit(1)

      if (entry && entry.userId !== guard.user.id && guard.user.role !== "admin") {
        set.status = 403
        return { error: "Not authorized to delete this screenshot" }
      }

      // Delete from R2
      try {
        await deleteObject(screenshot.storageKey)
      } catch {
        console.warn(`Failed to delete screenshot from R2: ${screenshot.storageKey}`)
      }

      // Delete storage_objects record
      await db
        .delete(storageObjects)
        .where(eq(storageObjects.key, screenshot.storageKey))

      // Delete screenshot record
      await db
        .delete(entryScreenshots)
        .where(eq(entryScreenshots.id, params.sid))

      return { success: true }
    },
    {
      params: t.Object({ id: t.String(), sid: t.String() }),
    },
  )