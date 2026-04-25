import { Elysia } from "elysia"
import { createCrudRoutes } from "./crud-builder"
import { settingCategories, settingDefinitions } from "@/lib/db/schema"
import { db } from "@/lib/db/index"
import { asc } from "drizzle-orm"

// ── Setting Categories CRUD ───────────────────────────────────────
export const settingCategoriesRoutes = createCrudRoutes(settingCategories, {
  prefix: "/settings/categories",
  name: "Setting Category",
  auth: { read: "public", write: "admin", delete: "admin" },
})

// ── Setting Definitions CRUD ──────────────────────────────────────
export const settingDefinitionsRoutes = createCrudRoutes(settingDefinitions, {
  prefix: "/settings/definitions",
  name: "Setting Definition",
  auth: { read: "public", write: "admin", delete: "admin" },
  filter: { fields: ["categoryId", "inputType", "impactLevel"] },
})

// ── Combined endpoint: categories with their definitions ──────────
// This is the main endpoint the frontend uses to render dynamic forms.
export const settingsFullRoutes = new Elysia({
  prefix: "/settings/full",
}).get(
  "/",
  async () => {
    const categories = await db
      .select()
      .from(settingCategories)
      .orderBy(asc(settingCategories.sortOrder))

    const definitions = await db
      .select()
      .from(settingDefinitions)
      .orderBy(asc(settingDefinitions.sortOrder))

    // Group definitions by category
    const result = categories.map((cat) => ({
      ...cat,
      definitions: definitions.filter((d) => d.categoryId === cat.id),
    }))

    return result
  },
)
