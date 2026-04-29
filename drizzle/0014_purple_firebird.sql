ALTER TABLE "games" ADD COLUMN "sync_error" text;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "sync_retry_count" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "sync_next_retry" timestamp;