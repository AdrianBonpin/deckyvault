import {
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core"

export const games = pgTable("games", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  steamAppId: integer("steam_app_id").unique().notNull(),
  title: text("title").notNull(),
  description: text("description"),
  publisher: text("publisher"),
  developer: text("developer"),
  genres: jsonb("genres").$type<string[]>(),
  headerImage: text("header_image"),
  capsuleImage: text("capsule_image"),
  storeUrl: text("store_url"),
  lastSync: timestamp("last_sync"),
  syncStatus: text("sync_status").default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})
