import {
  pgTable,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core"
import { user } from "./auth"
import { games } from "./games"

export const savedGames = pgTable(
  "saved_games",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    unique("saved_games_user_game_unique").on(table.userId, table.gameId),
  ],
)
