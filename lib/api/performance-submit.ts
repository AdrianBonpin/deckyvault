import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import {
  performanceEntries,
  gameVersions,
  hardware,
  gamePlatformSupport,
} from "@/lib/db/schema"
import { eq, and, sql } from "drizzle-orm"
import { requireRole } from "@/lib/auth/guard"
import { recalculatePlayability } from "./playability"

export const performanceSubmitRoutes = new Elysia({ prefix: "/performance" })
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
    async ({ request, body, set }) => {
      const guard = await requireRole(request.headers, [
        "user",
        "contributor",
        "admin",
      ])
      if (!guard.ok) {
        set.status = guard.status
        return { error: guard.error }
      }

      // Verify the game version exists
      const [version] = await db
        .select({ id: gameVersions.id, gameId: gameVersions.gameId })
        .from(gameVersions)
        .where(eq(gameVersions.id, body.versionId))
        .limit(1)

      if (!version) {
        set.status = 404
        return { error: "Game version not found" }
      }

      // Verify hardware exists
      const [device] = await db
        .select({ slug: hardware.slug })
        .from(hardware)
        .where(eq(hardware.slug, body.hardwareSlug))
        .limit(1)

      if (!device) {
        set.status = 404
        return { error: "Hardware not found" }
      }

      // Validate YouTube video ID format (11 alphanumeric + dash/underscore)
      if (body.youtubeVideoId) {
        const ytId = body.youtubeVideoId.trim()
        if (!/^[a-zA-Z0-9_-]{11}$/.test(ytId)) {
          set.status = 400
          return { error: "Invalid YouTube video ID format (must be 11 characters)" }
        }
      }

      // Validate TDP
      if (body.tdpWatts !== null && body.tdpWatts !== undefined && body.tdpWatts <= 0) {
        set.status = 400
        return { error: "TDP must be greater than 0" }
      }

      // Create the performance entry
      const [entry] = await db
        .insert(performanceEntries)
        .values({
          versionId: body.versionId,
          hardwareSlug: body.hardwareSlug,
          userId: guard.user.id,
          fpsAvg: body.fpsAvg,
          fpsOnePercentLow: body.fpsOnePercentLow ?? null,
          fpsLow: body.fpsLow ?? null,
          fpsHigh: body.fpsHigh ?? null,
          protonVersion: body.protonVersion ?? null,
          osVersion: body.osVersion ?? null,
          upscalerType: body.upscalerType ?? "none",
          upscalerVersion: body.upscalerVersion ?? null,
          customSystem: body.customSystem ?? false,
          frameGenMethod: body.frameGenMethod ?? "none",
          loadTimeSsd: body.loadTimeSsd ?? null,
          loadTimeSd: body.loadTimeSd ?? null,
          tdpWatts: body.tdpWatts ?? null,
          youtubeVideoId: body.youtubeVideoId
            ? body.youtubeVideoId.trim()
            : null,
          launchOptions: body.launchOptions ?? null,
          settingsJson: body.settingsJson ?? null,
          userNotes: body.userNotes ?? null,
        })
        .returning()

      // Update or create gamePlatformSupport with anti-cheat info
      const [existingSupport] = await db
        .select()
        .from(gamePlatformSupport)
        .where(
          and(
            eq(gamePlatformSupport.gameId, version.gameId),
            eq(gamePlatformSupport.hardwareSlug, body.hardwareSlug),
          ),
        )
        .limit(1)

      if (existingSupport) {
        await db
          .update(gamePlatformSupport)
          .set({
            antiCheatRelevant: body.antiCheatRelevant ?? existingSupport.antiCheatRelevant,
            antiCheatName: body.antiCheatRelevant
              ? (body.antiCheatName ?? existingSupport.antiCheatName)
              : null,
            antiCheatStatus: body.antiCheatStatus ?? existingSupport.antiCheatStatus,
            updatedAt: new Date(),
          })
          .where(eq(gamePlatformSupport.id, existingSupport.id))
      } else {
        await db.insert(gamePlatformSupport).values({
          gameId: version.gameId,
          hardwareSlug: body.hardwareSlug,
          isSupported: true,
          protonStatus: "unknown",
          antiCheatRelevant: body.antiCheatRelevant ?? false,
          antiCheatName: body.antiCheatRelevant ? body.antiCheatName ?? null : null,
          antiCheatStatus: body.antiCheatStatus ?? "unknown",
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
      }
    },
    {
      body: t.Object({
        versionId: t.String(),
        hardwareSlug: t.String(),
        fpsAvg: t.Number(),
        fpsOnePercentLow: t.Optional(t.Union([t.Number(), t.Null()])),
        fpsLow: t.Optional(t.Union([t.Number(), t.Null()])),
        fpsHigh: t.Optional(t.Union([t.Number(), t.Null()])),
        protonVersion: t.Optional(t.Union([t.String(), t.Null()])),
        osVersion: t.Optional(t.Union([t.String(), t.Null()])),
        upscalerType: t.Optional(
          t.Union([
            t.Literal("none"),
            t.Literal("fsr"),
            t.Literal("dlss"),
            t.Literal("xess"),
            t.Literal("lsfg"),
            t.Literal("other"),
          ]),
        ),
        upscalerVersion: t.Optional(t.Union([t.String(), t.Null()])),
        customSystem: t.Optional(t.Boolean()),
        frameGenMethod: t.Optional(
          t.Union([
            t.Literal("none"),
            t.Literal("fsr_fg"),
            t.Literal("dlss_fg"),
            t.Literal("lsfg"),
            t.Literal("other"),
          ]),
        ),
        loadTimeSsd: t.Optional(t.Union([t.Number(), t.Null()])),
        loadTimeSd: t.Optional(t.Union([t.Number(), t.Null()])),
        tdpWatts: t.Optional(t.Union([t.Number(), t.Null()])),
        youtubeVideoId: t.Optional(t.Union([t.String(), t.Null()])),
        launchOptions: t.Optional(t.Union([t.String(), t.Null()])),
        settingsJson: t.Optional(
          t.Union([
            t.Array(
              t.Object({
                category: t.String(),
                settings: t.Array(
                  t.Object({
                    title: t.String(),
                    value: t.Union([t.String(), t.Number(), t.Boolean()]),
                  }),
                ),
              }),
            ),
            t.Null(),
          ]),
        ),
        userNotes: t.Optional(t.Union([t.String(), t.Null()])),
        antiCheatRelevant: t.Optional(t.Boolean()),
        antiCheatName: t.Optional(t.Union([t.String(), t.Null()])),
        antiCheatStatus: t.Optional(
          t.Union([
            t.Literal("none"),
            t.Literal("supported"),
            t.Literal("unsupported"),
            t.Literal("unknown"),
          ]),
        ),
      }),
    },
  )
