import { Elysia, t } from "elysia"
import { createCrudRoutes } from "./crud-builder"
import { communityPresets } from "@/lib/db/schema"
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
  paramName: "presetId",
})

// ── Upvote endpoint ───────────────────────────────────────────────
export const presetUpvoteRoutes = new Elysia({ prefix: "/presets" }).post(
  "/:presetId/upvote",
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
      .where(eq(communityPresets.id, params.presetId))
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
      .where(eq(communityPresets.id, params.presetId))
      .returning()

    return updated
  },
  {
    params: t.Object({ presetId: t.String() }),
  },
)

// ── Preset Settings (nested under /presets/:presetId/settings) ────
// Settings are stored as freeform JSON on the preset itself.
export const presetSettingsRoutes = new Elysia({
  prefix: "/presets/:presetId/settings",
})
  // GET the settings JSON for a preset
  .get(
    "/",
    async ({ params, set }) => {
      const [preset] = await db
        .select({ settingsJson: communityPresets.settingsJson })
        .from(communityPresets)
        .where(eq(communityPresets.id, params.presetId))
        .limit(1)

      if (!preset) {
        set.status = 404
        return { error: "Preset not found" }
      }

      return preset.settingsJson ?? []
    },
    {
      params: t.Object({ presetId: t.String() }),
    },
  )
  // PUT (replace) the settings JSON for a preset
  .put(
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

      const [updated] = await db
        .update(communityPresets)
        .set({
          settingsJson: body.settings,
          updatedAt: new Date(),
        })
        .where(eq(communityPresets.id, params.presetId))
        .returning()

      return updated
    },
    {
      params: t.Object({ presetId: t.String() }),
      body: t.Object({
        settings: t.Array(
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
      }),
    },
  )
