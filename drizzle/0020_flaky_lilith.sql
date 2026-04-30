ALTER TABLE "community_suggestions" DROP CONSTRAINT "community_suggestions_reviewed_by_user_id_fk";
--> statement-breakpoint
ALTER TABLE "community_suggestions" ADD CONSTRAINT "community_suggestions_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;