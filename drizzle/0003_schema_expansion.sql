-- Custom Types / Enums
CREATE TYPE "game_source" AS ENUM ('steam', 'manual', 'gog', 'epic');
CREATE TYPE "online_multiplayer_status" AS ENUM ('none', 'supported', 'unknown');
CREATE TYPE "fsr_version" AS ENUM ('none', 'fsr1', 'fsr2', 'fsr3');
CREATE TYPE "frame_gen_method" AS ENUM ('none', 'fsr_fg', 'dlss_fg');

-- Alter games table
ALTER TABLE "games" ALTER COLUMN "steam_app_id" DROP NOT NULL;
ALTER TABLE "games" ADD COLUMN "source" "game_source" DEFAULT 'steam' NOT NULL;
ALTER TABLE "games" ADD COLUMN "online_multiplayer_status" "online_multiplayer_status" DEFAULT 'unknown' NOT NULL;
CREATE INDEX "games_source_idx" ON "games" ("source");

-- Alter performance_entries table
ALTER TABLE "performance_entries" ADD COLUMN "fsr_version" "fsr_version" DEFAULT 'none' NOT NULL;
ALTER TABLE "performance_entries" ADD COLUMN "frame_gen_method" "frame_gen_method" DEFAULT 'none' NOT NULL;
ALTER TABLE "performance_entries" ADD COLUMN "upvotes" integer DEFAULT 0 NOT NULL;
ALTER TABLE "performance_entries" ADD COLUMN "downvotes" integer DEFAULT 0 NOT NULL;
ALTER TABLE "performance_entries" ADD COLUMN "verified_at" timestamp;
ALTER TABLE "performance_entries" ADD COLUMN "verified_by" text;

-- Data migration: convert booleans to enums
UPDATE "performance_entries" SET "fsr_version" = 'fsr2' WHERE "is_fsr_enabled" = true;
UPDATE "performance_entries" SET "frame_gen_method" = 'fsr_fg' WHERE "is_frame_gen_enabled" = true;

ALTER TABLE "performance_entries" DROP COLUMN "is_fsr_enabled";
ALTER TABLE "performance_entries" DROP COLUMN "is_frame_gen_enabled";

-- Verification FK
ALTER TABLE "performance_entries" ADD CONSTRAINT "performance_entries_verified_by_user_id_fk" FOREIGN KEY ("verified_by") REFERENCES "user"("id") ON DELETE set null;

CREATE INDEX "perf_hardware_fsr_idx" ON "performance_entries" ("hardware_slug", "fsr_version");
CREATE INDEX "perf_version_idx" ON "performance_entries" ("version_id");
CREATE INDEX "perf_user_idx" ON "performance_entries" ("user_id");

-- Alter hardware table
ALTER TABLE "hardware" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;

-- New table: community_presets
CREATE TABLE "community_presets" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"hardware_slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_by" text,
	"upvotes" integer DEFAULT 0 NOT NULL,
	"settings_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "preset_game_hardware_name_unique" UNIQUE("game_id","hardware_slug","name")
);
ALTER TABLE "community_presets" ADD CONSTRAINT "community_presets_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE cascade;
ALTER TABLE "community_presets" ADD CONSTRAINT "community_presets_hardware_slug_hardware_slug_fk" FOREIGN KEY ("hardware_slug") REFERENCES "hardware"("slug") ON DELETE restrict;
ALTER TABLE "community_presets" ADD CONSTRAINT "community_presets_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "user"("id") ON DELETE set null;

-- New table: game_comments
CREATE TABLE "game_comments" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"user_id" text NOT NULL,
	"parent_id" text,
	"content" jsonb NOT NULL,
	"upvotes" integer DEFAULT 0 NOT NULL,
	"is_removed" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
ALTER TABLE "game_comments" ADD CONSTRAINT "game_comments_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "games"("id") ON DELETE cascade;
ALTER TABLE "game_comments" ADD CONSTRAINT "game_comments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE cascade;
ALTER TABLE "game_comments" ADD CONSTRAINT "game_comments_parent_id_game_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "game_comments"("id") ON DELETE cascade;
CREATE INDEX "comments_game_created_idx" ON "game_comments" ("game_id", "created_at");
CREATE INDEX "comments_parent_idx" ON "game_comments" ("parent_id");
