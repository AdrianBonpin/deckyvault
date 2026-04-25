import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core"
import { games } from "./games"
import { user } from "./auth"

export const gameComments = pgTable(
  "game_comments",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    gameId: text("game_id")
      .notNull()
      .references(() => games.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    parentId: text("parent_id").references((): any => gameComments.id, { // eslint-disable-line @typescript-eslint/no-explicit-any
      onDelete: "cascade",
    }),
    // Tiptap JSON document
    content: jsonb("content").notNull().$type<Record<string, unknown>>(),
    upvotes: integer("upvotes").default(0).notNull(),
    isRemoved: boolean("is_removed").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("comments_game_created_idx").on(table.gameId, table.createdAt),
    index("comments_parent_idx").on(table.parentId),
  ],
)
