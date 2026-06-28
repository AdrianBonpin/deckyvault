import { Elysia, t } from "elysia"
import { db } from "@/lib/db/index"
import {
  gameVersions,
  performanceEntries,
  hardware,
  user,
  gamePlatformSupport,
  entryScreenshots,
} from "@/lib/db/schema"
import { and, desc, eq } from "drizzle-orm"
import { getR2PublicUrl } from "@/lib/storage"

/**
 * GET /api/games/:gameId/performance
 *
 * Returns all non-removed performance entries (presets) for a game,
 * with joined user, hardware, platform support, and screenshot data.
 * Ordered by isPinned desc, then upvotes desc.
 */
export const gamesPerformanceRoutes = new Elysia({
  prefix: "/games",
  detail: { tags: ["Games"] },
}).get(
  "/:gameId/performance",
  async ({ params, set }) => {
    const { gameId } = params

    const presetRows = await db
      .select({
        id: performanceEntries.id,
        hardwareSlug: performanceEntries.hardwareSlug,
        hardwareName: hardware.name,
        upvotes: performanceEntries.upvotes,
        settingsJson: performanceEntries.settingsJson,
        fpsAvg: performanceEntries.fpsAvg,
        fpsLow: performanceEntries.fpsLow,
        fpsHigh: performanceEntries.fpsHigh,
        fpsOnePercentLow: performanceEntries.fpsOnePercentLow,
        upscalerType: performanceEntries.upscalerType,
        upscalerVersion: performanceEntries.upscalerVersion,
        frameGenMethod: performanceEntries.frameGenMethod,
        protonVersion: performanceEntries.protonVersion,
        osVersion: performanceEntries.osVersion,
        createdAt: performanceEntries.createdAt,
        userId: performanceEntries.userId,
        userName: user.name,
        userImage: user.image,
        downvotes: performanceEntries.downvotes,
        launchOptions: performanceEntries.launchOptions,
        loadTimeSsd: performanceEntries.loadTimeSsd,
        loadTimeSd: performanceEntries.loadTimeSd,
        tdpWatts: performanceEntries.tdpWatts,
        youtubeVideoId: performanceEntries.youtubeVideoId,
        customSystem: performanceEntries.customSystem,
        userNotes: performanceEntries.userNotes,
        versionString: gameVersions.versionString,
        buildId: gameVersions.buildId,
        gameAntiCheatName: gamePlatformSupport.antiCheatName,
        gameAntiCheatStatus: gamePlatformSupport.antiCheatStatus,
        verifiedAt: performanceEntries.verifiedAt,
        isPinned: performanceEntries.isPinned,
        pinnedAt: performanceEntries.pinnedAt,
      })
      .from(performanceEntries)
      .innerJoin(
        gameVersions,
        eq(performanceEntries.versionId, gameVersions.id),
      )
      .innerJoin(
        hardware,
        eq(performanceEntries.hardwareSlug, hardware.slug),
      )
      .innerJoin(user, eq(performanceEntries.userId, user.id))
      .innerJoin(
        gamePlatformSupport,
        and(
          eq(gamePlatformSupport.gameId, gameVersions.gameId),
          eq(
            gamePlatformSupport.hardwareSlug,
            performanceEntries.hardwareSlug,
          ),
        ),
      )
      .where(
        and(
          eq(gameVersions.gameId, gameId),
          eq(performanceEntries.isRemoved, false),
        ),
      )
      .orderBy(
        desc(performanceEntries.isPinned),
        desc(performanceEntries.upvotes),
      )

    if (presetRows.length === 0) {
      return []
    }

    const publicUrl = getR2PublicUrl()

    // Fetch screenshots and hardware details per preset
    const presets = await Promise.all(
      presetRows.map(async (p) => {
        const screenshots = await db
          .select({
            id: entryScreenshots.id,
            storageKey: entryScreenshots.storageKey,
            orderIndex: entryScreenshots.orderIndex,
            width: entryScreenshots.width,
            height: entryScreenshots.height,
          })
          .from(entryScreenshots)
          .where(eq(entryScreenshots.entryId, p.id))
          .orderBy(entryScreenshots.orderIndex)

        const [hw] = await db
          .select({
            wattHours: hardware.wattHours,
            deviceType: hardware.deviceType,
          })
          .from(hardware)
          .where(eq(hardware.slug, p.hardwareSlug))
          .limit(1)

        const settingsCount = Array.isArray(p.settingsJson)
          ? (p.settingsJson as Array<{ settings: unknown[] }>).reduce(
              (sum, cat) => sum + cat.settings.length,
              0,
            )
          : 0

        return {
          id: p.id,
          gameId,
          hardwareSlug: p.hardwareSlug,
          hardwareName: p.hardwareName,
          upvotes: p.upvotes,
          downvotes: p.downvotes,
          settingsCount,
          fpsAvg: p.fpsAvg,
          fpsLow: p.fpsLow,
          fpsHigh: p.fpsHigh,
          fpsOnePercentLow: p.fpsOnePercentLow ?? null,
          upscalerType: p.upscalerType,
          upscalerVersion: p.upscalerVersion,
          frameGenMethod: p.frameGenMethod,
          protonVersion: p.protonVersion,
          osVersion: p.osVersion,
          createdAt: p.createdAt.toISOString(),
          settingsJson: p.settingsJson,
          launchOptions: p.launchOptions,
          loadTimeSsd: p.loadTimeSsd ?? null,
          loadTimeSd: p.loadTimeSd ?? null,
          tdpWatts: p.tdpWatts ?? null,
          youtubeVideoId: p.youtubeVideoId ?? null,
          screenshots: screenshots.map((ss) => ({
            id: ss.id,
            url: `${publicUrl}/${ss.storageKey}`,
            width: ss.width,
            height: ss.height,
            orderIndex: ss.orderIndex,
          })),
          hardwareWattHours: hw?.wattHours ? Number(hw.wattHours) : null,
          hardwareDeviceType: hw?.deviceType ?? null,
          customSystem: p.customSystem ?? false,
          userNotes: p.userNotes,
          versionString: p.versionString ?? null,
          buildId: p.buildId ?? null,
          gameAntiCheatName: p.gameAntiCheatName ?? null,
          gameAntiCheatStatus: p.gameAntiCheatStatus ?? null,
          userId: p.userId,
          userName: p.userName,
          userImage: p.userImage,
          verifiedAt: p.verifiedAt ? p.verifiedAt.toISOString() : null,
          isPinned: p.isPinned,
          pinnedAt: p.pinnedAt ? p.pinnedAt.toISOString() : null,
        }
      }),
    )

    return presets
  },
  {
    params: t.Object({ gameId: t.String() }),
    detail: { description: "Returns all non-removed performance presets for a game with user, hardware, platform support, and screenshot data. Ordered by pinned then upvotes." },
  },
)
