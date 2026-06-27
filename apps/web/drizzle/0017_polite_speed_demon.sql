CREATE TYPE "public"."playability_status" AS ENUM('great', 'playable', 'needs_tweaks', 'unplayable', 'unknown');--> statement-breakpoint
ALTER TABLE "game_platform_support" ADD COLUMN "playability_status" "playability_status" DEFAULT 'unknown';--> statement-breakpoint
ALTER TABLE "game_platform_support" ADD COLUMN "playability_override" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "game_platform_support" ADD COLUMN "playability_calculated_at" timestamp;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "playability_status" "playability_status" DEFAULT 'unknown';--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "playability_override" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "playability_calculated_at" timestamp;