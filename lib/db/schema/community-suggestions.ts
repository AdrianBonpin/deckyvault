import {
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { games } from "./games"
import { user } from "./auth"

export const suggestionStatusEnum = pgEnum("suggestion_status", [
  "pending",
  "approved",
  "rejected",
])

export const communitySuggestions = pgTable(
  "community_suggestions",
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
    fieldName: text("field_name").notNull(), // e.g. "title", "description", "developer"
    currentValue: text("current_value"), // current value (snapshot)
    proposedValue: text("proposed_value").notNull(), // proposed new value
    reason: text("reason"), // optional explanation
    status: suggestionStatusEnum("status").default("pending").notNull(),
    reviewedBy: text("reviewed_by").references(() => user.id, {
      onDelete: "set null",
    }),
    reviewedAt: timestamp("reviewed_at"),
    reviewNote: text("review_note"), // reviewer's note
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("community_suggestions_game_field_user").on(
      table.gameId,
      table.fieldName,
      table.userId,
    ),
    index("suggestions_status_idx").on(table.status),
  ],
)