import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import {
  performanceEntries,
  gameVersions,
  hardware,
} from "@/lib/db/schema"
import { eq, sql } from "drizzle-orm"
import { requireRole } from "@/lib/auth/guard"

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
        .select({ id: gameVersions.id })
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

      // Create the performance entry
      const [entry] = await db
        .insert(performanceEntries)
        .values({
          versionId: body.versionId,
          hardwareSlug: body.hardwareSlug,
          userId: guard.user.id,
          fpsAvg: body.fpsAvg,
          fpsLow: body.fpsLow ?? null,
          fpsHigh: body.fpsHigh ?? null,
          protonVersion: body.protonVersion ?? null,
          osVersion: body.osVersion ?? null,
          upscalerType: body.upscalerType ?? "none",
          upscalerVersion: body.upscalerVersion ?? null,
          estimatedBatteryMin: body.estimatedBatteryMin ?? null,
          customSystem: body.customSystem ?? false,
          frameGenMethod: body.frameGenMethod ?? "none",
          loadTimeSsd: body.loadTimeSsd ?? null,
          loadTimeSd: body.loadTimeSd ?? null,
          launchOptions: body.launchOptions ?? null,
          settingsJson: body.settingsJson ?? null,
          userNotes: body.userNotes ?? null,
        })
        .returning()

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
        estimatedBatteryMin: t.Optional(t.Union([t.Number(), t.Null()])),
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
      }),
    },
  )
