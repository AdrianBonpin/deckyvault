import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core"
import { games } from "./games"
import { hardware } from "./hardware"

export const protonStatusEnum = pgEnum("proton_status", [
  "native",
  "proton",
  "unsupported",
  "unknown",
])

export const antiCheatStatusEnum = pgEnum("anti_cheat_status", [
  "none",
  "supported",
  "unsupported",
  "unknown",
])

export const gamePlatformSupport = pgTable(
  "game_platform_support",
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

    // Compatibility
    isSupported: boolean("is_supported").default(false).notNull(),
    protonStatus: protonStatusEnum("proton_status")
      .default("unknown")
      .notNull(),

    // Anti-cheat details
    antiCheatRelevant: boolean("anti_cheat_relevant")
      .default(false)
      .notNull(),
    antiCheatName: text("anti_cheat_name"),
    antiCheatVersion: text("anti_cheat_version"),
    antiCheatStatus: antiCheatStatusEnum("anti_cheat_status")
      .default("unknown")
      .notNull(),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    unique("game_hardware_unique").on(table.gameId, table.hardwareSlug),
  ]
)
