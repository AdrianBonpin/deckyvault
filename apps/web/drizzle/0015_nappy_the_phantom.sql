ALTER TABLE "games" ADD COLUMN "steam_review_score" integer;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "steam_review_sentiment" text;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "steam_review_count" integer;