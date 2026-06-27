CREATE INDEX "suggestions_status_idx" ON "community_suggestions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "perf_game_lookup_idx" ON "game_versions" USING btree ("game_id");--> statement-breakpoint
CREATE INDEX "games_sync_status_idx" ON "games" USING btree ("sync_status","steam_app_id");--> statement-breakpoint
CREATE INDEX "perf_removed_created_idx" ON "performance_entries" USING btree ("is_removed","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "perf_upvotes_idx" ON "performance_entries" USING btree ("upvotes" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "reports_status_idx" ON "reports" USING btree ("status");