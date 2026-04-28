ALTER TABLE "games" ADD COLUMN "system_requirements" jsonb;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "metacritic_score" integer;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "metacritic_url" text;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "recommendations_total" integer;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "price_current" integer;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "price_initial" integer;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "price_currency" text;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "is_free" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "release_date" text;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "categories" jsonb;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "platforms" jsonb;