ALTER TABLE "performance_entries" ADD COLUMN "is_pinned" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "performance_entries" ADD COLUMN "pinned_at" timestamp;