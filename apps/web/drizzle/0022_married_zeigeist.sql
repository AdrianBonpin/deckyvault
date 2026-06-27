CREATE TABLE "storage_objects" (
	"id" text PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"bucket" text NOT NULL,
	"size" integer NOT NULL,
	"mime_type" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"uploaded_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_accessed_at" timestamp,
	"is_orphaned" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
ALTER TABLE "storage_objects" ADD CONSTRAINT "storage_objects_uploaded_by_user_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "storage_entity_idx" ON "storage_objects" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "storage_key_idx" ON "storage_objects" USING btree ("key");