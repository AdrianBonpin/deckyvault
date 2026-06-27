CREATE TABLE "saved_games" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"game_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "saved_games_user_game_unique" UNIQUE("user_id","game_id")
);
--> statement-breakpoint
ALTER TABLE "performance_entries" ADD COLUMN "launch_options" text;--> statement-breakpoint
ALTER TABLE "saved_games" ADD CONSTRAINT "saved_games_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_games" ADD CONSTRAINT "saved_games_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;