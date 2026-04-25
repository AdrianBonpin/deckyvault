import {
  integer,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core"
import { games } from "./games"
import { hardware } from "./hardware"
import { user } from "./auth"

export const communityPresets = pgTable(
  "community_presets",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    hardwareSlug: text("hardware_slug")
      .notNull()
      .references(() => hardware.slug, { onDelete: "restrict" }),
    name: text("name").notNull(),
    description: text("description"),
    createdBy: text("created_by").references(() => user.id, {
      onDelete: "set null",
    }),
    upvotes: integer("upvotes").default(0).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("preset_game_hardware_name_unique").on(
      table.gameId,
      table.hardwareSlug,
      table.name,
    ),
  ],
)
