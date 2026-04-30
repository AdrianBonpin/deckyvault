import {
  boolean,
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

export const steamReviewSentimentEnum = pgEnum("steam_review_sentiment", [
  "overwhelmingly_positive",
  "very_positive",
  "positive",
  "mostly_positive",
  "mixed",
  "mostly_negative",
  "negative",
  "very_negative",
  "overwhelmingly_negative",
])

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
    systemRequirements: jsonb("system_requirements").$type<{
      minimum: string | null
      recommended: string | null
    }>(),
    metacriticScore: integer("metacritic_score"),
    metacriticUrl: text("metacritic_url"),
    recommendationsTotal: integer("recommendations_total"),
    steamReviewScore: integer("steam_review_score"),       // 0-100 normalized score
    steamReviewSentiment: steamReviewSentimentEnum("steam_review_sentiment"),
    steamReviewCount: integer("steam_review_count"),        // Total review count from Steam
    priceCurrent: integer("price_current"),
    priceInitial: integer("price_initial"),
    priceCurrency: text("price_currency"),
    isFree: boolean("is_free").default(false).notNull(),
    releaseDate: text("release_date"),
    categories: jsonb("categories").$type<string[]>(),
    platforms: jsonb("platforms").$type<{
      windows: boolean
      mac: boolean
      linux: boolean
    }>(),
    lastSync: timestamp("last_sync"),
    syncStatus: text("sync_status").default("pending"),
    syncError: text("sync_error"),
    syncRetryCount: integer("sync_retry_count").default(0),
    syncNextRetry: timestamp("sync_next_retry"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [index("games_source_idx").on(table.source)],
)
