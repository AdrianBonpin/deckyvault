import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core"
import { user } from "./auth"

export const storageObjects = pgTable(
  "storage_objects",
  {
    id: text("id")
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    key: text("key").notNull(),
    bucket: text("bucket").notNull(),
    size: integer("size").notNull(),
    mimeType: text("mime_type").notNull(),
    entityType: text("entity_type").notNull(), // "avatar" | "game_cover" | "hardware_image"
    entityId: text("entity_id"), // user ID, game ID, or hardware slug
    uploadedBy: text("uploaded_by")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastAccessedAt: timestamp("last_accessed_at"),
    isOrphaned: boolean("is_orphaned").default(false).notNull(),
  },
  (table) => [
    index("storage_entity_idx").on(table.entityType, table.entityId),
    index("storage_key_idx").on(table.key),
  ],
)