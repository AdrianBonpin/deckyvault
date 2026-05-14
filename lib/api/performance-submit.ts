import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import {
  performanceEntries,
  gameVersions,
  hardware,
  gamePlatformSupport,
  entryScreenshots,
  storageObjects,
} from "@/lib/db/schema"
import type { GameSettingCategory } from "@/lib/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { requireRole } from "@/lib/auth/guard"
import { recalculatePlayability } from "./playability"
import { uploadObject, deleteObject, isR2Configured } from "@/lib/storage/r2-client"
import { processScreenshot, isAllowedMimeType, validateMagicBytes } from "@/lib/image-processing"

const MAX_SCREENSHOTS_PER_ENTRY = 2
const MAX_UPLOAD_SIZE = 10 * 1024 * 1024 // 10 MB

export const performanceSubmitRoutes = new Elysia({ prefix: "/performance", detail: { tags: ["Performance"] } })
  .get(
    "/autocomplete",
    async ({ query }) => {
      const field = query.field

      if (field !== "protonVersion" && field !== "osVersion") {
        return { data: [] }
      }

      const results = await db
        .select({ value: performanceEntries[field] })
        .from(performanceEntries)
        .where(sql`${performanceEntries[field]} IS NOT NULL`)
        .groupBy(performanceEntries[field])
        .orderBy(sql`count(*) DESC`)
        .limit(20)

      return {
        data: results
          .map((r) => r.value)
          .filter((v): v is string => v !== null),
      }
    },
    {
      query: t.Object({
        field: t.Union([
          t.Literal("protonVersion"),
          t.Literal("osVersion"),
        ]),
      }),
    },
  )
  .get(
    "/hardware",
    async () => {
      const devices = await db
        .select({
          slug: hardware.slug,
          name: hardware.name,
          deviceType: hardware.deviceType,
          wattHours: hardware.wattHours,
          tdpMax: hardware.tdpMax,
        })
        .from(hardware)
        .orderBy(hardware.sortOrder)

      return { data: devices }
    },
  )
  .post(
    "/submit",
    async ({ request, set }) => {
      const guard = await requireRole(request.headers, [
        "user",
        "contributor",
        "admin",
      ])
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      // Parse multipart form data
      let formData: FormData
      try {
        formData = await request.formData()
      } catch {
        set.status = 400
        return { error: "Invalid multipart/form-data" }
      }

      // Extract and parse the JSON payload field
      const payloadField = formData.get("payload")
      if (!payloadField || typeof payloadField !== "string") {
        set.status = 400
        return { error: "Missing or invalid payload field" }
      }

      let payload: Record<string, unknown>
      try {
        payload = JSON.parse(payloadField)
      } catch {
        set.status = 400
        return { error: "Invalid JSON in payload field" }
      }

      // Extract fields from payload
      const versionId = payload.versionId as string
      const hardwareSlug = payload.hardwareSlug as string
      const fpsAvg = payload.fpsAvg as number
      const fpsOnePercentLow = (payload.fpsOnePercentLow as number | null | undefined) ?? null
      const fpsLow = (payload.fpsLow as number | null | undefined) ?? null
      const fpsHigh = (payload.fpsHigh as number | null | undefined) ?? null
      const protonVersion = (payload.protonVersion as string | null | undefined) ?? null
      const osVersion = (payload.osVersion as string | null | undefined) ?? null
      const VALID_UPSCALER_TYPES = ["none", "fsr", "dlss", "xess", "lsfg", "other"] as const
      const VALID_FRAME_GEN_METHODS = ["none", "fsr_fg", "dlss_fg", "lsfg", "other"] as const
      const VALID_ANTICHEAT_STATUSES = ["none", "supported", "unsupported", "unknown"] as const
      type UpscalerType = (typeof VALID_UPSCALER_TYPES)[number]
      type FrameGenMethod = (typeof VALID_FRAME_GEN_METHODS)[number]
      type AntiCheatStatus = (typeof VALID_ANTICHEAT_STATUSES)[number]

      const rawUpscalerType = payload.upscalerType as string | undefined
      const upscalerType: UpscalerType = rawUpscalerType && VALID_UPSCALER_TYPES.includes(rawUpscalerType as UpscalerType) ? (rawUpscalerType as UpscalerType) : "none"
      const upscalerVersion = (payload.upscalerVersion as string | null | undefined) ?? null
      const customSystem = (payload.customSystem as boolean | undefined) ?? false
      const rawFrameGenMethod = payload.frameGenMethod as string | undefined
      const frameGenMethod: FrameGenMethod = rawFrameGenMethod && VALID_FRAME_GEN_METHODS.includes(rawFrameGenMethod as FrameGenMethod) ? (rawFrameGenMethod as FrameGenMethod) : "none"
      const loadTimeSsd = (payload.loadTimeSsd as number | null | undefined) ?? null
      const loadTimeSd = (payload.loadTimeSd as number | null | undefined) ?? null
      const tdpWatts = (payload.tdpWatts as number | null | undefined) ?? null
      const youtubeVideoId = (payload.youtubeVideoId as string | null | undefined) ?? null
      const launchOptions = (payload.launchOptions as string | null | undefined) ?? null
      const settingsJson = (payload.settingsJson as GameSettingCategory[] | null | undefined) ?? null
      const userNotes = (payload.userNotes as string | null | undefined) ?? null
      const antiCheatRelevant = (payload.antiCheatRelevant as boolean | undefined) ?? false
      const antiCheatName = (payload.antiCheatName as string | null | undefined) ?? null
      const rawAntiCheatStatus = payload.antiCheatStatus as string | undefined
      const antiCheatStatus: AntiCheatStatus = rawAntiCheatStatus && VALID_ANTICHEAT_STATUSES.includes(rawAntiCheatStatus as AntiCheatStatus) ? (rawAntiCheatStatus as AntiCheatStatus) : "unknown"

      // Validate required fields
      if (!versionId || !hardwareSlug || fpsAvg === undefined || fpsAvg === null) {
        set.status = 400
        return { error: "Missing required fields: versionId, hardwareSlug, fpsAvg" }
      }

      // Verify the game version exists
      const [version] = await db
        .select({ id: gameVersions.id, gameId: gameVersions.gameId })
        .from(gameVersions)
        .where(eq(gameVersions.id, versionId))
        .limit(1)

      if (!version) {
        set.status = 404
        return { error: "Game version not found" }
      }

      // Verify hardware exists
      const [device] = await db
        .select({ slug: hardware.slug })
        .from(hardware)
        .where(eq(hardware.slug, hardwareSlug))
        .limit(1)

      if (!device) {
        set.status = 404
        return { error: "Hardware not found" }
      }

      // Validate YouTube video ID format (11 alphanumeric + dash/underscore)
      if (youtubeVideoId) {
        const ytId = youtubeVideoId.trim()
        if (!/^[a-zA-Z0-9_-]{11}$/.test(ytId)) {
          set.status = 400
          return { error: "Invalid YouTube video ID format (must be 11 characters)" }
        }
      }

      // Validate TDP
      if (tdpWatts !== null && tdpWatts <= 0) {
        set.status = 400
        return { error: "TDP must be greater than 0" }
      }

      // ── Process screenshots ──────────────────────────────────────────
      const screenshotFiles = formData.getAll("screenshots").filter((f): f is File => f instanceof File)

      if (screenshotFiles.length > MAX_SCREENSHOTS_PER_ENTRY) {
        set.status = 400
        return { error: `Maximum ${MAX_SCREENSHOTS_PER_ENTRY} screenshots allowed` }
      }

      // Process all screenshots with sharp BEFORE any DB writes
      const processedScreenshots: Array<{
        buffer: Buffer
        width: number
        height: number
        mimeType: string
        size: number
        originalName: string | null
      }> = []

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

      // ── Create performance entry ────────────────────────────────────
      const [entry] = await db
        .insert(performanceEntries)
        .values({
          versionId,
          hardwareSlug,
          userId: guard.user.id,
          fpsAvg,
          fpsOnePercentLow,
          fpsLow,
          fpsHigh,
          protonVersion,
          osVersion,
          upscalerType,
          upscalerVersion,
          customSystem,
          frameGenMethod,
          loadTimeSsd,
          loadTimeSd,
          tdpWatts,
          youtubeVideoId: youtubeVideoId ? youtubeVideoId.trim() : null,
          launchOptions,
          settingsJson,
          userNotes,
        })
        .returning()

      // ── Upload screenshots to R2 ─────────────────────────────────────
      const uploadedKeys: string[] = []
      const uploadedStorageIds: string[] = []
      const screenshotResults: Array<{
        id: string
        storageKey: string
        url: string
        width: number
        height: number
        mimeType: string
        size: number
        originalName: string | null
        orderIndex: number
      }> = []

      let uploadFailed = false
      let uploadError = ""

      for (let i = 0; i < processedScreenshots.length; i++) {
        const shot = processedScreenshots[i]
        const r2Key = `screenshots/${entry.id}/${crypto.randomUUID()}.jpg`

        try {
          if (!isR2Configured()) {
            throw new Error("R2 storage is not configured")
          }
          const url = await uploadObject(r2Key, shot.buffer, shot.mimeType, {
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

          screenshotResults.push({
            id: screenshotRow.id,
            storageKey: r2Key,
            url,
            width: shot.width,
            height: shot.height,
            mimeType: shot.mimeType,
            size: shot.size,
            originalName: shot.originalName,
            orderIndex: i,
          })
        } catch (err) {
          uploadFailed = true
          uploadError = err instanceof Error ? err.message : "Upload failed"
          break
        }
      }

      // Roll back if any upload failed
      if (uploadFailed) {
        // Delete uploaded R2 objects
        for (const key of uploadedKeys) {
          try {
            await deleteObject(key)
          } catch {
            // Best-effort cleanup
          }
        }

        // Delete storageObjects rows
        for (const id of uploadedStorageIds) {
          try {
            await db.delete(storageObjects).where(eq(storageObjects.id, id))
          } catch {
            // Best-effort cleanup
          }
        }

        // Delete entry screenshots (should cascade, but be explicit)
        try {
          await db.delete(entryScreenshots).where(eq(entryScreenshots.entryId, entry.id))
        } catch {
          // Best-effort cleanup
        }

        // Delete the performance entry
        try {
          await db.delete(performanceEntries).where(eq(performanceEntries.id, entry.id))
        } catch {
          // Best-effort cleanup
        }

        set.status = 500
        return { error: `Screenshot upload failed: ${uploadError}` }
      }

      // ── Update / create gamePlatformSupport ──────────────────────────
      const [existingSupport] = await db
        .select()
        .from(gamePlatformSupport)
        .where(
          and(
            eq(gamePlatformSupport.gameId, version.gameId),
            eq(gamePlatformSupport.hardwareSlug, hardwareSlug),
          ),
        )
        .limit(1)

      if (existingSupport) {
        await db
          .update(gamePlatformSupport)
          .set({
            antiCheatRelevant: antiCheatRelevant ?? existingSupport.antiCheatRelevant,
            antiCheatName: antiCheatRelevant
              ? (antiCheatName ?? existingSupport.antiCheatName)
              : null,
            antiCheatStatus: antiCheatStatus ?? existingSupport.antiCheatStatus,
            updatedAt: new Date(),
          })
          .where(eq(gamePlatformSupport.id, existingSupport.id))
      } else {
        await db.insert(gamePlatformSupport).values({
          gameId: version.gameId,
          hardwareSlug,
          isSupported: true,
          protonStatus: "unknown",
          antiCheatRelevant,
          antiCheatName: antiCheatRelevant ? antiCheatName : null,
          antiCheatStatus,
          playabilityStatus: "unknown",
        })
      }

      // Recalculate playability for this game (fire and forget)
      recalculatePlayability(version.gameId).catch((err) =>
        console.error("Failed to recalculate playability:", err),
      )

      set.status = 201
      return {
        id: entry.id,
        createdAt: entry.createdAt.toISOString(),
        screenshots: screenshotResults,
      }
    },
  )