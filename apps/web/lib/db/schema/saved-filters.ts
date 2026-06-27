import {
  pgTable,
  text,
  timestamp,
  jsonb,
  unique,
} from "drizzle-orm/pg-core"
import { user } from "./auth"

export const savedFilters = pgTable(
  "saved_filters",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    filters: jsonb("filters").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    unique("saved_filters_user_name").on(table.userId, table.name),
  ],
)