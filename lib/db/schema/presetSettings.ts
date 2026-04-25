import { jsonb, pgTable, text, timestamp, unique } from "drizzle-orm/pg-core"
import { communityPresets } from "./communityPresets"
import { settingDefinitions } from "./settingDefinitions"

export const presetSettings = pgTable(
  "preset_settings",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    presetId: text("preset_id")
      .notNull()
      .references(() => communityPresets.id, { onDelete: "cascade" }),
    settingDefinitionId: text("setting_definition_id")
      .notNull()
      .references(() => settingDefinitions.id, { onDelete: "cascade" }),
    // Value stored as JSON — boolean for toggle, string for select,
    // number for range/number
    value: jsonb("value").notNull().$type<boolean | string | number>(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("preset_setting_unique").on(table.presetId, table.settingDefinitionId),
  ],
)
