CREATE TYPE "public"."anti_cheat_status" AS ENUM('none', 'supported', 'unsupported', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."proton_status" AS ENUM('native', 'proton', 'unsupported', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."device_type" AS ENUM('handled', 'console');--> statement-breakpoint
CREATE TABLE "game_platform_support" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"hardware_slug" text NOT NULL,
	"is_supported" boolean DEFAULT false NOT NULL,
	"proton_status" "proton_status" DEFAULT 'unknown' NOT NULL,
	"anti_cheat_relevant" boolean DEFAULT false NOT NULL,
	"anti_cheat_name" text,
	"anti_cheat_version" text,
	"anti_cheat_status" "anti_cheat_status" DEFAULT 'unknown' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_hardware_unique" UNIQUE("game_id","hardware_slug")
);
--> statement-breakpoint
CREATE TABLE "game_versions" (
	"id" text PRIMARY KEY NOT NULL,
	"game_id" text NOT NULL,
	"build_id" text,
	"version_string" text,
	"is_latest" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "game_build_unique" UNIQUE("game_id","build_id")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" text PRIMARY KEY NOT NULL,
	"steam_app_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"publisher" text,
	"developer" text,
	"genres" jsonb,
	"header_image" text,
	"capsule_image" text,
	"store_url" text,
	"last_sync" timestamp,
	"sync_status" text DEFAULT 'pending',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "games_steam_app_id_unique" UNIQUE("steam_app_id")
);
--> statement-breakpoint
CREATE TABLE "hardware" (
	"slug" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"device_type" "device_type" NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "performance_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"version_id" text NOT NULL,
	"hardware_slug" text NOT NULL,
	"user_id" text NOT NULL,
	"fps_avg" real NOT NULL,
	"fps_low" real,
	"fps_high" real,
	"proton_version" text,
	"os_version" text,
	"is_fsr_enabled" boolean DEFAULT false NOT NULL,
	"is_frame_gen_enabled" boolean DEFAULT false NOT NULL,
	"load_time_ssd" real,
	"load_time_sd" real,
	"settings_json" jsonb,
	"user_notes" text,
	"is_removed" boolean DEFAULT false NOT NULL,
	"removed_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "game_platform_support" ADD CONSTRAINT "game_platform_support_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_platform_support" ADD CONSTRAINT "game_platform_support_hardware_slug_hardware_slug_fk" FOREIGN KEY ("hardware_slug") REFERENCES "public"."hardware"("slug") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_versions" ADD CONSTRAINT "game_versions_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_entries" ADD CONSTRAINT "performance_entries_version_id_game_versions_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."game_versions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "performance_entries" ADD CONSTRAINT "performance_entries_hardware_slug_hardware_slug_fk" FOREIGN KEY ("hardware_slug") REFERENCES "public"."hardware"("slug") ON DELETE restrict ON UPDATE no action;