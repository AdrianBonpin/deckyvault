import {
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core"

export const gameSourceEnum = pgEnum("game_source", [
  "steam",
  "manual",
  "gog",
  "epic",
])

export const onlineMultiplayerStatusEnum = pgEnum(
  "online_multiplayer_status",
  ["none", "supported", "unknown"],
)

export const games = pgTable(
  "games",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    steamAppId: integer("steam_app_id").unique(),
    source: gameSourceEnum("source").default("steam").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    publisher: text("publisher"),
    developer: text("developer"),
    genres: jsonb("genres").$type<string[]>(),
    headerImage: text("header_image"),
    capsuleImage: text("capsule_image"),
    storeUrl: text("store_url"),
    onlineMultiplayerStatus: onlineMultiplayerStatusEnum(
      "online_multiplayer_status",
    )
      .default("unknown")
      .notNull(),
    lastSync: timestamp("last_sync"),
    syncStatus: text("sync_status").default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("games_source_idx").on(table.source)],
)
