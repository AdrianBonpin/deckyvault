import {
  integer,
  pgTable,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core"
import { performanceEntries } from "./performanceEntries"

export const entryScreenshots = pgTable(
  "entry_screenshots",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    entryId: text("entry_id")
      .notNull()
      .references(() => performanceEntries.id, { onDelete: "cascade" }),
    storageKey: text("storage_key").notNull(),
    orderIndex: integer("order_index").notNull().default(0),
    mimeType: text("mime_type").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),
    originalName: text("original_name"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("entry_screenshots_entry_idx").on(table.entryId),
  ],
)