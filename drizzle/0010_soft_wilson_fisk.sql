ALTER TABLE "hardware" ALTER COLUMN "device_type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."device_type";--> statement-breakpoint
CREATE TYPE "public"."device_type" AS ENUM('handheld', 'console');--> statement-breakpoint
ALTER TABLE "hardware" ALTER COLUMN "device_type" SET DATA TYPE "public"."device_type" USING "device_type"::"public"."device_type";--> statement-breakpoint
ALTER TABLE "hardware" ADD COLUMN "image" text;--> statement-breakpoint
ALTER TABLE "performance_entries" ADD COLUMN "fps_one_percent_low" real;