import {
  boolean,
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core"
import { games } from "./games"

export const gameVersions = pgTable(
  "game_versions",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    buildId: text("build_id"),
    versionString: text("version_string"),
    isLatest: boolean("is_latest").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [unique("game_build_unique").on(table.gameId, table.buildId)]
)
