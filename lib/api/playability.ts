import { Elysia } from "elysia";
import { db } from "@/lib/db/index";
import { games, gamePlatformSupport, performanceEntries, gameVersions } from "@/lib/db/schema";
import { eq, and, avg, count, sql } from "drizzle-orm";
import { requireContributorOrAdmin } from "@/lib/auth/guard";

/**
 * Playability calculation rules:
 * - great: avg FPS >= 55, no anti-cheat issues
 * - playable: avg FPS >= 30, no critical anti-cheat issues
 * - needs_tweaks: avg FPS >= 20 OR has upscaler/frame-gen dependency
 * - unplayable: avg FPS < 20 OR anti-cheat unsupported
 * - unknown: no benchmark data
 */
function calculatePlayability(stats: {
  avgFps: number | null;
  avgFpsLow: number | null;
  antiCheatStatus: string | null;
  hasUpscalerDependency: boolean;
  entryCount: number;
}): "great" | "playable" | "needs_tweaks" | "unplayable" | "unknown" {
  if (!stats.avgFps || stats.entryCount === 0) return "unknown";

  // Anti-cheat unsupported = unplayable regardless of FPS
  if (stats.antiCheatStatus === "unsupported") return "unplayable";

  const fps = stats.avgFps;

  if (fps >= 55 && !stats.hasUpscalerDependency) return "great";
  if (fps >= 55 && stats.hasUpscalerDependency) return "playable";
  if (fps >= 30) return "playable";
  if (fps >= 20) return "needs_tweaks";
  return "unplayable";
}

export const playabilityRoutes = new Elysia({ prefix: "/playability" })
  // Auto-calculate playability for a game (all devices)
  .post(
    "/calculate/:gameId",
    async ({ params, request, set }) => {
      const guard = await requireContributorOrAdmin(request.headers);
      if (!guard.ok) {
        set.status = guard.status;
        return { error: guard.error };
      }

      const gameId = params.gameId;

      // Get all platform support entries for this game
      const platformEntries = await db
        .select()
        .from(gamePlatformSupport)
        .where(eq(gamePlatformSupport.gameId, gameId));

      // Get performance stats per device
      const deviceStats = await db
        .select({
          hardwareSlug: performanceEntries.hardwareSlug,
          avgFps: avg(performanceEntries.fpsAvg).mapWith(Number),
          avgFpsLow: avg(performanceEntries.fpsLow).mapWith(Number),
          entryCount: count(performanceEntries.id),
          upscalerEntries: sql<number>`count(case when ${performanceEntries.upscalerType} != 'none' then 1 end)`.mapWith(Number),
          frameGenEntries: sql<number>`count(case when ${performanceEntries.frameGenMethod} != 'none' then 1 end)`.mapWith(Number),
        })
        .from(performanceEntries)
        .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
        .where(
          and(
            eq(gameVersions.gameId, gameId),
            eq(performanceEntries.isRemoved, false)
          )
        )
        .groupBy(performanceEntries.hardwareSlug);

      const results: Array<{
        hardwareSlug: string;
        playabilityStatus: string;
      }> = [];

      for (const stat of deviceStats) {
        const platformEntry = platformEntries.find(
          (p) => p.hardwareSlug === stat.hardwareSlug
        );

        const hasUpscalerDependency =
          stat.upscalerEntries > stat.entryCount * 0.5 ||
          stat.frameGenEntries > stat.entryCount * 0.5;

        const status = calculatePlayability({
          avgFps: stat.avgFps,
          avgFpsLow: stat.avgFpsLow,
          antiCheatStatus: platformEntry?.antiCheatStatus ?? null,
          hasUpscalerDependency,
          entryCount: stat.entryCount,
        });

        // Only update if not manually overridden
        if (platformEntry && !platformEntry.playabilityOverride) {
          await db
            .update(gamePlatformSupport)
            .set({
              playabilityStatus: status as any,
              playabilityCalculatedAt: new Date(),
            })
            .where(
              and(
                eq(gamePlatformSupport.gameId, gameId),
                eq(gamePlatformSupport.hardwareSlug, stat.hardwareSlug)
              )
            );
        }

        results.push({ hardwareSlug: stat.hardwareSlug, playabilityStatus: status });
      }

      // Update aggregate game-level playability (worst of all devices)
      const priority = { unplayable: 0, needs_tweaks: 1, playable: 2, great: 3, unknown: 4 };
      let worstStatus: string = "unknown";
      for (const r of results) {
        if (priority[r.playabilityStatus as keyof typeof priority] < priority[worstStatus as keyof typeof priority]) {
          worstStatus = r.playabilityStatus;
        }
      }

      await db
        .update(games)
        .set({
          playabilityStatus: worstStatus as any,
          playabilityCalculatedAt: new Date(),
        })
        .where(eq(games.id, gameId));

      return { gamePlayability: worstStatus, deviceResults: results };
    }
  )

  // Manual override for a game (admin/contributor)
  .post(
    "/override/:gameId",
    async ({ params, body, request, set }) => {
      const guard = await requireContributorOrAdmin(request.headers);
      if (!guard.ok) {
        set.status = guard.status;
        return { error: guard.error };
      }

      const { status, hardwareSlug } = body as {
        status: string;
        hardwareSlug?: string;
      };

      if (!["great", "playable", "needs_tweaks", "unplayable"].includes(status)) {
        set.status = 400;
        return { error: "Invalid playability status" };
      }

      if (hardwareSlug) {
        // Override for specific device
        await db
          .update(gamePlatformSupport)
          .set({
            playabilityStatus: status as any,
            playabilityOverride: true,
          })
          .where(
            and(
              eq(gamePlatformSupport.gameId, params.gameId),
              eq(gamePlatformSupport.hardwareSlug, hardwareSlug)
            )
          );
      } else {
        // Override for game overall
        await db
          .update(games)
          .set({
            playabilityStatus: status as any,
            playabilityOverride: true,
          })
          .where(eq(games.id, params.gameId));
      }

      return { success: true };
    }
  )

  // Clear override (revert to auto-calculated)
  .post(
    "/clear-override/:gameId",
    async ({ params, body, request, set }) => {
      const guard = await requireContributorOrAdmin(request.headers);
      if (!guard.ok) {
        set.status = guard.status;
        return { error: guard.error };
      }

      const { hardwareSlug } = body as { hardwareSlug?: string };

      if (hardwareSlug) {
        await db
          .update(gamePlatformSupport)
          .set({ playabilityOverride: false })
          .where(
            and(
              eq(gamePlatformSupport.gameId, params.gameId),
              eq(gamePlatformSupport.hardwareSlug, hardwareSlug)
            )
          );
      } else {
        await db
          .update(games)
          .set({ playabilityOverride: false })
          .where(eq(games.id, params.gameId));
      }

      return { success: true };
    }
  );