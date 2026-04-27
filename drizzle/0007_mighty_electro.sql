ALTER TYPE "public"."fsr_version" RENAME TO "upscaler_type";--> statement-breakpoint
ALTER TYPE "public"."frame_gen_method" ADD VALUE 'lsfg';--> statement-breakpoint
ALTER TYPE "public"."frame_gen_method" ADD VALUE 'other';--> statement-breakpoint
ALTER TABLE "performance_entries" RENAME COLUMN "fsr_version" TO "upscaler_type";--> statement-breakpoint
ALTER TABLE "performance_entries" ALTER COLUMN "upscaler_type" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "performance_entries" ALTER COLUMN "upscaler_type" SET DEFAULT 'none'::text;--> statement-breakpoint
DROP TYPE "public"."upscaler_type";--> statement-breakpoint
CREATE TYPE "public"."upscaler_type" AS ENUM('none', 'fsr', 'dlss', 'xess', 'lsfg', 'other');--> statement-breakpoint
ALTER TABLE "performance_entries" ALTER COLUMN "upscaler_type" SET DEFAULT 'none'::"public"."upscaler_type";--> statement-breakpoint
ALTER TABLE "performance_entries" ALTER COLUMN "upscaler_type" SET DATA TYPE "public"."upscaler_type" USING "upscaler_type"::"public"."upscaler_type";--> statement-breakpoint
DROP INDEX "perf_hardware_fsr_idx";--> statement-breakpoint
ALTER TABLE "performance_entries" ADD COLUMN "upscaler_version" text;--> statement-breakpoint
ALTER TABLE "performance_entries" ADD COLUMN "estimated_battery_min" integer;--> statement-breakpoint
ALTER TABLE "performance_entries" ADD COLUMN "custom_system" boolean DEFAULT false NOT NULL;--> statement-breakpoint
CREATE INDEX "perf_hardware_upscaler_idx" ON "performance_entries" USING btree ("hardware_slug","upscaler_type");