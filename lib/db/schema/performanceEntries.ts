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

export const upscalerTypeEnum = pgEnum("upscaler_type", [
  "none",
  "fsr",
  "dlss",
  "xess",
  "lsfg",
  "other",
])

export const frameGenMethodEnum = pgEnum("frame_gen_method", [
  "none",
  "fsr_fg",
  "dlss_fg",
  "lsfg",
  "other",
])

export type GameSettingCategory = {
  category: string
  settings: { title: string; value: string | number | boolean }[]
}

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
    fpsOnePercentLow: real("fps_one_percent_low"),
    fpsHigh: real("fps_high"),

    // Environment
    protonVersion: text("proton_version"),
    osVersion: text("os_version"),

    // Upscaler tracking
    upscalerType: upscalerTypeEnum("upscaler_type").default("none").notNull(),
    upscalerVersion: text("upscaler_version"),
    frameGenMethod: frameGenMethodEnum("frame_gen_method")
      .default("none")
      .notNull(),

    // Load times (seconds)
    loadTimeSsd: real("load_time_ssd"),
    loadTimeSd: real("load_time_sd"),

    // Launch options (Steam launch options string)
    launchOptions: text("launch_options"),

    // Settings & notes
    settingsJson: jsonb("settings_json").$type<GameSettingCategory[]>(),
    userNotes: text("user_notes"),

    // Battery estimate (minutes)
    estimatedBatteryMin: integer("estimated_battery_min"),

    // Custom system flag
    customSystem: boolean("custom_system").default(false).notNull(),

    // Moderation
    isRemoved: boolean("is_removed").default(false).notNull(),
    isPinned: boolean("is_pinned").default(false).notNull(),
    pinnedAt: timestamp("pinned_at"),
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
    index("perf_hardware_upscaler_idx").on(table.hardwareSlug, table.upscalerType),
    index("perf_version_idx").on(table.versionId),
    index("perf_user_idx").on(table.userId),
  ],
)
