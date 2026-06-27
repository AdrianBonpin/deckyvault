CREATE TABLE "entry_screenshots" (
	"id" text PRIMARY KEY NOT NULL,
	"entry_id" text NOT NULL,
	"storage_key" text NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"mime_type" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"original_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "hardware" ADD COLUMN "watt_hours" real;--> statement-breakpoint
ALTER TABLE "hardware" ADD COLUMN "tdp_max" real;--> statement-breakpoint
ALTER TABLE "performance_entries" ADD COLUMN "tdp_watts" real;--> statement-breakpoint
ALTER TABLE "performance_entries" ADD COLUMN "youtube_video_id" text;--> statement-breakpoint
ALTER TABLE "entry_screenshots" ADD CONSTRAINT "entry_screenshots_entry_id_performance_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."performance_entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "entry_screenshots_entry_idx" ON "entry_screenshots" USING btree ("entry_id");