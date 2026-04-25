import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core"
import { settingCategories } from "./settingCategories"

export const settingInputTypeEnum = pgEnum("setting_input_type", [
  "toggle",
  "select",
  "range",
  "number",
])

export const impactLevelEnum = pgEnum("impact_level", [
  "minor",
  "moderate",
  "major",
])

export const settingDefinitions = pgTable(
  "setting_definitions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    categoryId: text("category_id")
      .notNull()
      .references(() => settingCategories.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    inputType: settingInputTypeEnum("input_type").notNull(),
    // For `select`: string[] of option labels
    // For `range`: { min: number, max: number, step: number }
    // For `toggle`/`number`: null
    options: jsonb("options").$type<string[] | { min: number; max: number; step: number }>(),
    impactLevel: impactLevelEnum("impact_level").default("minor").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [unique("setting_category_slug_unique").on(table.categoryId, table.slug)],
)
