CREATE TYPE "public"."game_source" AS ENUM('steam', 'manual', 'gog', 'epic');--> statement-breakpoint
CREATE TYPE "public"."online_multiplayer_status" AS ENUM('none', 'supported', 'unknown');--> statement-breakpoint
CREATE TYPE "public"."frame_gen_method" AS ENUM('none', 'fsr_fg', 'dlss_fg');--> statement-breakpoint
CREATE TYPE "public"."fsr_version" AS ENUM('none', 'fsr1', 'fsr2', 'fsr3');--> statement-breakpoint
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
--> statement-breakpoint
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
--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "steam_app_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "source" "game_source" DEFAULT 'steam' NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "online_multiplayer_status" "online_multiplayer_status" DEFAULT 'unknown' NOT NULL;--> statement-breakpoint
ALTER TABLE "hardware" ADD COLUMN "sort_order" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "performance_entries" ADD COLUMN "fsr_version" "fsr_version" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "performance_entries" ADD COLUMN "frame_gen_method" "frame_gen_method" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "performance_entries" ADD COLUMN "upvotes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "performance_entries" ADD COLUMN "downvotes" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "performance_entries" ADD COLUMN "verified_at" timestamp;--> statement-breakpoint
ALTER TABLE "performance_entries" ADD COLUMN "verified_by" text;--> statement-breakpoint
ALTER TABLE "community_presets" ADD CONSTRAINT "community_presets_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_presets" ADD CONSTRAINT "community_presets_hardware_slug_hardware_slug_fk" FOREIGN KEY ("hardware_slug") REFERENCES "public"."hardware"("slug") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "community_presets" ADD CONSTRAINT "community_presets_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_comments" ADD CONSTRAINT "game_comments_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_comments" ADD CONSTRAINT "game_comments_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_comments" ADD CONSTRAINT "game_comments_parent_id_game_comments_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."game_comments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "comments_game_created_idx" ON "game_comments" USING btree ("game_id","created_at");--> statement-breakpoint
CREATE INDEX "comments_parent_idx" ON "game_comments" USING btree ("parent_id");--> statement-breakpoint
ALTER TABLE "performance_entries" ADD CONSTRAINT "performance_entries_verified_by_user_id_fk" FOREIGN KEY ("verified_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "games_source_idx" ON "games" USING btree ("source");--> statement-breakpoint
CREATE INDEX "perf_hardware_fsr_idx" ON "performance_entries" USING btree ("hardware_slug","fsr_version");--> statement-breakpoint
CREATE INDEX "perf_version_idx" ON "performance_entries" USING btree ("version_id");--> statement-breakpoint
CREATE INDEX "perf_user_idx" ON "performance_entries" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "performance_entries" DROP COLUMN "is_fsr_enabled";--> statement-breakpoint
ALTER TABLE "performance_entries" DROP COLUMN "is_frame_gen_enabled";