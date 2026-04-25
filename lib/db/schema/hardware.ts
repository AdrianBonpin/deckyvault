import { integer, pgEnum, pgTable, text, timestamp } from "drizzle-orm/pg-core"

export const deviceTypeEnum = pgEnum("device_type", ["handled", "console"])

export const hardware = pgTable("hardware", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  deviceType: deviceTypeEnum("device_type").notNull(),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})
