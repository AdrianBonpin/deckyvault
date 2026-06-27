import {
  index,
  text,
  pgEnum,
  pgTable,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core"
import { performanceEntries } from "./performanceEntries"
import { user } from "./auth"

export const reportReasonEnum = pgEnum("report_reason", [
  "inaccurate",
  "spam",
  "inappropriate",
  "other",
])

export const reportStatusEnum = pgEnum("report_status", [
  "open",
  "reviewed",
  "dismissed",
])

export const reports = pgTable("reports", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  entryId: text("entry_id")
    .notNull()
    .references(() => performanceEntries.id, { onDelete: "cascade" }),
  reporterId: text("reporter_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  reason: reportReasonEnum("reason").notNull(),
  details: text("details"),
  status: reportStatusEnum("status").default("open").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("reports_entry_reporter_unique").on(table.entryId, table.reporterId),
  index("reports_status_idx").on(table.status),
])