-- Add new values to existing frame_gen_method enum
ALTER TYPE "frame_gen_method" ADD VALUE 'lsfg';--> statement-breakpoint
ALTER TYPE "frame_gen_method" ADD VALUE 'other';--> statement-breakpoint

-- Create new upscaler_type enum
CREATE TYPE "public"."upscaler_type" AS ENUM('none', 'fsr', 'dlss', 'xess', 'lsfg', 'other');--> statement-breakpoint

-- Add new columns to performance_entries
ALTER TABLE "performance_entries" ADD COLUMN "upscaler_type" "upscaler_type" DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "performance_entries" ADD COLUMN "upscaler_version" text;--> statement-breakpoint
ALTER TABLE "performance_entries" ADD COLUMN "estimated_battery_min" integer;--> statement-breakpoint
ALTER TABLE "performance_entries" ADD COLUMN "custom_system" boolean DEFAULT false NOT NULL;--> statement-breakpoint

-- Migrate existing fsr_version data to upscaler_type/upscaler_version
UPDATE "performance_entries" SET upscaler_type = 'none', upscaler_version = NULL WHERE fsr_version = 'none';--> statement-breakpoint
UPDATE "performance_entries" SET upscaler_type = 'fsr', upscaler_version = '1' WHERE fsr_version = 'fsr1';--> statement-breakpoint
UPDATE "performance_entries" SET upscaler_type = 'fsr', upscaler_version = '2' WHERE fsr_version = 'fsr2';--> statement-breakpoint
UPDATE "performance_entries" SET upscaler_type = 'fsr', upscaler_version = '3' WHERE fsr_version = 'fsr3';--> statement-breakpoint

-- Drop old index
DROP INDEX "perf_hardware_fsr_idx";--> statement-breakpoint

-- Drop old column
ALTER TABLE "performance_entries" DROP COLUMN "fsr_version";--> statement-breakpoint

-- Drop old enum type
DROP TYPE "fsr_version";--> statement-breakpoint

-- Create new index on hardware_slug and upscaler_type
CREATE INDEX "perf_hardware_upscaler_idx" ON "performance_entries" USING btree ("hardware_slug","upscaler_type");
