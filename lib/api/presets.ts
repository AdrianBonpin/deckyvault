import { Elysia, t } from "elysia"
import { createCrudRoutes } from "./crud-builder"
import { communityPresets, presetSettings, settingDefinitions } from "@/lib/db/schema"
import { db } from "@/lib/db/index"
import { eq, sql } from "drizzle-orm"
import { requireRole } from "@/lib/auth/guard"

// ── Community Presets CRUD ────────────────────────────────────────
export const presetsRoutes = createCrudRoutes(communityPresets, {
  prefix: "/presets",
  name: "Preset",
  auth: { read: "public", write: "user", delete: "admin" },
  search: { fields: ["name", "description"] },
  filter: { fields: ["gameId", "hardwareSlug"] },
})

// ── Upvote endpoint ───────────────────────────────────────────────
export const presetUpvoteRoutes = new Elysia({ prefix: "/presets" }).post(
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

    const [preset] = await db
      .select()
      .from(communityPresets)
      .where(eq(communityPresets.id, params.id))
      .limit(1)

    if (!preset) {
      set.status = 404
      return { error: "Preset not found" }
    }

    const [updated] = await db
      .update(communityPresets)
      .set({
        upvotes: sql`${communityPresets.upvotes} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(communityPresets.id, params.id))
      .returning()

    return updated
  },
  {
    params: t.Object({ id: t.String() }),
  },
)

// ── Preset Settings (nested under /presets/:presetId/settings) ────
export const presetSettingsRoutes = new Elysia({
  prefix: "/presets/:presetId/settings",
})
  // LIST all settings for a preset (with definition details)
  .get(
    "/",
    async ({ params }) => {
      const data = await db
        .select({
          id: presetSettings.id,
          presetId: presetSettings.presetId,
          settingDefinitionId: presetSettings.settingDefinitionId,
          value: presetSettings.value,
          settingName: settingDefinitions.name,
          settingSlug: settingDefinitions.slug,
          inputType: settingDefinitions.inputType,
          options: settingDefinitions.options,
          impactLevel: settingDefinitions.impactLevel,
        })
        .from(presetSettings)
        .innerJoin(
          settingDefinitions,
          eq(presetSettings.settingDefinitionId, settingDefinitions.id),
        )
        .where(eq(presetSettings.presetId, params.presetId))

      return data
    },
    {
      params: t.Object({ presetId: t.String() }),
    },
  )
  // UPSERT settings for a preset (bulk create/update)
  .post(
    "/",
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

      // Verify preset exists and user is the creator (or admin)
      const [preset] = await db
        .select()
        .from(communityPresets)
        .where(eq(communityPresets.id, params.presetId))
        .limit(1)

      if (!preset) {
        set.status = 404
        return { error: "Preset not found" }
      }

      if (preset.createdBy !== guard.user.id && guard.user.role !== "admin") {
        set.status = 403
        return { error: "Not authorized to modify this preset" }
      }

      // Delete existing settings and re-insert
      await db
        .delete(presetSettings)
        .where(eq(presetSettings.presetId, params.presetId))

      if (body.settings.length > 0) {
        await db.insert(presetSettings).values(
          body.settings.map((s: { settingDefinitionId: string; value: boolean | string | number }) => ({
            presetId: params.presetId,
            settingDefinitionId: s.settingDefinitionId,
            value: s.value,
          })),
        )
      }

      // Return the updated settings
      const data = await db
        .select()
        .from(presetSettings)
        .where(eq(presetSettings.presetId, params.presetId))

      return data
    },
    {
      params: t.Object({ presetId: t.String() }),
      body: t.Object({
        settings: t.Array(
          t.Object({
            settingDefinitionId: t.String(),
            value: t.Union([t.Boolean(), t.String(), t.Number()]),
          }),
        ),
      }),
    },
  )
