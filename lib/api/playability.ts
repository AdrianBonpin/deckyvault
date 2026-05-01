import { Elysia } from "elysia";
import { db } from "@/lib/db/index";
import { games, gamePlatformSupport, performanceEntries, gameVersions, playabilityStatusEnum } from "@/lib/db/schema";
import { eq, and, avg, count, sql } from "drizzle-orm";
import { requireContributorOrAdmin } from "@/lib/auth/guard";

/**
 * Playability calculation rules:
 * - great: avg FPS >= 55, no upscaler/frame-gen dependency
 * - playable: avg FPS >= 30, or >= 55 with upscaler dependency
 * - needs_tweaks: avg FPS >= 20 but < 30
 * - unplayable: avg FPS < 20, OR anti-cheat is relevant AND unsupported
 * - unknown: no benchmark data
 *
 * IMPORTANT: Anti-cheat only blocks playability if the game actually uses anti-cheat
 * (antiCheatRelevant = true). Games without anti-cheat are unaffected.
 */
function calculatePlayability(stats: {
  avgFps: number | null;
  antiCheatRelevant: boolean;
  antiCheatStatus: string | null;
  hasUpscalerDependency: boolean;
  entryCount: number;
}): "great" | "playable" | "needs_tweaks" | "unplayable" | "unknown" {
  if (!stats.avgFps || stats.entryCount === 0) return "unknown";

  // Anti-cheat unsupported = unplayable ONLY if the game actually uses anti-cheat
  if (stats.antiCheatRelevant && stats.antiCheatStatus === "unsupported") {
    return "unplayable";
  }

  const fps = stats.avgFps;

  if (fps >= 55 && !stats.hasUpscalerDependency) return "great";
  if (fps >= 55 && stats.hasUpscalerDependency) return "playable";
  if (fps >= 30) return "playable";
  if (fps >= 20) return "needs_tweaks";
  return "unplayable";
}

/**
 * Recalculate playability for a game (all devices).
 * Called automatically after benchmark submission and Steam sync.
 * Skips devices with manual overrides.
 */
export async function recalculatePlayability(gameId: string): Promise<{
  gamePlayability: string;
  deviceResults: Array<{ hardwareSlug: string; playabilityStatus: string }>;
}> {
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
      entryCount: count(performanceEntries.id),
      upscalerEntries:
        sql<number>`count(case when ${performanceEntries.upscalerType} != 'none' then 1 end)`.mapWith(
          Number,
        ),
      frameGenEntries:
        sql<number>`count(case when ${performanceEntries.frameGenMethod} != 'none' then 1 end)`.mapWith(
          Number,
        ),
    })
    .from(performanceEntries)
    .innerJoin(gameVersions, eq(performanceEntries.versionId, gameVersions.id))
    .where(and(eq(gameVersions.gameId, gameId), eq(performanceEntries.isRemoved, false)))
    .groupBy(performanceEntries.hardwareSlug);

  const results: Array<{ hardwareSlug: string; playabilityStatus: string }> = [];

  for (const stat of deviceStats) {
    const platformEntry = platformEntries.find((p) => p.hardwareSlug === stat.hardwareSlug);

    const hasUpscalerDependency =
      stat.upscalerEntries > stat.entryCount * 0.5 ||
      stat.frameGenEntries > stat.entryCount * 0.5;

    const status = calculatePlayability({
      avgFps: stat.avgFps,
      antiCheatRelevant: platformEntry?.antiCheatRelevant ?? false,
      antiCheatStatus: platformEntry?.antiCheatStatus ?? null,
      hasUpscalerDependency,
      entryCount: stat.entryCount,
    });

    // Only update if not manually overridden
    if (platformEntry && !platformEntry.playabilityOverride) {
      await db
        .update(gamePlatformSupport)
        .set({
          playabilityStatus: status as typeof playabilityStatusEnum.enumValues[number],
          playabilityCalculatedAt: new Date(),
        })
        .where(
          and(
            eq(gamePlatformSupport.gameId, gameId),
            eq(gamePlatformSupport.hardwareSlug, stat.hardwareSlug),
          ),
        );
    }

    results.push({ hardwareSlug: stat.hardwareSlug, playabilityStatus: status });
  }

  // Update aggregate game-level playability (worst of all devices)
  const priority = { unplayable: 0, needs_tweaks: 1, playable: 2, great: 3, unknown: 4 };
  let worstStatus: typeof playabilityStatusEnum.enumValues[number] = "unknown";
  for (const r of results) {
    if (
      priority[r.playabilityStatus as keyof typeof priority] <
      priority[worstStatus as keyof typeof priority]
    ) {
      worstStatus = r.playabilityStatus as typeof playabilityStatusEnum.enumValues[number];
    }
  }

  // Only update game-level if not manually overridden
  const [game] = await db
    .select({ playabilityOverride: games.playabilityOverride })
    .from(games)
    .where(eq(games.id, gameId))
    .limit(1);

  if (!game?.playabilityOverride) {
    await db
      .update(games)
      .set({
        playabilityStatus: worstStatus as typeof playabilityStatusEnum.enumValues[number],
        playabilityCalculatedAt: new Date(),
      })
      .where(eq(games.id, gameId));
  }

  return { gamePlayability: worstStatus, deviceResults: results };
}

export const playabilityRoutes = new Elysia({ prefix: "/playability" })
  // Manual trigger for recalculation (admin/contributor)
  .post("/calculate/:gameId", async ({ params, request, set }) => {
    const guard = await requireContributorOrAdmin(request.headers);
    if (!guard.ok) {
      set.status = guard.status;
      return { error: guard.error };
    }

    return recalculatePlayability(params.gameId);
  })

  // Manual override for a game (admin/contributor)
  .post("/override/:gameId", async ({ params, body, request, set }) => {
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
      await db
        .update(gamePlatformSupport)
        .set({ playabilityStatus: status as typeof playabilityStatusEnum.enumValues[number], playabilityOverride: true })
        .where(
          and(
            eq(gamePlatformSupport.gameId, params.gameId),
            eq(gamePlatformSupport.hardwareSlug, hardwareSlug),
          ),
        );
    } else {
      await db
        .update(games)
        .set({ playabilityStatus: status as typeof playabilityStatusEnum.enumValues[number], playabilityOverride: true })
        .where(eq(games.id, params.gameId));
    }

    return { success: true };
  })

  // Clear override (revert to auto-calculated)
  .post("/clear-override/:gameId", async ({ params, body, request, set }) => {
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
            eq(gamePlatformSupport.hardwareSlug, hardwareSlug),
          ),
        );
    } else {
      await db
        .update(games)
        .set({ playabilityOverride: false })
        .where(eq(games.id, params.gameId));
    }

    return { success: true };
  });
