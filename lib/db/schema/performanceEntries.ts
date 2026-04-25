import {
  boolean,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
} from "drizzle-orm/pg-core"
import { gameVersions } from "./gameVersions"
import { hardware } from "./hardware"
import { user } from "./auth"

export const performanceEntries = pgTable("performance_entries", {
  id: text("id")
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  versionId: text("version_id")
    .notNull()
    .references(() => gameVersions.id, { onDelete: "cascade" }),
  hardwareSlug: text("hardware_slug")
    .notNull()
    .references(() => hardware.slug, { onDelete: "restrict" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),

  // Performance metrics
  fpsAvg: real("fps_avg").notNull(),
  fpsLow: real("fps_low"),
  fpsHigh: real("fps_high"),

  // Environment
  protonVersion: text("proton_version"),
  osVersion: text("os_version"),

  // Feature flags
  isFsrEnabled: boolean("is_fsr_enabled").default(false).notNull(),
  isFrameGenEnabled: boolean("is_frame_gen_enabled").default(false).notNull(),

  // Load times (seconds)
  loadTimeSsd: real("load_time_ssd"),
  loadTimeSd: real("load_time_sd"),

  // Settings & notes
  settingsJson: jsonb("settings_json").$type<Record<string, unknown>>(),
  userNotes: text("user_notes"),

  // Moderation
  isRemoved: boolean("is_removed").default(false).notNull(),
  removedReason: text("removed_reason"),

  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
})
