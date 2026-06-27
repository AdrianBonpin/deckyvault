ALTER TABLE "game_platform_support" ALTER COLUMN "playability_status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "game_platform_support" ALTER COLUMN "playability_override" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "playability_status" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ALTER COLUMN "playability_override" SET NOT NULL;