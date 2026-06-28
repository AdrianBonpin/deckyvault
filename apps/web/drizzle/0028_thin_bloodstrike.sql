CREATE TABLE "plugin_pairings" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" text,
	"api_key_id" text,
	"api_key" text,
	"status" text DEFAULT 'pending' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"confirmed_at" timestamp,
	"expires_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE INDEX "plugin_pairings_userId_idx" ON "plugin_pairings" USING btree ("user_id");