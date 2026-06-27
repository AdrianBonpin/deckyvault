import { integer, pgEnum, pgTable, real, text, timestamp } from "drizzle-orm/pg-core"

export const deviceTypeEnum = pgEnum("device_type", ["handheld", "console"])

export const hardware = pgTable("hardware", {
  slug: text("slug").primaryKey(),
  name: text("name").notNull(),
  deviceType: deviceTypeEnum("device_type").notNull(),
  image: text("image"),
  wattHours: real("watt_hours"),
  tdpMax: real("tdp_max"),
  sortOrder: integer("sort_order").default(0).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
})
