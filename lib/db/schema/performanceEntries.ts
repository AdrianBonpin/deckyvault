import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  real,
  text,
  timestamp,
  index,
} from "drizzle-orm/pg-core"
import { gameVersions } from "./gameVersions"
import { hardware } from "./hardware"
import { user } from "./auth"

export const fsrVersionEnum = pgEnum("fsr_version", [
  "none",
  "fsr1",
  "fsr2",
  "fsr3",
])

export const frameGenMethodEnum = pgEnum("frame_gen_method", [
  "none",
  "fsr_fg",
  "dlss_fg",
])

export const performanceEntries = pgTable(
  "performance_entries",
  {
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

    // Upscaler tracking (replaces isFsrEnabled boolean)
    fsrVersion: fsrVersionEnum("fsr_version").default("none").notNull(),
    frameGenMethod: frameGenMethodEnum("frame_gen_method")
      .default("none")
      .notNull(),

    // Load times (seconds)
    loadTimeSsd: real("load_time_ssd"),
    loadTimeSd: real("load_time_sd"),

    // Settings & notes
    settingsJson: jsonb("settings_json").$type<Record<string, unknown>>(),
    userNotes: text("user_notes"),

    // Moderation
    isRemoved: boolean("is_removed").default(false).notNull(),
    removedReason: text("removed_reason"),

    // Community rating
    upvotes: integer("upvotes").default(0).notNull(),
    downvotes: integer("downvotes").default(0).notNull(),

    // Verification (admin/mod workflow)
    verifiedAt: timestamp("verified_at"),
    verifiedBy: text("verified_by").references(() => user.id, {
      onDelete: "set null",
    }),

    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("perf_hardware_fsr_idx").on(table.hardwareSlug, table.fsrVersion),
    index("perf_version_idx").on(table.versionId),
    index("perf_user_idx").on(table.userId),
  ],
)
